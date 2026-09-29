#!/usr/bin/env bash
# Einmalig als root: Babo von der SQLite-Datei auf MariaDB/MySQL umziehen.
#
#   bash /var/www/babo-api/deploy/setup-mariadb.sh
#
# Legt nur eine eigene Datenbank „babo“ und einen eigenen Benutzer „babo“ an – bestehende Datenbanken
# (Shopware & Co.) bleiben unberührt. Die SQLite-Datei bleibt als Sicherung liegen. Mehrfaches Ausführen
# ist harmlos: Gibt es die Datenbank schon mit Daten, wird nichts kopiert.
set -euo pipefail

APP_DIR="${1:-$(cd "$(dirname "$0")/.." && pwd)}"
DB_NAME="babo"
DB_USER="babo"
ENV_FILE="$APP_DIR/.env.local"
SQLITE="$APP_DIR/var/babo.db"

[ "$(id -u)" -eq 0 ] || { echo "Bitte als root ausführen."; exit 1; }
[ -f "$APP_DIR/bin/console" ] || { echo "Kein Babo-Server in $APP_DIR."; exit 1; }
cd "$APP_DIR"

# 1. Datenbank-Server und PHP-Erweiterung da?
CLIENT="$(command -v mariadb || command -v mysql || true)"
[ -n "$CLIENT" ] || { echo "Kein MariaDB/MySQL gefunden. Installieren mit: apt install mariadb-server"; exit 1; }
PHP_VERSION="$(php -r 'echo PHP_MAJOR_VERSION.".".PHP_MINOR_VERSION;')"
php -m | grep -qi '^pdo_mysql$' || { echo "PHP-Erweiterung pdo_mysql fehlt: apt install php${PHP_VERSION}-mysql && systemctl reload php${PHP_VERSION}-fpm"; exit 1; }

VERSION="$("$CLIENT" -N -e 'SELECT VERSION()')"
case "$VERSION" in
  *MariaDB*) SERVER_VERSION="${VERSION%%-*}-MariaDB" ;;
  *) SERVER_VERSION="${VERSION%%-*}" ;;
esac
echo "Datenbank-Server: $VERSION"

# 2. Eigene Datenbank + Benutzer (für PHP über den Socket und für PhpStorm über den SSH-Tunnel auf 127.0.0.1).
if grep -q '^DATABASE_URL=.*mysql' "$ENV_FILE" 2>/dev/null; then
  echo "In $ENV_FILE steht schon eine MySQL-DATABASE_URL – das Passwort bleibt, wie es ist."
  PASSWORD="$(sed -n 's|^DATABASE_URL="\{0,1\}mysql://[^:]*:\([^@]*\)@.*|\1|p' "$ENV_FILE")"
else
  PASSWORD="$(openssl rand -hex 16)"
fi
"$CLIENT" <<SQL
CREATE DATABASE IF NOT EXISTS \`$DB_NAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$PASSWORD';
CREATE USER IF NOT EXISTS '$DB_USER'@'127.0.0.1' IDENTIFIED BY '$PASSWORD';
ALTER USER '$DB_USER'@'localhost' IDENTIFIED BY '$PASSWORD';
ALTER USER '$DB_USER'@'127.0.0.1' IDENTIFIED BY '$PASSWORD';
GRANT ALL PRIVILEGES ON \`$DB_NAME\`.* TO '$DB_USER'@'localhost';
GRANT ALL PRIVILEGES ON \`$DB_NAME\`.* TO '$DB_USER'@'127.0.0.1';
FLUSH PRIVILEGES;
SQL
URL="mysql://$DB_USER:$PASSWORD@127.0.0.1:3306/$DB_NAME?serverVersion=$SERVER_VERSION&charset=utf8mb4"

# 3. Tabellen anlegen und die Daten aus der SQLite-Datei kopieren (die App läuft bis dahin weiter auf SQLite).
DATABASE_URL="$URL" php bin/console doctrine:migrations:migrate --no-interaction --allow-no-migration
if [ -f "$SQLITE" ]; then
  cp "$SQLITE" "$SQLITE.vor-mariadb-$(date +%Y%m%d-%H%M%S)"
  if ! DATABASE_URL="$URL" php bin/console babo:db-umzug --von="$SQLITE"; then
    echo "Umzug nicht gemacht (siehe oben). Liegen in MariaDB schon Babo-Daten, ist das in Ordnung."
  fi
fi

# 4. Umschalten: ab jetzt nutzt Babo MariaDB.
touch "$ENV_FILE"
if grep -q '^DATABASE_URL=' "$ENV_FILE"; then
  sed -i "s|^DATABASE_URL=.*|DATABASE_URL=\"$URL\"|" "$ENV_FILE"
else
  printf 'DATABASE_URL="%s"\n' "$URL" >> "$ENV_FILE"
fi
chmod 640 "$ENV_FILE"
php bin/console cache:clear
WEB_USER="$(stat -c %U "$APP_DIR/var" 2>/dev/null || echo www-data)"
chown -R "$WEB_USER:$WEB_USER" var && chgrp "$WEB_USER" "$ENV_FILE"

echo
echo "Fertig – Babo läuft jetzt auf MariaDB (Datenbank „$DB_NAME“)."
echo
echo "PhpStorm → Database → + → Data Source → MariaDB:"
echo "  Host 127.0.0.1 · Port 3306 · Benutzer $DB_USER · Datenbank $DB_NAME"
echo "  Passwort: $PASSWORD"
echo "  Reiter SSH/SSL: „Use SSH tunnel“ → root@$(hostname -I 2>/dev/null | awk '{print $1}') mit deinem SSH-Schlüssel"
