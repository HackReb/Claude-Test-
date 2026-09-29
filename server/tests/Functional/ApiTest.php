<?php

namespace App\Tests\Functional;

use App\Entity\Player;
use App\Entity\Street;
use App\Entity\StreetShare;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\Tools\SchemaTool;
use Symfony\Bundle\FrameworkBundle\Console\Application;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\Console\Tester\CommandTester;

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
            'name' => "Weg $id",
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

    private function call(string $method, string $uri, ?array $body = null, ?string $token = null, ?string $playerId = null): array
    {
        $headers = ['CONTENT_TYPE' => 'application/json', 'HTTP_ORIGIN' => 'https://babo.example'];
        if (null !== $token) {
            $headers['HTTP_AUTHORIZATION'] = "Bearer $token";
        }
        if (null !== $playerId) {
            $headers['HTTP_X_BABO_PLAYER'] = $playerId;
        }
        $this->client->request($method, $uri, [], [], $headers, null === $body ? '' : json_encode($body));

        return json_decode((string) $this->client->getResponse()->getContent(), true) ?? [];
    }

    private function httpStatus(): int
    {
        return $this->client->getResponse()->getStatusCode();
    }

    /** Neues Konto, liefert den Sitzungs-Schlüssel. */
    private function account(string $name, string $password = 'geheim123'): string
    {
        $result = $this->call('POST', '/api/account/register', ['name' => $name, 'password' => $password]);
        self::assertSame(201, $this->httpStatus(), json_encode($result));

        return $result['token'];
    }

    /** @return array{token: string, recoveryCode: string} */
    private function register(string $playerId, string $name, string $streetId, ?string $osmKey = null, array $extra = [], ?string $session = null): array
    {
        $session ??= $this->account(mb_substr("Konto $playerId", 0, 20));
        $result = $this->call('POST', '/api/register', [
            'player' => $this->player($playerId, $name, $streetId),
            'street' => $this->street($streetId, $playerId, $osmKey),
        ] + $extra, $session);
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

        $zoe = $this->account('Zoe');
        $result = $this->call('POST', '/api/register', [
            'player' => $this->player('player-zoe', 'Zoe', 'street-zoe'),
            'street' => $this->street('street-zoe', 'player-zoe', 'osm|de|78532|tuttlingen|bahnhofstraße'),
        ], $zoe);

        self::assertSame(409, $this->httpStatus());
        self::assertSame(['error' => 'street-taken', 'ownerName' => 'Kalle'], $result);
    }

    public function testStreetOnlyOnceEvenWithoutMapCheck(): void
    {
        $this->register('player-kalle', 'Kalle', 'street-kalle');
        $zoe = $this->account('Zoe');
        // Gleicher Name, gleicher Ort, nur anders geschrieben – ohne Kartenprüfung.
        $street = ['name' => 'weg street-KALLE ', 'city' => ' tuttlingen'] + $this->street('street-zoe', 'player-zoe');
        $result = $this->call('POST', '/api/register', ['player' => $this->player('player-zoe', 'Zoe', 'street-zoe'), 'street' => $street], $zoe);
        self::assertSame(409, $this->httpStatus());
        self::assertSame('Kalle', $result['ownerName']);

        // Anderer Ort – kein Problem.
        $street['city'] = 'Ulm';
        $this->call('POST', '/api/register', ['player' => $this->player('player-zoe', 'Zoe', 'street-zoe'), 'street' => $street], $zoe);
        self::assertSame(201, $this->httpStatus());
    }

    public function testAccountWithUpToThreeStreets(): void
    {
        $session = $this->account('Papa Matthias');
        $this->call('POST', '/api/account/register', ['name' => 'papa  matthias', 'password' => 'andersrum']);
        self::assertSame(409, $this->httpStatus(), 'Name schon vergeben (Groß-/Kleinschreibung egal)');
        $this->call('POST', '/api/account/register', ['name' => 'Ab', 'password' => 'geheim123']);
        self::assertSame(400, $this->httpStatus());

        foreach (['a', 'b', 'c'] as $i => $x) {
            $this->register("player-$x", 'Matthias', "street-$x", null, [], $session);
            self::assertCount($i + 1, $this->call('GET', '/api/account', null, $session)['streets']);
        }
        $this->call('POST', '/api/register', [
            'player' => $this->player('player-d', 'Matthias', 'street-d'),
            'street' => $this->street('street-d', 'player-d'),
        ], $session);
        self::assertSame(409, $this->httpStatus(), 'höchstens drei Straßen');

        // Spielen mit Sitzung + gewählter Straße
        $me = $this->call('GET', '/api/me', null, $session, 'player-b');
        self::assertSame('street-b', $me['street']['id']);
        $zoe = $this->register('player-zoe', 'Zoe', 'street-zoe');
        $this->call('GET', '/api/me', null, $session, 'player-zoe');
        self::assertSame(403, $this->httpStatus(), 'fremde Straße');

        // Straße löschen macht wieder Platz
        $this->call('DELETE', '/api/me', null, $session, 'player-c');
        self::assertCount(2, $this->call('GET', '/api/account', null, $session)['streets']);

        // Anmelden auf einem anderen Gerät, Abmelden
        $this->call('POST', '/api/account/login', ['name' => 'PAPA MATTHIAS', 'password' => 'falsch']);
        self::assertSame(401, $this->httpStatus());
        $login = $this->call('POST', '/api/account/login', ['name' => 'PAPA MATTHIAS', 'password' => 'geheim123']);
        self::assertSame(['Weg street-a', 'Weg street-b'], array_column($login['streets'], 'streetName'));
        $this->call('POST', '/api/account/logout', null, $login['token']);
        $this->call('GET', '/api/account', null, $login['token']);
        self::assertSame(401, $this->httpStatus());
        $this->call('GET', '/api/account', null, $session);
        self::assertSame(200, $this->httpStatus(), 'das andere Gerät bleibt angemeldet');
        self::assertNotEmpty($zoe['token']);
    }

    public function testOldSaveMovesIntoAccountAndMoreViaCode(): void
    {
        // Zwei alte Spielstände ohne Konto (wie vor den Konten) …
        $first = $this->register('player-a', 'Kalle', 'street-a');
        $second = $this->register('player-b', 'Kalle', 'street-b');
        $em = self::getContainer()->get(EntityManagerInterface::class);
        foreach (['player-a', 'player-b'] as $id) {
            $em->find(Player::class, $id)->setAccountId(null);
        }
        $em->flush();

        // … das erste Gerät richtet ein Konto ein und bringt seinen Spielstand mit.
        $result = $this->call('POST', '/api/account/register', ['name' => 'Kalle', 'password' => 'geheim123'], $first['token']);
        self::assertSame(['street-a'], array_column($result['streets'], 'streetId'));
        $session = $result['token'];

        // Den zweiten hängt man mit seinem BABO-Code an.
        $this->call('POST', '/api/account/attach', ['code' => 'BABO-AAAA-AAAA-AAAA'], $session);
        self::assertSame(404, $this->httpStatus());
        $attached = $this->call('POST', '/api/account/attach', ['code' => $second['recoveryCode']], $session);
        self::assertSame(['street-a', 'street-b'], array_column($attached['streets'], 'streetId'));

        // Ein anderes Konto kann ihn nicht mehr klauen.
        $this->call('POST', '/api/account/attach', ['code' => $second['recoveryCode']], $this->account('Dieb'));
        self::assertSame(409, $this->httpStatus());

        // Der alte Geräte-Schlüssel funktioniert weiter, bis das Gerät sich anmeldet.
        $this->call('GET', '/api/me', null, $second['token']);
        self::assertSame(200, $this->httpStatus());
    }

    public function testMoveFromSqliteFile(): void
    {
        $session = $this->account('Papa Matthias');
        $this->register('player-a', 'Matthias', 'street-a', null, [], $session);
        $this->register('player-b', 'Zoe', 'street-b');
        $dir = self::getContainer()->getParameter('kernel.project_dir');
        $copy = $dir.'/var/umzug-test.db';
        copy($dir.'/var/test.db', $copy);

        $tester = new CommandTester((new Application(self::$kernel))->find('babo:db-umzug'));
        self::assertSame(1, $tester->execute(['--von' => $dir.'/var/fehlt.db']));
        self::assertSame(1, $tester->execute(['--von' => $copy]), 'Ziel nicht leer');
        self::assertStringContainsString('--ueberschreiben', $tester->getDisplay());
        self::assertSame(0, $tester->execute(['--von' => $copy, '--ueberschreiben' => true]), $tester->getDisplay());
        unlink($copy);

        // Nach dem Umzug geht alles wie vorher: anmelden, Straßen sehen, spielen.
        $login = $this->call('POST', '/api/account/login', ['name' => 'Papa Matthias', 'password' => 'geheim123']);
        self::assertSame(['street-a'], array_column($login['streets'], 'streetId'));
        self::assertSame('street-a', $this->call('GET', '/api/me', null, $login['token'], 'player-a')['street']['id']);
    }

    public function testNewStreetNeedsAccount(): void
    {
        $this->call('POST', '/api/register', [
            'player' => $this->player('player-x', 'X', 'street-x'),
            'street' => $this->street('street-x', 'player-x'),
        ]);
        self::assertSame(401, $this->httpStatus());
    }

    /** Grundstück aus früheren Regeln (v2), als man noch bei anderen kaufen konnte – direkt in der Datenbank. */
    private function plantLegacyPlot(string $streetId, int $plot, string $playerId): void
    {
        $em = self::getContainer()->get(EntityManagerInterface::class);
        $street = $em->find(Street::class, $streetId);
        $data = $street->getData();
        $data['plots'][$plot] += ['purchasedAt' => 10, 'ownerId' => $playerId, 'building' => ['name' => 'Alt']];
        $street->setData($data);
        $em->persist(new StreetShare($streetId, $playerId));
        $em->flush();
        $em->clear();
    }

    public function testOtherPlayersStreetsCanBeSeenButNotBought(): void
    {
        $kalle = $this->register('player-kalle', 'Kalle', 'street-kalle', 'osm|kalle');
        $zoe = $this->register('player-zoe', 'Zoe', 'street-zoe', 'osm|zoe');

        // Zoe findet Kalles Straße im selben Ort …
        $city = $this->call('GET', '/api/city?name=tuttlingen', null, $zoe['token']);
        self::assertCount(1, $city['streets']);
        self::assertSame('Kalle', $city['streets'][0]['ownerName']);

        // … kaufen kann sie dort aber nicht.
        $street = $city['streets'][0]['street'];
        $street['plots'][1] += ['purchasedAt' => 10, 'ownerId' => 'player-zoe'];
        $saved = $this->call('PUT', '/api/streets/street-kalle', ['street' => $street], $zoe['token']);
        self::assertArrayNotHasKey('ownerId', $saved['street']['plots'][1]);
        self::assertArrayNotHasKey('purchasedAt', $saved['street']['plots'][1]);
        self::assertNotEmpty($kalle['token']);
    }

    public function testOldPlotsInOtherStreetsAreReleased(): void
    {
        $kalle = $this->register('player-kalle', 'Kalle', 'street-kalle', 'osm|kalle');
        $zoe = $this->register('player-zoe', 'Zoe', 'street-zoe', 'osm|zoe');
        $this->plantLegacyPlot('street-kalle', 1, 'player-zoe');

        // Zoes Spiel sieht die Straße beim Start (mit Namen) …
        $me = $this->call('GET', '/api/me', null, $zoe['token']);
        self::assertSame(['street-kalle'], array_map(fn ($e) => $e['street']['id'], $me['streets']));
        self::assertSame(['player-zoe' => 'Zoe'], $me['streets'][0]['names']);

        // … Kalle kann das alte Grundstück nicht überschreiben …
        $stale = $this->street('street-kalle', 'player-kalle', 'osm|kalle');
        $mine = $this->call('PUT', '/api/streets/street-kalle', ['street' => $stale], $kalle['token']);
        self::assertSame('player-zoe', $mine['street']['plots'][1]['ownerId']);

        // … Zoe gibt es frei (Regeln v3) und die Straße verschwindet aus ihrem Spielstand.
        $release = $this->call('PUT', '/api/streets/street-kalle', ['street' => $stale], $zoe['token']);
        self::assertArrayNotHasKey('ownerId', $release['street']['plots'][1]);
        self::assertSame([], $this->call('GET', '/api/me', null, $zoe['token'])['streets']);
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

    public function testNewCodeCommandWhenPhoneIsLost(): void
    {
        $old = $this->register('player-maxim', 'Maxim', 'street-maxim');
        $this->register('player-kalle', 'Kalle', 'street-kalle');
        $tester = new CommandTester((new Application(self::$kernel))->find('babo:neuer-code'));

        self::assertSame(1, $tester->execute(['spieler' => 'Niemand']));
        self::assertSame(0, $tester->execute(['spieler' => 'maxim']));
        self::assertMatchesRegularExpression('/BABO-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}/', $tester->getDisplay());
        preg_match('/BABO-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}/', $tester->getDisplay(), $match);

        $this->call('POST', '/api/recover', ['code' => $old['recoveryCode']]);
        self::assertSame(404, $this->httpStatus(), 'alter Code gilt nicht mehr');
        $result = $this->call('POST', '/api/recover', ['code' => $match[0]]);
        self::assertSame(200, $this->httpStatus());
        self::assertSame('Maxim', $result['player']['name']);
    }

    public function testDeleteFreesPlotsAndStreet(): void
    {
        $this->register('player-kalle', 'Kalle', 'street-kalle', 'osm|kalle');
        $zoe = $this->register('player-zoe', 'Zoe', 'street-zoe');
        $this->plantLegacyPlot('street-kalle', 1, 'player-zoe');

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

    public function testBadBoysArriveInTheOtherStreet(): void
    {
        $kalle = $this->register('player-kalle', 'Kalle', 'street-kalle', 'osm|kalle');
        $maxim = $this->register('player-maxim', 'Maxim', 'street-maxim', 'osm|maxim');

        // Maxim schickt Sprühdosen-Kevin zu Kalle …
        $sent = $this->call('POST', '/api/streets/street-kalle/mischief', ['badBoy' => 'spruehdosen-kevin'], $maxim['token']);
        self::assertSame(201, $this->httpStatus());
        self::assertSame('spruehdosen-kevin', $sent['mischief']['badBoyId']);
        self::assertFalse($sent['mischief']['blocked']); // Kalle hat keinen Wachschutz

        // … gleich nochmal geht nicht, in die eigene Straße auch nicht, Unsinn schon gar nicht.
        $this->call('POST', '/api/streets/street-kalle/mischief', ['badBoy' => 'gassi-gabi'], $maxim['token']);
        self::assertSame(429, $this->httpStatus());
        $this->call('POST', '/api/streets/street-maxim/mischief', ['badBoy' => 'gassi-gabi'], $maxim['token']);
        self::assertSame(400, $this->httpStatus());
        $this->call('POST', '/api/streets/street-kalle/mischief', ['badBoy' => 'godzilla'], $kalle['token']);
        self::assertSame(400, $this->httpStatus());

        // Kalles Spiel findet ihn beim Start und im Posteingang, bestätigt – dann ist er weg.
        $me = $this->call('GET', '/api/me', null, $kalle['token']);
        self::assertCount(1, $me['mischief']);
        self::assertSame('Maxim', $me['mischief'][0]['senderName']);
        $inbox = $this->call('GET', '/api/me/mischief', null, $kalle['token']);
        self::assertSame($me['mischief'], $inbox['mischief']);
        $this->call('POST', '/api/me/mischief/ack', ['ids' => [$sent['mischief']['id']]], $maxim['token']); // fremde Bestätigung zählt nicht
        self::assertCount(1, $this->call('GET', '/api/me/mischief', null, $kalle['token'])['mischief']);
        $this->call('POST', '/api/me/mischief/ack', ['ids' => [$sent['mischief']['id']]], $kalle['token']);
        self::assertSame([], $this->call('GET', '/api/me/mischief', null, $kalle['token'])['mischief']);
    }

    public function testPetsAndCarsVisitWithTheirNames(): void
    {
        $kalle = $this->register('player-kalle', 'Kalle', 'street-kalle', 'osm|kalle');
        $maxim = $this->register('player-maxim', 'Maxim', 'street-maxim', 'osm|maxim');
        // Kalle hat die beste Wache – Tiere und Autos lässt sie trotzdem durch.
        $this->call('PUT', '/api/streets/street-kalle', ['street' => $this->street('street-kalle', 'player-kalle', 'osm|kalle') + ['security' => 2]], $kalle['token']);

        $elefant = $this->call('POST', '/api/streets/street-kalle/mischief', ['badBoy' => 'tier-elefant', 'label' => 'Maxims Elefant Benjamin'], $maxim['token']);
        self::assertSame(201, $this->httpStatus());
        self::assertFalse($elefant['mischief']['blocked']);
        self::assertSame('Maxims Elefant Benjamin', $elefant['mischief']['label']);
        // Gleich danach das Auto: keine 20-Minuten-Sperre für Ausflüge
        $this->call('POST', '/api/streets/street-kalle/mischief', ['badBoy' => 'auto-mottenwerke-xprotz', 'label' => 'Maxims X-Protz'], $maxim['token']);
        self::assertSame(201, $this->httpStatus());

        $inbox = $this->call('GET', '/api/me/mischief', null, $kalle['token'])['mischief'];
        // Reihenfolge egal: MariaDB speichert Zeiten nur sekundengenau, das Spiel sortiert selbst nach Zeit.
        self::assertEqualsCanonicalizing(['tier-elefant', 'auto-mottenwerke-xprotz'], array_column($inbox, 'badBoyId'));

        $this->call('POST', '/api/streets/street-kalle/mischief', ['badBoy' => 'tier-'], $maxim['token']);
        self::assertSame(400, $this->httpStatus());
    }

    public function testSecurityIsStoredWithTheStreet(): void
    {
        $kalle = $this->register('player-kalle', 'Kalle', 'street-kalle', 'osm|kalle');
        $street = $this->street('street-kalle', 'player-kalle', 'osm|kalle') + ['security' => 2];
        $saved = $this->call('PUT', '/api/streets/street-kalle', ['street' => $street], $kalle['token']);
        self::assertSame(2, $saved['street']['security']);
    }

    public function testRejectsBrokenDocuments(): void
    {
        $session = $this->account('Kaputt');
        $this->call('POST', '/api/register', ['player' => ['id' => 'x']], $session);
        self::assertSame(400, $this->httpStatus());

        $this->client->request('POST', '/api/register', [], [], ['CONTENT_TYPE' => 'application/json', 'HTTP_AUTHORIZATION' => "Bearer $session"], '{kaputt');
        self::assertSame(400, $this->httpStatus());
    }
}
