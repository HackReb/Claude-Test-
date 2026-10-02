<?php

namespace App\Tests\Functional;

use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\Tools\SchemaTool;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

/** Babo v2: eine Straße pro Konto, gemeinsame Mall, bis zu drei Läden. */
final class V2Test extends WebTestCase
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

    private function account(string $name): string
    {
        $result = $this->call('POST', '/api/account/register', ['name' => $name, 'password' => 'geheim123']);
        self::assertSame(201, $this->httpStatus(), json_encode($result));

        return $result['token'];
    }

    private function bahnhofstrasse(): array
    {
        return ['name' => 'Bahnhofstraße', 'city' => 'Tuttlingen', 'osm' => ['key' => 'osm|de|78532|tuttlingen|bahnhofstraße', 'wayId' => 'W1', 'lat' => 47.98, 'lon' => 8.8]];
    }

    public function testJoinOnceAndShareTheStreet(): void
    {
        $kalle = $this->account('Kalle');
        self::assertNull($this->call('GET', '/api/v2/me', null, $kalle)['member']);

        $joined = $this->call('POST', '/api/v2/join', $this->bahnhofstrasse() + ['data' => ['coins' => 2000]], $kalle);
        self::assertSame(201, $this->httpStatus(), json_encode($joined));
        self::assertSame('Kalle', $joined['member']['name']);
        self::assertSame(['coins' => 2000], $joined['member']['data']);
        self::assertSame('Bahnhofstraße', $joined['street']['name']);
        self::assertSame(50, $joined['street']['maxMembers']);
        self::assertSame($joined['account']['id'], $joined['street']['founderAccountId']);

        // Nur eine Straße pro Konto.
        $this->call('POST', '/api/v2/join', ['name' => 'Schillerstraße', 'city' => 'Tuttlingen'], $kalle);
        self::assertSame(409, $this->httpStatus());

        // Zoe kommt in dieselbe Straße – über den Namen, auch ohne Kartenprüfung.
        $zoe = $this->account('Zoe');
        $zoeJoined = $this->call('POST', '/api/v2/join', ['name' => 'bahnhofstr.', 'city' => ' TUTTLINGEN'], $zoe);
        self::assertSame(201, $this->httpStatus(), json_encode($zoeJoined));
        self::assertSame($joined['street']['id'], $zoeJoined['street']['id']);
        self::assertSame(['Kalle', 'Zoe'], array_column($zoeJoined['street']['members'], 'name'));

        // Spielstand speichern
        $this->call('PUT', '/api/v2/me', ['data' => ['coins' => 1500, 'figure' => ['hat' => 'zylinder']]], $kalle);
        self::assertSame(200, $this->httpStatus());
        self::assertSame(1500, $this->call('GET', '/api/v2/me', null, $kalle)['member']['data']['coins']);
    }

    public function testShopsUpToThreeWithOwnNames(): void
    {
        $kalle = $this->account('Kalle');
        $this->call('POST', '/api/v2/shops', ['type' => 'baeckerei', 'name' => 'Kalles Brot'], $kalle);
        self::assertSame(409, $this->httpStatus(), 'erst Straße wählen');

        $this->call('POST', '/api/v2/join', $this->bahnhofstrasse(), $kalle);
        $opened = $this->call('POST', '/api/v2/shops', ['type' => 'baeckerei', 'name' => '  Kalles   Brot ', 'look' => 2], $kalle);
        self::assertSame(201, $this->httpStatus(), json_encode($opened));
        self::assertSame('Kalles Brot', $opened['shop']['name']);
        self::assertSame(2, $opened['shop']['look']);
        self::assertCount(1, $opened['street']['shops']);

        $this->call('POST', '/api/v2/shops', ['type' => 'tankstelle', 'name' => 'Gibt es nicht'], $kalle);
        self::assertSame(400, $this->httpStatus());
        $this->call('POST', '/api/v2/shops', ['type' => 'kiosk', 'name' => 'X'], $kalle);
        self::assertSame(400, $this->httpStatus(), 'Name zu kurz');

        $this->call('POST', '/api/v2/shops', ['type' => 'tierhandlung', 'name' => 'Dino & Co'], $kalle);
        $this->call('POST', '/api/v2/shops', ['type' => 'autohaus', 'name' => 'Flitzer'], $kalle);
        $this->call('POST', '/api/v2/shops', ['type' => 'kiosk', 'name' => 'Noch einer'], $kalle);
        self::assertSame(409, $this->httpStatus(), 'höchstens drei Läden');

        // Umbenennen, Sortiment speichern, schließen – nur eigene Läden.
        $shopId = $opened['shop']['id'];
        $renamed = $this->call('PUT', "/api/v2/shops/$shopId", ['name' => 'Brotzeit', 'data' => ['items' => [['id' => 'i1', 'name' => 'Brezel', 'price' => 20]]]], $kalle);
        self::assertSame('Brotzeit', $renamed['shop']['name']);
        self::assertSame('Brezel', $renamed['shop']['data']['items'][0]['name']);
        $this->call('PUT', "/api/v2/shops/$shopId", ['data' => ['items' => [['id' => 'i2']]]], $kalle);
        self::assertSame(400, $this->httpStatus(), 'Ware ohne Namen');

        $zoe = $this->account('Zoe');
        $this->call('POST', '/api/v2/join', $this->bahnhofstrasse(), $zoe);
        $this->call('PUT', "/api/v2/shops/$shopId", ['name' => 'Meins'], $zoe);
        self::assertSame(403, $this->httpStatus());
        $this->call('DELETE', "/api/v2/shops/$shopId", null, $zoe);
        self::assertSame(403, $this->httpStatus());

        $after = $this->call('DELETE', "/api/v2/shops/$shopId", null, $kalle);
        self::assertSame(['Dino & Co', 'Flitzer'], array_column($after['street']['shops'], 'name'));

        // Zoe sieht Kalles Läden in der gemeinsamen Mall.
        $view = $this->call('GET', '/api/v2/streets/'.$after['street']['id'], null, $zoe);
        self::assertSame(['tierhandlung', 'autohaus'], array_column($view['street']['shops'], 'type'));
    }

    public function testStreetIsFullAtFiftyAndLeavingFreesTheSpot(): void
    {
        for ($i = 1; $i <= 50; ++$i) {
            $this->call('POST', '/api/v2/join', ['name' => 'Ring', 'city' => 'Ulm'], $this->account("Spieler $i"));
            self::assertSame(201, $this->httpStatus(), "Spieler $i");
        }
        $late = $this->account('Zu spät');
        $result = $this->call('POST', '/api/v2/join', ['name' => 'Ring', 'city' => 'Ulm'], $late);
        self::assertSame(409, $this->httpStatus());
        self::assertStringContainsString('voll', $result['error']);

        // Einer geht – jetzt passt der Nächste wieder rein.
        $first = $this->call('POST', '/api/account/login', ['name' => 'Spieler 1', 'password' => 'geheim123'])['token'];
        self::assertNull($this->call('POST', '/api/v2/leave', null, $first)['member']);
        $this->call('POST', '/api/v2/join', ['name' => 'Ring', 'city' => 'Ulm'], $late);
        self::assertSame(201, $this->httpStatus());
    }

    public function testInventWareAndBuyIt(): void
    {
        $kalle = $this->account('Kalle');
        $this->call('POST', '/api/v2/join', $this->bahnhofstrasse() + ['data' => ['coins' => 2000]], $kalle);
        $shop = $this->call('POST', '/api/v2/shops', ['type' => 'dinoladen', 'name' => 'Dino & Co'], $kalle)['shop'];
        $dino = ['id' => 'w1', 'name' => 'Punkte-Dino', 'design' => ['slot' => 'pet', 'shape' => 'dino', 'colors' => ['#0f0', '#00f', '#fff'], 'pattern' => 'dots'], 'price' => 300, 'showcase' => true];
        $hidden = ['id' => 'w2', 'name' => 'Geheim-Dino', 'design' => ['slot' => 'pet', 'shape' => 'dino'], 'price' => 99999, 'showcase' => false];
        $saved = $this->call('PUT', "/api/v2/shops/{$shop['id']}", ['data' => ['items' => [$dino, $hidden]]], $kalle);
        self::assertSame(200, $this->httpStatus(), json_encode($saved));
        self::assertSame(5000, $saved['shop']['data']['items'][1]['price'], 'Preis wird auf den Rahmen gestutzt');

        // Zu viele im Schaufenster
        $many = array_map(fn ($i) => ['id' => "x$i", 'name' => "Ware $i", 'price' => 50, 'showcase' => true], range(1, 7));
        $this->call('PUT', "/api/v2/shops/{$shop['id']}", ['data' => ['items' => $many]], $kalle);
        self::assertSame(400, $this->httpStatus());

        $zoe = $this->account('Zoe');
        $this->call('POST', '/api/v2/join', $this->bahnhofstrasse() + ['data' => ['coins' => 500, 'figure' => ['base' => ['skin' => '#fff']]]], $zoe);
        $bought = $this->call('POST', "/api/v2/shops/{$shop['id']}/buy", ['itemId' => 'w1'], $zoe);
        self::assertSame(200, $this->httpStatus(), json_encode($bought));
        self::assertSame(200, $bought['member']['data']['coins']);
        self::assertSame('Punkte-Dino', $bought['bought']['name']);
        self::assertSame('Dino & Co', $bought['bought']['shopName']);
        self::assertSame('dots', $bought['member']['data']['inventory'][0]['design']['pattern']);
        self::assertSame(1, $bought['shop']['data']['items'][0]['sold']);
        self::assertSame(2300, $this->call('GET', '/api/v2/me', null, $kalle)['member']['data']['coins'], 'Verkäufer bekommt die Münzen');

        // Nicht im Schaufenster, zu teuer, eigener Laden
        $this->call('POST', "/api/v2/shops/{$shop['id']}/buy", ['itemId' => 'w2'], $zoe);
        self::assertSame(404, $this->httpStatus());
        $this->call('POST', "/api/v2/shops/{$shop['id']}/buy", ['itemId' => 'w1'], $zoe);
        self::assertSame(409, $this->httpStatus(), 'nur noch 200 Münzen');
        $this->call('POST', "/api/v2/shops/{$shop['id']}/buy", ['itemId' => 'w1'], $kalle);
        self::assertSame(400, $this->httpStatus(), 'eigener Laden');

        // Die Figur steht in der Mitgliederliste
        $members = $this->call('GET', '/api/v2/me', null, $kalle)['street']['members'];
        self::assertSame(['skin' => '#fff'], $members[1]['figure']['base']);
        self::assertNull($members[0]['figure']);
    }

    public function testNeedsAccount(): void
    {
        $this->call('GET', '/api/v2/me');
        self::assertSame(401, $this->httpStatus());
    }

    public function testStreetListAndNews(): void
    {
        $kalle = $this->account('Kalle');
        $zoe = $this->account('Zoe');
        $this->call('POST', '/api/v2/join', $this->bahnhofstrasse() + ['data' => ['coins' => 2000]], $kalle);
        $this->call('POST', '/api/v2/join', ['name' => 'Marktplatz', 'city' => 'Ulm', 'data' => ['coins' => 2000]], $zoe);
        $shopId = $this->call('POST', '/api/v2/shops', ['type' => 'hutmacher', 'name' => 'Kronen-Kalle', 'look' => 0], $kalle)['shop']['id'];
        $this->call('PUT', "/api/v2/shops/$shopId", ['data' => ['items' => [['id' => 'w1', 'name' => 'Krone', 'price' => 300, 'showcase' => true, 'design' => ['slot' => 'hat']]]]], $kalle);
        // Zoe bummelt: sieht beide Straßen, die Bahnhofstraße mit Laden, und kauft von auswärts.
        $streets = $this->call('GET', '/api/v2/streets', null, $zoe)['streets'];
        self::assertSame(['Bahnhofstraße', 'Marktplatz'], array_column($streets, 'name'), 'zuletzt aktive zuerst');
        self::assertSame(['members' => 1, 'shops' => 1], ['members' => $streets[0]['members'], 'shops' => $streets[0]['shops']]);
        self::assertSame(['Marktplatz'], array_column($this->call('GET', '/api/v2/streets?q=ulm', null, $zoe)['streets'], 'name'));
        $bought = $this->call('POST', "/api/v2/shops/$shopId/buy", ['itemId' => 'w1'], $zoe);
        self::assertSame(200, $this->httpStatus(), json_encode($bought));
        self::assertSame(1700, $bought['member']['data']['coins']);

        $streetId = $streets[0]['id'];
        $news = $this->call('GET', "/api/v2/streets/$streetId/news", null, $zoe)['news'];
        self::assertSame(['buy', 'item', 'shop', 'join'], array_column($news, 'kind'));
        self::assertSame('Zoe', $news[0]['data']['who']);
        self::assertTrue($news[0]['data']['visitor']);
        self::assertSame('Krone', $news[0]['data']['item']['name']);
        self::assertSame('Kronen-Kalle', $news[1]['data']['shopName']);
        self::assertSame('Kalle', $news[3]['data']['who']);
        // Ändern ohne neue Ware erzeugt keinen Eintrag; Laden schließen schon.
        $this->call('PUT', "/api/v2/shops/$shopId", ['data' => ['items' => [['id' => 'w1', 'name' => 'Krone', 'price' => 350, 'showcase' => false]]]], $kalle);
        $this->call('DELETE', "/api/v2/shops/$shopId", null, $kalle);
        $news = $this->call('GET', "/api/v2/streets/$streetId/news", null, $kalle)['news'];
        self::assertSame(['close', 'buy', 'item', 'shop', 'join'], array_column($news, 'kind'));
        $this->call('GET', '/api/v2/streets', null, null);
        self::assertSame(401, $this->httpStatus());
    }
}
