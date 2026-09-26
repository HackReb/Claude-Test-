<?php

namespace App\Controller;

use App\Entity\Neighborhood;
use App\Entity\Player;
use App\Entity\Street;
use App\Entity\StreetShare;
use App\Service\Auth;
use App\Service\Credentials;
use App\Service\Documents;
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
        $this->assertStreetFree(Documents::osmKey($streetDoc), null);

        $token = Credentials::newToken();
        $recoveryCode = Credentials::newRecoveryCode();
        $player = new Player($playerId, $playerDoc['name'], Credentials::hash($token), Credentials::hash($recoveryCode), $playerDoc);
        $player->setData($playerDoc);
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
        $player = $this->auth->player($request);
        $playerId = $player->getId();
        $streets = $this->em->getRepository(Street::class);

        foreach ([...$streets->findBy(['ownerId' => $playerId]), ...$streets->findBy(['controllerId' => $playerId])] as $street) {
            $this->em->remove($street);
        }
        foreach ($this->em->getRepository(StreetShare::class)->findBy(['playerId' => $playerId]) as $share) {
            $street = $this->em->find(Street::class, $share->getStreetId());
            if ($street instanceof Street) {
                $street->setData($this->releasePlots($street->getData(), $playerId));
            }
            $this->em->remove($share);
        }
        $hood = $this->em->find(Neighborhood::class, $playerId);
        if (null !== $hood) {
            $this->em->remove($hood);
        }
        $this->em->remove($player);
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
                $this->assertStreetFree(Documents::osmKey($doc), null);
            }
            $street = $this->newStreet($this->sanitizeNewStreet($doc, $playerId), $own ? null : $playerId);
            $this->em->persist($street);
        } else {
            $manages = $street->isManagedBy($playerId);
            $merged = $this->merger->merge($street->getData(), $doc, $playerId, $manages);
            if ($manages && !$street->isBotStreet()) {
                $osmKey = Documents::osmKey($merged);
                $this->assertStreetFree($osmKey, $street->getId());
                $street->setOsmKey($osmKey);
            }
            $street->setData($merged);
        }
        $this->syncShares($street, $playerId);
        $this->flush();

        return new JsonResponse($this->streetEntry($street));
    }

    /** Straßen anderer Spieler im selben Ort – dort kann man Grundstücke kaufen. */
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
        ];
    }

    /** Straße plus Name des Besitzers (bei Spieler-Straßen). */
    private function streetEntry(Street $street): array
    {
        $owner = $street->isBotStreet() ? null : $this->em->find(Player::class, $street->getOwnerId());

        return ['street' => $street->getData(), 'ownerName' => $owner?->getName()];
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

    /** Wer zuerst kommt: Eine echte Straße gehört nur einem Spieler. */
    private function assertStreetFree(?string $osmKey, ?string $exceptStreetId): void
    {
        if (null === $osmKey) {
            return;
        }
        $taken = $this->em->getRepository(Street::class)->findOneBy(['osmKey' => $osmKey]);
        if ($taken instanceof Street && $taken->getId() !== $exceptStreetId) {
            $this->throwStreetTaken($taken);
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

    private function releasePlots(array $doc, string $playerId): array
    {
        foreach ((array) ($doc['plots'] ?? []) as $i => $plot) {
            if (($plot['ownerId'] ?? null) === $playerId) {
                $doc['plots'][$i] = array_intersect_key($plot, array_flip(['id', 'size', 'side', 'index', 'price']));
            }
        }

        return $doc;
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
