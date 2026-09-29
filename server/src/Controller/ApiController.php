<?php

namespace App\Controller;

use App\Entity\Account;
use App\Entity\Mischief;
use App\Entity\Neighborhood;
use App\Entity\Player;
use App\Entity\Street;
use App\Entity\StreetShare;
use App\Service\Auth;
use App\Service\BadBoys;
use App\Service\Credentials;
use App\Service\Documents;
use App\Service\PlayerRemover;
use App\Service\StreetMerger;
use App\Service\StreetTakenException;
use Doctrine\DBAL\Exception\UniqueConstraintViolationException;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\HttpKernel\Exception\TooManyRequestsHttpException;
use Symfony\Component\Routing\Attribute\Route;

/**
 * Speichert Spieler, Straßen und Nachbarschaften, damit mehrere Spieler dieselbe Welt teilen.
 * Die Spiellogik läuft im Client; der Server achtet darauf, dass niemand fremdes Eigentum überschreibt.
 */
#[Route('/api')]
final class ApiController
{
    private const CITY_LIMIT = 30;

    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly Auth $auth,
        private readonly StreetMerger $merger,
        private readonly PlayerRemover $remover,
    ) {
    }

    #[Route('/health', methods: ['GET'])]
    public function health(): JsonResponse
    {
        return new JsonResponse(['ok' => true]);
    }

    /**
     * Neuer Spieler mit seiner Straße (und optional dem bisherigen lokalen Spielstand:
     * Nachbarschaft + Bot-Straßen). Echte Straßen gehören dem, der zuerst kommt.
     */
    #[Route('/register', methods: ['POST'])]
    public function register(Request $request): JsonResponse
    {
        // Neue Straßen gibt es nur mit Konto – höchstens drei gleichzeitig.
        $account = $this->auth->account($request);
        if (\count($this->em->getRepository(Player::class)->findBy(['accountId' => $account->getId()])) >= Account::MAX_STREETS) {
            throw new ConflictHttpException(\sprintf('Höchstens %d Straßen pro Konto.', Account::MAX_STREETS));
        }
        $body = Documents::json($request->getContent());
        $playerDoc = Documents::player($body['player'] ?? null);
        $streetDoc = Documents::street($body['street'] ?? null);
        $playerId = $playerDoc['id'];
        if ($streetDoc['id'] !== $playerDoc['streetId'] || $streetDoc['ownerId'] !== $playerId) {
            throw new BadRequestHttpException('Straße passt nicht zum Spieler.');
        }
        if (null !== $this->em->find(Player::class, $playerId) || null !== $this->em->find(Street::class, $streetDoc['id'])) {
            throw new ConflictHttpException('Diesen Spielstand gibt es schon.');
        }
        $this->assertStreetFree($streetDoc, null);

        $token = Credentials::newToken();
        $recoveryCode = Credentials::newRecoveryCode();
        $player = new Player($playerId, $playerDoc['name'], Credentials::hash($token), Credentials::hash($recoveryCode), $playerDoc);
        $player->setData($playerDoc);
        $player->setAccountId($account->getId());
        $this->em->persist($player);
        $this->em->persist($this->newStreet($this->sanitizeNewStreet($streetDoc, $playerId), null));

        // Mitgebrachte Nachbarschaft (Umzug vom lokalen Spielstand).
        if (is_array($body['neighborhood'] ?? null)) {
            $this->em->persist(new Neighborhood($playerId, $body['neighborhood']));
        }
        foreach ((array) ($body['streets'] ?? []) as $botStreet) {
            $botStreet = Documents::street($botStreet);
            if ($botStreet['ownerId'] === $playerId || null !== $this->em->find(Street::class, $botStreet['id'])) {
                continue;
            }
            $this->em->persist($this->newStreet($this->sanitizeNewStreet($botStreet, $playerId), $playerId));
        }

        $this->flush();

        return new JsonResponse([
            'token' => $token,
            'recoveryCode' => $recoveryCode,
            'player' => $player->getData(),
        ], 201);
    }

    /** Auf einem neuen Gerät weiterspielen: Code eingeben, neuer Geräte-Schlüssel. */
    #[Route('/recover', methods: ['POST'])]
    public function recover(Request $request): JsonResponse
    {
        $body = Documents::json($request->getContent());
        $code = Credentials::normalizeRecoveryCode((string) ($body['code'] ?? ''));
        $player = $this->em->getRepository(Player::class)->findOneBy(['recoveryHash' => Credentials::hash($code)]);
        if (!$player instanceof Player) {
            throw new NotFoundHttpException('Diesen Code kennen wir nicht.');
        }
        // Es gibt immer genau einen gültigen Geräte-Schlüssel – das alte Gerät wird abgemeldet.
        $token = Credentials::newToken();
        $player->setTokenHash(Credentials::hash($token));
        $this->em->flush();

        return new JsonResponse(['token' => $token] + $this->snapshot($player));
    }

    /** Alles, was das Spiel beim Start braucht. */
    #[Route('/me', methods: ['GET'])]
    public function me(Request $request): JsonResponse
    {
        return new JsonResponse($this->snapshot($this->auth->player($request)));
    }

    #[Route('/me', methods: ['PUT'])]
    public function savePlayer(Request $request): JsonResponse
    {
        $player = $this->auth->player($request);
        $doc = Documents::player(Documents::json($request->getContent())['player'] ?? null);
        if ($doc['id'] !== $player->getId()) {
            throw new AccessDeniedHttpException('Falscher Spieler.');
        }
        if ($doc['streetId'] !== $player->getStreetId()) {
            throw new BadRequestHttpException('Die eigene Straße lässt sich nicht wechseln.');
        }
        $player->setData($doc);
        $this->em->flush();

        return new JsonResponse(['player' => $player->getData()]);
    }

    /** Spielstand löschen: eigene Straßen weg, Grundstücke in fremden Straßen werden wieder frei. */
    #[Route('/me', methods: ['DELETE'])]
    public function deletePlayer(Request $request): JsonResponse
    {
        $this->remover->remove($this->auth->player($request));
        $this->em->flush();

        return new JsonResponse(['ok' => true]);
    }

    #[Route('/me/neighborhood', methods: ['PUT'])]
    public function saveNeighborhood(Request $request): JsonResponse
    {
        $player = $this->auth->player($request);
        $doc = Documents::json($request->getContent())['neighborhood'] ?? null;
        if (!is_array($doc)) {
            throw new BadRequestHttpException('Nachbarschaft fehlt.');
        }
        $hood = $this->em->find(Neighborhood::class, $player->getId());
        if (null === $hood) {
            $this->em->persist(new Neighborhood($player->getId(), $doc));
        } else {
            $hood->setData($doc);
        }
        $this->em->flush();

        return new JsonResponse(['ok' => true]);
    }

    #[Route('/streets/{id}', methods: ['GET'])]
    public function street(string $id, Request $request): JsonResponse
    {
        $this->auth->player($request);
        $street = $this->em->find(Street::class, Documents::id($id, 'street'));
        if (!$street instanceof Street) {
            throw new NotFoundHttpException('Straße nicht gefunden.');
        }

        return new JsonResponse($this->streetEntry($street));
    }

    /**
     * Straße speichern. Gibt die zusammengeführte Straße zurück – der Client übernimmt sie,
     * denn jemand anderes kann inzwischen ein Grundstück gekauft haben.
     */
    #[Route('/streets/{id}', methods: ['PUT'])]
    public function saveStreet(string $id, Request $request): JsonResponse
    {
        $player = $this->auth->player($request);
        $playerId = $player->getId();
        $doc = Documents::street(Documents::json($request->getContent())['street'] ?? null);
        if ($doc['id'] !== $id) {
            throw new BadRequestHttpException('Straßen-ID passt nicht.');
        }

        $street = $this->em->find(Street::class, $id);
        if (!$street instanceof Street) {
            // Neu: die eigene Straße (nach dem Löschen) oder eine Bot-Straße der eigenen Nachbarschaft.
            $own = $doc['ownerId'] === $playerId;
            if ($own ? $id !== $player->getStreetId() : null !== $this->em->find(Player::class, $doc['ownerId'])) {
                throw new AccessDeniedHttpException('Diese Straße darfst du nicht anlegen.');
            }
            if ($own) {
                $this->assertStreetFree($doc, null);
            }
            $street = $this->newStreet($this->sanitizeNewStreet($doc, $playerId), $own ? null : $playerId);
            $this->em->persist($street);
        } else {
            $manages = $street->isManagedBy($playerId);
            $merged = $this->merger->merge($street->getData(), $doc, $playerId, $manages);
            if ($manages && !$street->isBotStreet()) {
                $osmKey = Documents::osmKey($merged);
                // Nur beim Bestätigen auf der Karte (neue Kennung oder neuer Name) prüfen – ältere Doppelte laufen weiter.
                $before = $street->getData();
                if ($osmKey !== Documents::osmKey($before) || Street::nameKey((string) $merged['name']) !== Street::nameKey((string) ($before['name'] ?? ''))
                    || Street::cityKey((string) $merged['city']) !== Street::cityKey((string) ($before['city'] ?? ''))) {
                    $this->assertStreetFree($merged, $street->getId());
                }
                $street->setOsmKey($osmKey);
            }
            $street->setData($merged);
        }
        $this->syncShares($street, $playerId);
        $this->flush();

        return new JsonResponse($this->streetEntry($street));
    }

    /**
     * Einen Bad Boy in die Straße eines anderen Spielers schicken. Bezahlt wird im Spiel; hier wird
     * gebremst (nicht dauernd dieselbe Straße) und ausgewürfelt, ob der Wachschutz ihn abfängt.
     */
    #[Route('/streets/{id}/mischief', methods: ['POST'])]
    public function sendMischief(string $id, Request $request): JsonResponse
    {
        $player = $this->auth->player($request);
        $street = $this->em->find(Street::class, Documents::id($id, 'street'));
        if (!$street instanceof Street || $street->isBotStreet()) {
            throw new NotFoundHttpException('Straße nicht gefunden.');
        }
        if ($street->getOwnerId() === $player->getId()) {
            throw new BadRequestHttpException('Nicht in die eigene Straße!');
        }
        $body = Documents::json($request->getContent());
        $badBoy = (string) ($body['badBoy'] ?? '');
        $visitor = BadBoys::isVisitor($badBoy);
        if (!$visitor && !in_array($badBoy, BadBoys::IDS, true)) {
            throw new BadRequestHttpException('Diesen Bad Boy gibt es nicht.');
        }
        $label = $visitor && is_string($body['label'] ?? null) ? mb_substr(trim($body['label']), 0, 60) : null;

        if ($visitor) {
            // Tiere und Autos: nach festem Takt unterwegs – nur eine Obergrenze pro Tag.
            $visits = $this->em->createQueryBuilder()
                ->select('COUNT(m.id)')->from(Mischief::class, 'm')
                ->where('m.streetId = :street')->andWhere('m.senderId = :me')->andWhere('m.createdAt > :since')
                ->setParameter('street', $street->getId())->setParameter('me', $player->getId())
                ->setParameter('since', new \DateTimeImmutable('-1 day'))
                ->getQuery()->getSingleScalarResult();
            if ($visits >= BadBoys::MAX_VISITS_PER_SENDER_PER_DAY) {
                throw new TooManyRequestsHttpException(null, 'Genug Ausflüge in diese Straße für heute.');
            }
            $mischief = new Mischief(Credentials::newToken(), $street->getId(), $player->getId(), $player->getName(), $badBoy, false, $label ?: null);
            $this->em->persist($mischief);
            $this->em->flush();

            return new JsonResponse(['mischief' => $mischief->toArray()], 201);
        }

        $recent = $this->em->createQueryBuilder()
            ->select('COUNT(m.id)')->from(Mischief::class, 'm')
            ->where('m.streetId = :street')->andWhere('m.senderId = :me')->andWhere('m.createdAt > :since')
            ->setParameter('street', $street->getId())->setParameter('me', $player->getId())
            ->setParameter('since', new \DateTimeImmutable(sprintf('-%d minutes', BadBoys::COOLDOWN_MINUTES)))
            ->getQuery()->getSingleScalarResult();
        if ($recent > 0) {
            throw new TooManyRequestsHttpException(null, sprintf('Deine Bad Boys brauchen eine Pause – in diese Straße erst wieder in %d Minuten.', BadBoys::COOLDOWN_MINUTES));
        }
        $today = $this->em->createQueryBuilder()
            ->select('COUNT(m.id)')->from(Mischief::class, 'm')
            ->where('m.streetId = :street')->andWhere('m.createdAt > :since')
            ->setParameter('street', $street->getId())->setParameter('since', new \DateTimeImmutable('-1 day'))
            ->getQuery()->getSingleScalarResult();
        if ($today >= BadBoys::MAX_PER_STREET_PER_DAY) {
            throw new TooManyRequestsHttpException(null, 'In dieser Straße war heute schon genug los.');
        }

        $mischief = new Mischief(
            Credentials::newToken(),
            $street->getId(),
            $player->getId(),
            $player->getName(),
            $badBoy,
            BadBoys::blocked($street->getData()),
        );
        $this->em->persist($mischief);
        $this->em->flush();

        return new JsonResponse(['mischief' => $mischief->toArray()], 201);
    }

    /** Bad Boys, die in meiner Straße angekommen sind und die mein Spiel noch nicht verarbeitet hat. */
    #[Route('/me/mischief', methods: ['GET'])]
    public function myMischief(Request $request): JsonResponse
    {
        return new JsonResponse(['mischief' => $this->pendingMischief($this->auth->player($request))]);
    }

    #[Route('/me/mischief/ack', methods: ['POST'])]
    public function ackMischief(Request $request): JsonResponse
    {
        $player = $this->auth->player($request);
        $ids = array_filter((array) (Documents::json($request->getContent())['ids'] ?? []), 'is_string');
        foreach ($ids as $id) {
            $mischief = $this->em->find(Mischief::class, $id);
            if ($mischief instanceof Mischief && $mischief->getStreetId() === $player->getStreetId()) {
                $mischief->markDelivered();
            }
        }
        $this->em->flush();

        return new JsonResponse(['ok' => true]);
    }

    /** Straßen anderer Spieler im selben Ort – zum Ansehen und um Bad Boys hinzuschicken. */
    #[Route('/city', methods: ['GET'])]
    public function city(Request $request): JsonResponse
    {
        $player = $this->auth->player($request);
        $city = Street::cityKey((string) $request->query->get('name', ''));
        if ('' === $city) {
            throw new BadRequestHttpException('Ort fehlt.');
        }
        $streets = $this->em->createQueryBuilder()
            ->select('s')->from(Street::class, 's')
            ->where('s.cityKey = :city')->andWhere('s.controllerId IS NULL')->andWhere('s.ownerId <> :me')
            ->setParameter('city', $city)->setParameter('me', $player->getId())
            ->orderBy('s.updatedAt', 'DESC')->setMaxResults(self::CITY_LIMIT)
            ->getQuery()->getResult();

        return new JsonResponse(['streets' => array_map($this->streetEntry(...), $streets)]);
    }

    // ---------- Hilfen ----------

    private function pendingMischief(Player $player): array
    {
        $list = $this->em->getRepository(Mischief::class)->findBy(
            ['streetId' => $player->getStreetId(), 'delivered' => false],
            ['createdAt' => 'ASC'],
            50,
        );

        return array_map(fn (Mischief $m) => $m->toArray(), $list);
    }

    /** Spieler, eigene Straße, Nachbarschaft, Bot-Straßen und fremde Straßen mit eigenen Grundstücken. */
    private function snapshot(Player $player): array
    {
        $playerId = $player->getId();
        $repo = $this->em->getRepository(Street::class);
        $own = $this->em->find(Street::class, $player->getStreetId());
        $shared = array_filter(array_map(
            fn (StreetShare $share) => $this->em->find(Street::class, $share->getStreetId()),
            $this->em->getRepository(StreetShare::class)->findBy(['playerId' => $playerId]),
        ));

        return [
            'player' => $player->getData(),
            'street' => $own?->getData(),
            'neighborhood' => $this->em->find(Neighborhood::class, $playerId)?->getData(),
            'streets' => array_map($this->streetEntry(...), [...$repo->findBy(['controllerId' => $playerId]), ...array_values($shared)]),
            'mischief' => $this->pendingMischief($player),
        ];
    }

    /** Straße plus Name des Besitzers (bei Spieler-Straßen) und Namen der Spieler, die dort Grundstücke haben. */
    private function streetEntry(Street $street): array
    {
        $owner = $street->isBotStreet() ? null : $this->em->find(Player::class, $street->getOwnerId());
        $names = [];
        foreach ((array) ($street->getData()['plots'] ?? []) as $plot) {
            $id = $plot['ownerId'] ?? null;
            if (is_string($id) && !isset($names[$id])) {
                $buyer = $this->em->find(Player::class, $id);
                if ($buyer instanceof Player) {
                    $names[$id] = $buyer->getName();
                }
            }
        }

        return ['street' => $street->getData(), 'ownerName' => $owner?->getName(), 'names' => (object) $names];
    }

    private function newStreet(array $doc, ?string $controllerId): Street
    {
        return new Street(
            $doc['id'],
            $doc['ownerId'],
            $controllerId,
            null === $controllerId ? Documents::osmKey($doc) : null,
            Street::cityKey((string) $doc['city']),
            $doc,
        );
    }

    /** In einer neuen Straße darf nur der Anlegende Grundstücke besitzen. */
    private function sanitizeNewStreet(array $doc, string $playerId): array
    {
        foreach ($doc['plots'] as $i => $plot) {
            if (isset($plot['ownerId']) && $plot['ownerId'] !== $playerId) {
                unset($doc['plots'][$i]['ownerId'], $doc['plots'][$i]['purchasedAt'], $doc['plots'][$i]['building'], $doc['plots'][$i]['amenity']);
            }
        }
        $doc['plots'] = array_values($doc['plots']);

        return $doc;
    }

    /**
     * Wer zuerst kommt: Jede Straße gehört nur einem Spieler – erkannt an der Karten-Kennung
     * und, auch ohne Kartenprüfung, an Name + Ort („Bahnhofstr.“ = „Bahnhofstraße“).
     */
    private function assertStreetFree(array $doc, ?string $exceptStreetId): void
    {
        $osmKey = Documents::osmKey($doc);
        if (null !== $osmKey) {
            $taken = $this->em->getRepository(Street::class)->findOneBy(['osmKey' => $osmKey]);
            if ($taken instanceof Street && $taken->getId() !== $exceptStreetId) {
                $this->throwStreetTaken($taken);
            }
        }
        $name = Street::nameKey((string) ($doc['name'] ?? ''));
        $sameCity = $this->em->createQueryBuilder()
            ->select('s')->from(Street::class, 's')
            ->where('s.cityKey = :city')->andWhere('s.controllerId IS NULL')
            ->setParameter('city', Street::cityKey((string) ($doc['city'] ?? '')))
            ->getQuery()->getResult();
        foreach ($sameCity as $street) {
            if ($street->getId() !== $exceptStreetId && Street::nameKey((string) ($street->getData()['name'] ?? '')) === $name) {
                $this->throwStreetTaken($street);
            }
        }
    }

    private function throwStreetTaken(?Street $taken): never
    {
        $owner = $taken ? $this->em->find(Player::class, $taken->getOwnerId()) : null;
        throw new StreetTakenException($owner?->getName());
    }

    /** Merkt sich fremde Straßen, in denen der Spieler Grundstücke hat (für den Spielstart). */
    private function syncShares(Street $street, string $playerId): void
    {
        if ($street->isManagedBy($playerId)) {
            return;
        }
        $owns = false;
        foreach ((array) ($street->getData()['plots'] ?? []) as $plot) {
            $owns = $owns || StreetMerger::plotOwner($plot, $street->getOwnerId()) === $playerId;
        }
        $share = $this->em->find(StreetShare::class, ['streetId' => $street->getId(), 'playerId' => $playerId]);
        if ($owns && null === $share) {
            $this->em->persist(new StreetShare($street->getId(), $playerId));
        } elseif (!$owns && null !== $share) {
            $this->em->remove($share);
        }
    }

    /** Zwei gleichzeitige Anmeldungen für dieselbe Straße: die zweite verliert. */
    private function flush(): void
    {
        try {
            $this->em->flush();
        } catch (UniqueConstraintViolationException) {
            $this->throwStreetTaken(null);
        }
    }
}
