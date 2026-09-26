<?php

namespace App\Tests\Functional;

use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\Tools\SchemaTool;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

final class ApiTest extends WebTestCase
{
    private KernelBrowser $client;

    protected function setUp(): void
    {
        $this->client = self::createClient();
        $em = self::getContainer()->get(EntityManagerInterface::class);
        $tool = new SchemaTool($em);
        $metadata = $em->getMetadataFactory()->getAllMetadata();
        $tool->dropSchema($metadata);
        $tool->createSchema($metadata);
    }

    private function street(string $id, string $ownerId, ?string $osmKey = null, string $city = 'Tuttlingen'): array
    {
        $street = [
            'id' => $id,
            'name' => 'Bahnhofstraße',
            'city' => $city,
            'ownerId' => $ownerId,
            'plots' => [
                ['id' => "$id-p1", 'size' => 'S', 'side' => 'left', 'index' => 0, 'price' => 500, 'purchasedAt' => 1, 'gifted' => true],
                ['id' => "$id-p2", 'size' => 'M', 'side' => 'left', 'index' => 1, 'price' => 1500],
                ['id' => "$id-p3", 'size' => 'L', 'side' => 'right', 'index' => 0, 'price' => 4000],
            ],
        ];
        if (null !== $osmKey) {
            $street['osm'] = ['key' => $osmKey, 'wayId' => 'W1', 'lat' => 47.98, 'lon' => 8.8];
        }

        return $street;
    }

    private function player(string $id, string $name, string $streetId): array
    {
        return ['id' => $id, 'name' => $name, 'coins' => 1000, 'pendingRent' => 0, 'unlockedParts' => [], 'streetId' => $streetId, 'lastSeen' => 1];
    }

    private function call(string $method, string $uri, ?array $body = null, ?string $token = null): array
    {
        $headers = ['CONTENT_TYPE' => 'application/json', 'HTTP_ORIGIN' => 'https://babo.example'];
        if (null !== $token) {
            $headers['HTTP_AUTHORIZATION'] = "Bearer $token";
        }
        $this->client->request($method, $uri, [], [], $headers, null === $body ? '' : json_encode($body));

        return json_decode((string) $this->client->getResponse()->getContent(), true) ?? [];
    }

    private function httpStatus(): int
    {
        return $this->client->getResponse()->getStatusCode();
    }

    /** @return array{token: string, recoveryCode: string} */
    private function register(string $playerId, string $name, string $streetId, ?string $osmKey = null, array $extra = []): array
    {
        $result = $this->call('POST', '/api/register', [
            'player' => $this->player($playerId, $name, $streetId),
            'street' => $this->street($streetId, $playerId, $osmKey),
        ] + $extra);
        self::assertSame(201, $this->httpStatus(), json_encode($result));

        return $result;
    }

    public function testHealthWithCors(): void
    {
        self::assertSame(['ok' => true], $this->call('GET', '/api/health'));
        self::assertSame('https://babo.example', $this->client->getResponse()->headers->get('Access-Control-Allow-Origin'));

        $this->client->request('OPTIONS', '/api/me', [], [], ['HTTP_ORIGIN' => 'https://evil.example']);
        self::assertSame(204, $this->httpStatus());
        self::assertNull($this->client->getResponse()->headers->get('Access-Control-Allow-Origin'));
    }

    public function testRegisterLoadAndSave(): void
    {
        $auth = $this->register('player-kalle', 'Kalle', 'street-kalle', 'osm|de|78532|tuttlingen|bahnhofstraße');
        self::assertMatchesRegularExpression('/^BABO-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/', $auth['recoveryCode']);

        $me = $this->call('GET', '/api/me', null, $auth['token']);
        self::assertSame('Kalle', $me['player']['name']);
        self::assertSame('street-kalle', $me['street']['id']);
        self::assertSame([], $me['streets']);

        $player = $me['player'];
        $player['coins'] = 42;
        $this->call('PUT', '/api/me', ['player' => $player], $auth['token']);
        self::assertSame(200, $this->httpStatus());
        self::assertSame(42, $this->call('GET', '/api/me', null, $auth['token'])['player']['coins']);
    }

    public function testWithoutTokenIsUnauthorized(): void
    {
        $result = $this->call('GET', '/api/me', null, 'falsch');
        self::assertSame(401, $this->httpStatus());
        self::assertSame('Nicht angemeldet.', $result['error']);
    }

    public function testRealStreetBelongsToWhoeverComesFirst(): void
    {
        $this->register('player-kalle', 'Kalle', 'street-kalle', 'osm|de|78532|tuttlingen|bahnhofstraße');

        $result = $this->call('POST', '/api/register', [
            'player' => $this->player('player-zoe', 'Zoe', 'street-zoe'),
            'street' => $this->street('street-zoe', 'player-zoe', 'osm|de|78532|tuttlingen|bahnhofstraße'),
        ]);

        self::assertSame(409, $this->httpStatus());
        self::assertSame(['error' => 'street-taken', 'ownerName' => 'Kalle'], $result);
    }

    public function testBuyingInAnotherPlayersStreet(): void
    {
        $kalle = $this->register('player-kalle', 'Kalle', 'street-kalle', 'osm|kalle');
        $zoe = $this->register('player-zoe', 'Zoe', 'street-zoe', 'osm|zoe');

        // Zoe findet Kalles Straße im selben Ort …
        $city = $this->call('GET', '/api/city?name=tuttlingen', null, $zoe['token']);
        self::assertCount(1, $city['streets']);
        self::assertSame('Kalle', $city['streets'][0]['ownerName']);

        // … und kauft dort ein Grundstück.
        $street = $city['streets'][0]['street'];
        $street['plots'][1] += ['purchasedAt' => 10, 'ownerId' => 'player-zoe'];
        $saved = $this->call('PUT', '/api/streets/street-kalle', ['street' => $street], $zoe['token']);
        self::assertSame('player-zoe', $saved['street']['plots'][1]['ownerId']);

        // Max war zu langsam.
        $max = $this->register('player-max', 'Max', 'street-max');
        $late = $city['streets'][0]['street'];
        $late['plots'][1] += ['purchasedAt' => 11, 'ownerId' => 'player-max'];
        $result = $this->call('PUT', '/api/streets/street-kalle', ['street' => $late], $max['token']);
        self::assertSame('player-zoe', $result['street']['plots'][1]['ownerId']);

        // Kalle speichert einen alten Stand – Zoes Grundstück bleibt.
        $stale = $this->street('street-kalle', 'player-kalle', 'osm|kalle');
        $stale['name'] = 'Bahnhofstraße';
        $mine = $this->call('PUT', '/api/streets/street-kalle', ['street' => $stale], $kalle['token']);
        self::assertSame('player-zoe', $mine['street']['plots'][1]['ownerId']);

        // Zoe sieht die Straße beim nächsten Start (dort liegt ihre Miete).
        $me = $this->call('GET', '/api/me', null, $zoe['token']);
        self::assertSame(['street-kalle'], array_map(fn ($e) => $e['street']['id'], $me['streets']));
        self::assertSame('Kalle', $me['streets'][0]['ownerName']);
    }

    public function testBotStreetsAndNeighborhood(): void
    {
        $auth = $this->register('player-kalle', 'Kalle', 'street-kalle', null, [
            'neighborhood' => ['playerStreetId' => 'street-kalle', 'bots' => [], 'bearings' => [], 'news' => [], 'newsSeenAt' => 0],
            'streets' => [$this->street('street-bot-zoe', 'bot-zoe-1')],
        ]);

        $me = $this->call('GET', '/api/me', null, $auth['token']);
        self::assertSame('street-kalle', $me['neighborhood']['playerStreetId']);
        self::assertSame('street-bot-zoe', $me['streets'][0]['street']['id']);
        self::assertNull($me['streets'][0]['ownerName']);

        // Neue Bot-Straße anlegen und als Bot („Besitzer“ der Nachbarschaft) bebauen.
        $bot = $this->street('street-bot-max', 'bot-max-1');
        $this->call('PUT', '/api/streets/street-bot-max', ['street' => $bot], $auth['token']);
        self::assertSame(200, $this->httpStatus());
        $bot['plots'][2] += ['purchasedAt' => 3, 'building' => ['name' => 'Bot-Burg']];
        $saved = $this->call('PUT', '/api/streets/street-bot-max', ['street' => $bot], $auth['token']);
        self::assertSame('Bot-Burg', $saved['street']['plots'][2]['building']['name']);

        // Eine Straße im Namen eines anderen Spielers anlegen geht nicht.
        $other = $this->register('player-zoe', 'Zoe', 'street-zoe');
        $this->call('PUT', '/api/streets/street-fake', ['street' => $this->street('street-fake', 'player-zoe')], $auth['token']);
        self::assertSame(403, $this->httpStatus());
        self::assertNotEmpty($other['token']);
    }

    public function testRecoveryMovesToNewDevice(): void
    {
        $auth = $this->register('player-kalle', 'Kalle', 'street-kalle');

        $result = $this->call('POST', '/api/recover', ['code' => strtolower(str_replace('-', ' ', $auth['recoveryCode']))]);
        self::assertSame(200, $this->httpStatus());
        self::assertSame('Kalle', $result['player']['name']);
        self::assertNotSame($auth['token'], $result['token']);

        $this->call('GET', '/api/me', null, $auth['token']);
        self::assertSame(401, $this->httpStatus(), 'altes Gerät ist abgemeldet');
        $this->call('GET', '/api/me', null, $result['token']);
        self::assertSame(200, $this->httpStatus());

        $this->call('POST', '/api/recover', ['code' => 'BABO-AAAA-AAAA-AAAA']);
        self::assertSame(404, $this->httpStatus());
    }

    public function testDeleteFreesPlotsAndStreet(): void
    {
        $this->register('player-kalle', 'Kalle', 'street-kalle', 'osm|kalle');
        $zoe = $this->register('player-zoe', 'Zoe', 'street-zoe');
        $street = $this->street('street-kalle', 'player-kalle', 'osm|kalle');
        $street['plots'][1] += ['purchasedAt' => 10, 'ownerId' => 'player-zoe'];
        $this->call('PUT', '/api/streets/street-kalle', ['street' => $street], $zoe['token']);

        $this->call('DELETE', '/api/me', null, $zoe['token']);
        self::assertSame(200, $this->httpStatus());

        $max = $this->register('player-max', 'Max', 'street-max');
        $kalle = $this->call('GET', '/api/streets/street-kalle', null, $max['token']);
        self::assertArrayNotHasKey('ownerId', $kalle['street']['plots'][1]);
        self::assertArrayNotHasKey('purchasedAt', $kalle['street']['plots'][1]);

        // Zoes Straße ist gelöscht.
        $this->call('GET', '/api/streets/street-zoe', null, $max['token']);
        self::assertSame(404, $this->httpStatus());
    }

    public function testRejectsBrokenDocuments(): void
    {
        $this->call('POST', '/api/register', ['player' => ['id' => 'x']]);
        self::assertSame(400, $this->httpStatus());

        $this->client->request('POST', '/api/register', [], [], ['CONTENT_TYPE' => 'application/json'], '{kaputt');
        self::assertSame(400, $this->httpStatus());
    }
}
