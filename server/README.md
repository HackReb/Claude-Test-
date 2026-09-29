# Babo-Server (Symfony)

Speichert Spieler, Straßen und Nachbarschaften, damit mehrere Spieler dieselbe Welt teilen.
Die Spiellogik läuft in der PWA; der Server achtet darauf, dass niemand fremdes Eigentum überschreibt
(`src/Service/StreetMerger.php`) und dass jede echte Straße nur einem Spieler gehört.

- PHP ≥ 8.2, Symfony 7.4, Doctrine ORM
- Datenbank: standardmäßig **SQLite** (`var/babo.db`, kein Datenbank-Server nötig), MySQL/MariaDB möglich
- Alle Tabellen beginnen mit `babo_` – passt auch in eine bestehende Datenbank

## Umzug auf MariaDB/MySQL

Einmalig als root auf dem Server – legt eine eigene Datenbank `babo` mit eigenem Benutzer an (andere
Datenbanken bleiben unberührt), kopiert alle Spieldaten aus `var/babo.db` und stellt `.env.local` um:

```bash
apt install php8.5-mysql && systemctl reload php8.5-fpm   # falls pdo_mysql noch fehlt
bash /var/www/babo-api/deploy/setup-mariadb.sh
```

Am Ende stehen die Zugangsdaten für PhpStorm (*Data Source → MariaDB*, Host `127.0.0.1`, Port `3306`,
Reiter *SSH/SSL* mit Tunnel über den Server). Die SQLite-Datei bleibt als Sicherung liegen. Der Umzug
allein: `php bin/console babo:db-umzug --von=var/babo.db` (nach `doctrine:migrations:migrate` in der neuen
Datenbank).

## Lokal

```bash
cd server
composer install
php bin/console doctrine:migrations:migrate -n
php -S 127.0.0.1:8000 -t public     # API unter http://127.0.0.1:8000/api/health
php bin/phpunit                     # Tests
```

PWA dagegen starten: `VITE_API_URL=http://127.0.0.1:8000 npm run dev` (im Hauptordner).

## API

| Methode | Pfad | Zweck |
| --- | --- | --- |
| GET | `/api/health` | Lebenszeichen |
| POST | `/api/account/register` | Konto anlegen (Name + Passwort) → Sitzung; ein älterer Spielstand kommt mit (Geräte-Schlüssel im Header) |
| POST | `/api/account/login` · `/api/account/logout` | anmelden → Sitzung + Straßen · Gerät abmelden |
| GET | `/api/account` | Konto und seine Straßen (höchstens 3) |
| POST | `/api/account/attach` | ältere Straße per BABO-Code ans Konto hängen |
| POST | `/api/register` | neue Straße im Konto (Sitzung nötig, höchstens 3); `409 street-taken` |
| POST | `/api/recover` | Code → neuer Schlüssel + Spielstand (altes Gerät wird abgemeldet) |
| GET/PUT/DELETE | `/api/me` | eigener Spielstand laden / Spieler speichern / alles löschen |
| PUT | `/api/me/neighborhood` | Bot-Nachbarschaft speichern |
| GET/PUT | `/api/streets/{id}` | Straße laden / speichern (Antwort = zusammengeführter Stand) |
| GET | `/api/city?name=Ort` | Straßen anderer Spieler im Ort |

Anmeldung: Header `Authorization: Bearer <Sitzung>` plus `X-Babo-Player: <Spieler-ID>` (welche Straße des
Kontos); ältere Spielstände ohne Konto schicken ihren Geräte-Schlüssel. Gespeichert werden nur SHA-256-Hashes von
Schlüssel und Code.

## Passwort vergessen?

```bash
cd /var/www/babo-api && php bin/console babo:passwort "Papa Matthias"
```

Stellt ein neues Passwort aus und meldet alle Geräte des Kontos ab.

## Doppelte Straßen aufräumen

Aus der Zeit vor „jede Straße nur einmal“ kann es Straßen geben, die mehrere Spieler geclaimt haben:

```bash
cd /var/www/babo-api && php bin/console babo:doppelte-strassen
php bin/console babo:doppelte-strassen --loeschen=<Spieler-ID>   # löscht diesen Spielstand samt Straße
```

## Code vergessen? (ältere Spielstände ohne Konto)

Handy weg und Code nicht notiert: auf dem Server einen neuen Code ausstellen (der alte wird ungültig).

```bash
cd /var/www/babo-api && php bin/console babo:neuer-code Maxim
```

Heißen mehrere Spieler so, listet der Befehl sie mit Spieler-ID auf – dann mit der ID nochmal aufrufen.

## Auf den eigenen Webspace

Voraussetzungen: PHP ≥ 8.2 mit `pdo_sqlite` (oder `pdo_mysql`), **HTTPS** (die PWA läuft auf https –
Browser blockieren Aufrufe an http), SSH-Zugang.

1. **Ordner:** Den Server in einen eigenen Ordner legen, z. B. `~/babo-api`. Bestehendes bleibt
   unberührt; die Datenbank liegt in `~/babo-api/var/`.
2. **Web-Adresse:** Eine (Sub-)Domain, z. B. `babo.example.de`, mit Document Root auf
   `~/babo-api/public` – **nie** auf `~/babo-api` selbst (dort liegen `.env.local` und die Datenbank).
   Alternativ als Unterordner einer bestehenden Seite per Symlink:
   `ln -s ~/babo-api/public /var/www/html/babo-api` → API unter `https://example.de/babo-api/api/health`.
   Für Apache liegt `public/.htaccess` bei; bei nginx alle Anfragen an `public/index.php` leiten.
3. **Konfiguration** in `~/babo-api/.env.local` (nicht im Repo):
   ```
   APP_ENV=prod
   APP_SECRET=<zufällig, z. B. openssl rand -hex 16>
   CORS_ALLOW_ORIGIN=https://<github-name>.github.io
   # optional MySQL statt SQLite:
   # DATABASE_URL="mysql://babo:PASSWORT@127.0.0.1:3306/babo?serverVersion=10.11.2-MariaDB&charset=utf8mb4"
   ```
4. **Datenbank anlegen / aktualisieren:** `php bin/console doctrine:migrations:migrate -n`

### Automatisch per GitHub Actions

`.github/workflows/deploy-server.yml` erledigt 1, 3 (beim ersten Mal, mit zufälligem Secret) und 4
bei jedem Push auf `Main`, der `server/` ändert. Einmalig unter *Settings → Secrets and variables → Actions*:

- Secrets: `SSH_HOST`, `SSH_USER`, `SSH_PRIVATE_KEY` (eigenen Deploy-Schlüssel anlegen und dessen
  öffentlichen Teil in `~/.ssh/authorized_keys` auf dem Server eintragen), optional `SSH_PORT`
- Variables: `DEPLOY_PATH` (z. B. `/home/kalle/babo-api`), `API_URL` (z. B. `https://babo.example.de`)

Nach dem ersten Deploy einmalig Webserver und HTTPS einrichten (eigener Server mit nginx, als root):

```bash
bash /var/www/babo-api/deploy/setup-nginx.sh babo.138.199.148.107.sslip.io
```

Das Skript legt nur eine neue nginx-Seite an, prüft mit `nginx -t` und holt ein Let's-Encrypt-Zertifikat
(certbot). `*.sslip.io` zeigt ohne DNS-Eintrag auf die IP im Namen; eine eigene Domain geht genauso.

`API_URL` nutzt auch der PWA-Workflow: danach einmal *Deploy PWA* laufen lassen, dann spielt die App online.
