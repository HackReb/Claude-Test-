# Babo-Server (Symfony)

Speichert Spieler, Straßen und Nachbarschaften, damit mehrere Spieler dieselbe Welt teilen.
Die Spiellogik läuft in der PWA; der Server achtet darauf, dass niemand fremdes Eigentum überschreibt
(`src/Service/StreetMerger.php`) und dass jede echte Straße nur einem Spieler gehört.

- PHP ≥ 8.2, Symfony 7.4, Doctrine ORM
- Datenbank: standardmäßig **SQLite** (`var/babo.db`, kein Datenbank-Server nötig), MySQL/MariaDB möglich
- Alle Tabellen beginnen mit `babo_` – passt auch in eine bestehende Datenbank

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
| POST | `/api/register` | neuer Spieler + Straße (optional mit altem lokalem Spielstand) → Schlüssel + Code; `409 street-taken` |
| POST | `/api/recover` | Code → neuer Schlüssel + Spielstand (altes Gerät wird abgemeldet) |
| GET/PUT/DELETE | `/api/me` | eigener Spielstand laden / Spieler speichern / alles löschen |
| PUT | `/api/me/neighborhood` | Bot-Nachbarschaft speichern |
| GET/PUT | `/api/streets/{id}` | Straße laden / speichern (Antwort = zusammengeführter Stand) |
| GET | `/api/city?name=Ort` | Straßen anderer Spieler im Ort |

Anmeldung: Header `Authorization: Bearer <Schlüssel>`. Gespeichert werden nur SHA-256-Hashes von
Schlüssel und Code.

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

`API_URL` nutzt auch der PWA-Workflow: danach einmal *Deploy PWA* laufen lassen, dann spielt die App online.
