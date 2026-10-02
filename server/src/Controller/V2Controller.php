<?php

namespace App\Controller;

use App\Entity\Account;
use App\Entity\Street as StreetV1;
use App\Entity\V2\Member;
use App\Entity\V2\Shop;
use App\Entity\V2\Street;
use App\Service\Auth;
use App\Service\Credentials;
use App\Service\Documents;
use App\Service\ShopTypes;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\Routing\Attribute\Route;

/**
 * Babo v2: Ein Konto wählt genau eine Straße und bekommt dort einen Platz in der Mall (bis zu drei Läden).
 * Angemeldet wird wie in v1 mit der Konto-Sitzung (Authorization: Bearer …); die v1-Spielstände bleiben unberührt.
 */
#[Route('/api/v2')]
final class V2Controller
{
    private const SHOP_NAME_MAX = 24;
    private const STREET_NAME_MAX = 80;
    /** Sortiment je Laden, davon im Schaufenster; Waren im Schrank eines Spielers. */
    private const ITEMS_MAX = 12;
    private const SHOWCASE_MAX = 6;
    private const INVENTORY_MAX = 200;
    private const PRICE_MIN = 10;
    private const PRICE_MAX = 5000;

    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly Auth $auth,
    ) {
    }

    /** Wo stehe ich? Ohne Straße: nur das Konto – dann muss erst eine gewählt werden. */
    #[Route('/me', methods: ['GET'])]
    public function me(Request $request): JsonResponse
    {
        $account = $this->auth->account($request);
        $member = $this->memberOf($account);

        return new JsonResponse($this->state($account, $member));
    }

    /**
     * Straße wählen: gibt es sie schon, tritt man bei (solange Platz ist), sonst gründet man sie.
     * Ein Konto hat genau eine Straße – wer schon eine hat, bekommt sie zurück.
     */
    #[Route('/join', methods: ['POST'])]
    public function join(Request $request): JsonResponse
    {
        $account = $this->auth->account($request);
        if (null !== $this->memberOf($account)) {
            throw new ConflictHttpException('Du gehörst schon zu einer Straße.');
        }
        $body = Documents::json($request->getContent());
        $name = self::clean((string) ($body['name'] ?? ''), self::STREET_NAME_MAX);
        $city = self::clean((string) ($body['city'] ?? ''), 80);
        if ('' === $name || '' === $city) {
            throw new BadRequestHttpException('Straße und Ort fehlen.');
        }
        $osm = is_array($body['osm'] ?? null) ? $body['osm'] : null;
        $osmKey = is_string($osm['key'] ?? null) && '' !== $osm['key'] ? mb_substr($osm['key'], 0, 190) : null;

        $streets = $this->em->getRepository(Street::class);
        $street = null !== $osmKey ? $streets->findOneBy(['osmKey' => $osmKey]) : null;
        $street ??= $streets->findOneBy(['cityKey' => StreetV1::cityKey($city), 'nameKey' => StreetV1::nameKey($name)]);
        if (!$street instanceof Street) {
            $street = new Street(Credentials::newToken(), $name, $city, $osmKey, $account->getId(), null !== $osm ? ['osm' => $osm] : []);
            $this->em->persist($street);
        } elseif (\count($this->membersOf($street)) >= Street::MAX_MEMBERS) {
            throw new ConflictHttpException(\sprintf('Die %s ist voll – %d Spieler sind das Maximum. Nimm eine Straße in der Nähe.', $street->getName(), Street::MAX_MEMBERS));
        }

        $member = new Member(Credentials::newToken(), $street->getId(), $account->getId(), $account->getName(), is_array($body['data'] ?? null) ? $body['data'] : []);
        $this->em->persist($member);
        $street->touch();
        $this->em->flush();

        return new JsonResponse($this->state($account, $member), 201);
    }

    /** Die Straße verlassen – Läden sind dann weg, der Platz wird frei. */
    #[Route('/leave', methods: ['POST'])]
    public function leave(Request $request): JsonResponse
    {
        $account = $this->auth->account($request);
        $member = $this->memberOf($account);
        if ($member instanceof Member) {
            foreach ($this->em->getRepository(Shop::class)->findBy(['memberId' => $member->getId()]) as $shop) {
                $this->em->remove($shop);
            }
            $this->em->remove($member);
            $this->em->flush();
        }

        return new JsonResponse($this->state($account, null));
    }

    /** Eigenen Spielstand speichern (Münzen, Figur …). */
    #[Route('/me', methods: ['PUT'])]
    public function save(Request $request): JsonResponse
    {
        $account = $this->auth->account($request);
        $member = $this->requireMember($account);
        $data = Documents::json($request->getContent())['data'] ?? null;
        if (!is_array($data)) {
            throw new BadRequestHttpException('Spielstand fehlt.');
        }
        $member->setData($data);
        $this->em->flush();

        return new JsonResponse(['ok' => true]);
    }

    /** Laden eröffnen: Typ, Name, Fassade. Höchstens drei pro Spieler. */
    #[Route('/shops', methods: ['POST'])]
    public function openShop(Request $request): JsonResponse
    {
        $account = $this->auth->account($request);
        $member = $this->requireMember($account);
        $body = Documents::json($request->getContent());
        $type = (string) ($body['type'] ?? '');
        if (!ShopTypes::isValid($type)) {
            throw new BadRequestHttpException('Diesen Ladentyp gibt es nicht.');
        }
        $name = self::shopName((string) ($body['name'] ?? ''));
        if (\count($this->em->getRepository(Shop::class)->findBy(['memberId' => $member->getId()])) >= ShopTypes::MAX_PER_MEMBER) {
            throw new ConflictHttpException(\sprintf('Höchstens %d Läden pro Spieler.', ShopTypes::MAX_PER_MEMBER));
        }
        $shop = new Shop(Credentials::newToken(), $member->getStreetId(), $member->getId(), $type, $name, self::look($body['look'] ?? 0), []);
        $this->em->persist($shop);
        $this->em->flush();

        return new JsonResponse(['shop' => $shop->toArray()] + $this->state($account, $member), 201);
    }

    /** Namen, Fassade oder Daten (Sortiment, Kasse) eines eigenen Ladens ändern. */
    #[Route('/shops/{id}', methods: ['PUT'])]
    public function updateShop(string $id, Request $request): JsonResponse
    {
        $account = $this->auth->account($request);
        $member = $this->requireMember($account);
        $shop = $this->ownShop($member, $id);
        $body = Documents::json($request->getContent());
        if (array_key_exists('name', $body)) {
            $shop->setName(self::shopName((string) $body['name']));
        }
        if (array_key_exists('look', $body)) {
            $shop->setLook(self::look($body['look']));
        }
        if (is_array($body['data'] ?? null)) {
            $shop->setData(self::checkedShopData($body['data']));
        }
        $this->em->flush();

        return new JsonResponse(['shop' => $shop->toArray()]);
    }

    /**
     * Eine Ware aus dem Schaufenster eines anderen Spielers kaufen: Münzen wandern zum Verkäufer,
     * die Ware ins eigene Inventar. Der Server bucht, damit niemand sich etwas dazuschummelt.
     */
    #[Route('/shops/{id}/buy', methods: ['POST'])]
    public function buy(string $id, Request $request): JsonResponse
    {
        $account = $this->auth->account($request);
        $buyer = $this->requireMember($account);
        $shop = $this->em->find(Shop::class, $id);
        if (!$shop instanceof Shop) {
            throw new NotFoundHttpException('Laden nicht gefunden.');
        }
        if ($shop->getMemberId() === $buyer->getId()) {
            throw new BadRequestHttpException('Im eigenen Laden kaufst du nicht ein.');
        }
        $itemId = (string) (Documents::json($request->getContent())['itemId'] ?? '');
        $data = $shop->getData();
        $items = is_array($data['items'] ?? null) ? $data['items'] : [];
        $index = null;
        foreach ($items as $i => $item) {
            if (is_array($item) && ($item['id'] ?? null) === $itemId && ($item['showcase'] ?? false)) {
                $index = $i;
            }
        }
        if (null === $index) {
            throw new NotFoundHttpException('Diese Ware liegt nicht im Schaufenster.');
        }
        $item = $items[$index];
        $price = max(0, (int) ($item['price'] ?? 0));
        $buyerData = $buyer->getData();
        $coins = (int) ($buyerData['coins'] ?? 0);
        if ($coins < $price) {
            throw new ConflictHttpException(\sprintf('Dafür fehlen dir 🪙 %d.', $price - $coins));
        }
        $inventory = is_array($buyerData['inventory'] ?? null) ? $buyerData['inventory'] : [];
        if (\count($inventory) >= self::INVENTORY_MAX) {
            throw new ConflictHttpException('Dein Schrank ist voll.');
        }
        $owned = [
            'id' => Credentials::newToken(),
            'itemId' => $itemId,
            'shopId' => $shop->getId(),
            'shopName' => $shop->getName(),
            'name' => (string) ($item['name'] ?? 'Ware'),
            'design' => $item['design'] ?? null,
            'price' => $price,
            'boughtAt' => (int) floor(microtime(true) * 1000),
        ];
        $inventory[] = $owned;
        $buyerData['coins'] = $coins - $price;
        $buyerData['inventory'] = $inventory;
        $buyer->setData($buyerData);

        $seller = $this->em->find(Member::class, $shop->getMemberId());
        if ($seller instanceof Member) {
            $sellerData = $seller->getData();
            $sellerData['coins'] = (int) ($sellerData['coins'] ?? 0) + $price;
            $sellerData['sales'] = (int) ($sellerData['sales'] ?? 0) + 1;
            $seller->setData($sellerData);
        }
        $items[$index]['sold'] = (int) ($item['sold'] ?? 0) + 1;
        $data['items'] = $items;
        $shop->setData($data);
        $this->em->flush();

        return new JsonResponse(['bought' => $owned, 'shop' => $shop->toArray()] + $this->state($account, $buyer));
    }

    #[Route('/shops/{id}', methods: ['DELETE'])]
    public function closeShop(string $id, Request $request): JsonResponse
    {
        $account = $this->auth->account($request);
        $member = $this->requireMember($account);
        $this->em->remove($this->ownShop($member, $id));
        $this->em->flush();

        return new JsonResponse($this->state($account, $member));
    }

    /** Eine andere Straße ansehen (zum Bummeln). */
    #[Route('/streets/{id}', methods: ['GET'])]
    public function street(string $id, Request $request): JsonResponse
    {
        $this->auth->account($request);
        $street = $this->em->find(Street::class, $id);
        if (!$street instanceof Street) {
            throw new NotFoundHttpException('Straße nicht gefunden.');
        }

        return new JsonResponse(['street' => $this->describeStreet($street)]);
    }

    // ---------- Hilfen ----------

    private function state(Account $account, ?Member $member): array
    {
        $result = ['account' => ['id' => $account->getId(), 'name' => $account->getName()], 'member' => null, 'street' => null];
        if ($member instanceof Member) {
            $street = $this->em->find(Street::class, $member->getStreetId());
            $result['member'] = [
                'id' => $member->getId(),
                'name' => $member->getName(),
                'joinedAt' => (int) $member->getJoinedAt()->format('Uv'),
                'data' => (object) $member->getData(),
            ];
            $result['street'] = $street instanceof Street ? $this->describeStreet($street) : null;
        }

        return $result;
    }

    private function describeStreet(Street $street): array
    {
        $shops = $this->em->getRepository(Shop::class)->findBy(['streetId' => $street->getId()], ['createdAt' => 'ASC']);

        return [
            'id' => $street->getId(),
            'name' => $street->getName(),
            'city' => $street->getCity(),
            'osm' => $street->getData()['osm'] ?? null,
            'founderAccountId' => $street->getFounderAccountId(),
            'foundedAt' => (int) $street->getCreatedAt()->format('Uv'),
            'maxMembers' => Street::MAX_MEMBERS,
            'members' => array_map(
                fn (Member $m) => [
                    'id' => $m->getId(),
                    'name' => $m->getName(),
                    'joinedAt' => (int) $m->getJoinedAt()->format('Uv'),
                    // Die Figur sehen alle – so erkennt man, wer was trägt.
                    'figure' => is_array($m->getData()['figure'] ?? null) ? $m->getData()['figure'] : null,
                ],
                $this->membersOf($street),
            ),
            'shops' => array_map(fn (Shop $s) => $s->toArray(), $shops),
        ];
    }

    /** @return list<Member> */
    private function membersOf(Street $street): array
    {
        return $this->em->getRepository(Member::class)->findBy(['streetId' => $street->getId()], ['joinedAt' => 'ASC']);
    }

    private function memberOf(Account $account): ?Member
    {
        return $this->em->getRepository(Member::class)->findOneBy(['accountId' => $account->getId()]);
    }

    private function requireMember(Account $account): Member
    {
        $member = $this->memberOf($account);
        if (!$member instanceof Member) {
            throw new ConflictHttpException('Wähl zuerst deine Straße.');
        }

        return $member;
    }

    private function ownShop(Member $member, string $id): Shop
    {
        $shop = $this->em->find(Shop::class, $id);
        if (!$shop instanceof Shop) {
            throw new NotFoundHttpException('Laden nicht gefunden.');
        }
        if ($shop->getMemberId() !== $member->getId()) {
            throw new AccessDeniedHttpException('Das ist nicht dein Laden.');
        }

        return $shop;
    }

    /** Sortiment prüfen: Anzahl, Schaufenster, Preise, Namen – das Design selbst bleibt Sache des Spiels. */
    private static function checkedShopData(array $data): array
    {
        if (strlen((string) json_encode($data)) > 40000) {
            throw new BadRequestHttpException('Das Sortiment ist zu groß.');
        }
        $items = is_array($data['items'] ?? null) ? array_values($data['items']) : [];
        if (\count($items) > self::ITEMS_MAX) {
            throw new BadRequestHttpException(\sprintf('Höchstens %d Waren je Laden.', self::ITEMS_MAX));
        }
        $showcase = 0;
        foreach ($items as &$item) {
            if (!is_array($item) || !is_string($item['id'] ?? null)) {
                throw new BadRequestHttpException('Ungültige Ware.');
            }
            $item['name'] = self::clean((string) ($item['name'] ?? ''), self::SHOP_NAME_MAX);
            if (mb_strlen($item['name']) < 2) {
                throw new BadRequestHttpException('Jede Ware braucht einen Namen.');
            }
            $item['price'] = min(self::PRICE_MAX, max(self::PRICE_MIN, (int) ($item['price'] ?? self::PRICE_MIN)));
            $item['showcase'] = (bool) ($item['showcase'] ?? false);
            $showcase += $item['showcase'] ? 1 : 0;
        }
        unset($item);
        if ($showcase > self::SHOWCASE_MAX) {
            throw new BadRequestHttpException(\sprintf('Höchstens %d Waren im Schaufenster.', self::SHOWCASE_MAX));
        }
        $data['items'] = $items;

        return $data;
    }

    private static function shopName(string $name): string
    {
        $name = self::clean($name, self::SHOP_NAME_MAX);
        if (mb_strlen($name) < 2) {
            throw new BadRequestHttpException('Der Laden braucht einen Namen (2 bis 24 Zeichen).');
        }

        return $name;
    }

    private static function look(mixed $look): int
    {
        $value = (int) $look;
        if ($value < 0 || $value >= ShopTypes::LOOKS) {
            throw new BadRequestHttpException('Diese Fassade gibt es nicht.');
        }

        return $value;
    }

    private static function clean(string $value, int $max): string
    {
        return mb_substr((string) preg_replace('/\s+/u', ' ', trim(strip_tags($value))), 0, $max);
    }
}
