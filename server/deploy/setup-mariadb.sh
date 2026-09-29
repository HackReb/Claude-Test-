#!/usr/bin/env bash
# Einmalig als root: Babo von der SQLite-Datei auf den vorhandenen MariaDB/MySQL-Server umziehen.
#
#   bash /var/www/babo-api/deploy/setup-mariadb.sh --pruefen   # nur nachsehen, ändert nichts
#   bash /var/www/babo-api/deploy/setup-mariadb.sh             # umziehen
#
# Rücksicht auf andere Anwendungen auf dem Server:
# - installiert nichts und startet keinen Dienst neu,
# - legt nur eine NEUE Datenbank und einen NEUEN Benutzer an (Standard: „babo“) – gibt es die schon und
#   gehören nicht zu Babo, bricht es ab; fremde Datenbanken, Benutzer und Passwörter bleiben unberührt,
# - ändert nur Dateien in diesem Babo-Ordner (.env.local, var/).
# Andere Namen: BABO_DB_NAME=babo_spiel BABO_DB_USER=babo_spiel bash …/setup-mariadb.sh
set -euo pipefail

CHECK_ONLY=0
[ "${1:-}" = "--pruefen" ] && { CHECK_ONLY=1; shift; }
APP_DIR="${1:-$(cd "$(dirname "$0")/.." && pwd)}"
DB_NAME="${BABO_DB_NAME:-babo}"
DB_USER="${BABO_DB_USER:-babo}"
ENV_FILE="$APP_DIR/.env.local"
SQLITE="$APP_DIR/var/babo.db"

[ "$(id -u)" -eq 0 ] || { echo "Bitte als root ausführen."; exit 1; }
[ -f "$APP_DIR/bin/console" ] || { echo "Kein Babo-Server in $APP_DIR."; exit 1; }
[[ "$DB_NAME$DB_USER" =~ ^[A-Za-z0-9_]+$ ]] || { echo "Datenbank- und Benutzername nur aus Buchstaben, Ziffern und _."; exit 1; }
cd "$APP_DIR"

# 1. Vorhandenen Datenbank-Server benutzen – nichts installieren.
CLIENT="$(command -v mariadb || command -v mysql || true)"
if [ -z "$CLIENT" ] || ! "$CLIENT" -N -e 'SELECT 1' >/dev/null 2>&1; then
  echo "Kein laufender MariaDB/MySQL-Server erreichbar (als root über den Socket)."
  echo "Bitte NICHT einfach „apt install mariadb-server“, falls schon MySQL läuft – das kann es ersetzen."
  echo "Erst nachsehen: systemctl status mysql mariadb"
  exit 1
fi
VERSION="$("$CLIENT" -N -e 'SELECT VERSION()')"
case "$VERSION" in
  *MariaDB*) SERVER_VERSION="${VERSION%%-*}-MariaDB" ;;
  *) SERVER_VERSION="${VERSION%%-*}" ;;
esac
PORT="$("$CLIENT" -N -e 'SELECT @@port')"
SKIP_NET="$("$CLIENT" -N -e 'SELECT @@skip_networking' 2>/dev/null || echo 0)"
echo "Datenbank-Server: $VERSION (Port $PORT)"
[ "$SKIP_NET" = "1" ] && { echo "Der Server nimmt keine TCP-Verbindungen an (skip_networking) – so kann PhpStorm nicht per Tunnel zugreifen."; exit 1; }

PHP_VERSION="$(php -r 'echo PHP_MAJOR_VERSION.".".PHP_MINOR_VERSION;')"
PDO_OK=1
php -m | grep -qi '^pdo_mysql$' || PDO_OK=0

# 2. Gibt es Datenbank oder Benutzer schon? Nur weiter, wenn sie Babo gehören.
OURS=0
grep -q "^DATABASE_URL=.*mysql://$DB_USER:.*/$DB_NAME?" "$ENV_FILE" 2>/dev/null && OURS=1
DB_EXISTS="$("$CLIENT" -N -e "SELECT COUNT(*) FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='$DB_NAME'")"
USER_EXISTS="$("$CLIENT" -N -e "SELECT COUNT(*) FROM mysql.user WHERE User='$DB_USER'")"
FOREIGN_TABLES="$("$CLIENT" -N -e "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='$DB_NAME' AND TABLE_NAME NOT LIKE 'babo\_%' AND TABLE_NAME <> 'doctrine_migration_versions'")"
OTHER_DBS="$("$CLIENT" -N -e "SELECT GROUP_CONCAT(SCHEMA_NAME SEPARATOR ', ') FROM information_schema.SCHEMATA WHERE SCHEMA_NAME NOT IN ('information_schema','mysql','performance_schema','sys','$DB_NAME')")"

echo "Andere Datenbanken auf dem Server (bleiben unberührt): ${OTHER_DBS:-keine}"
echo "Datenbank „$DB_NAME“: $([ "$DB_EXISTS" = 1 ] && echo "gibt es schon" || echo "wird neu angelegt")"
echo "Benutzer „$DB_USER“: $([ "$USER_EXISTS" -gt 0 ] && echo "gibt es schon" || echo "wird neu angelegt")"
echo "PHP $PHP_VERSION mit pdo_mysql: $([ $PDO_OK = 1 ] && echo ja || echo "NEIN – nötig: apt install php${PHP_VERSION}-mysql, danach systemctl reload php${PHP_VERSION}-fpm (lädt PHP-FPM für alle Seiten dieser PHP-Version sanft neu)")"

PROBLEM=0
if [ "$OURS" = 0 ] && { [ "$USER_EXISTS" -gt 0 ] || [ "$FOREIGN_TABLES" -gt 0 ]; }; then
  echo
  echo "STOPP: Datenbank oder Benutzer „$DB_NAME“/„$DB_USER“ gibt es schon und gehören nicht zu Babo."
  echo "Nichts wird geändert. Andere Namen wählen, z. B.:"
  echo "  BABO_DB_NAME=babo_spiel BABO_DB_USER=babo_spiel bash $0"
  PROBLEM=1
fi
[ $PDO_OK = 1 ] || PROBLEM=1

if [ $CHECK_ONLY = 1 ] || [ $PROBLEM = 1 ]; then
  echo
  [ $PROBLEM = 1 ] && { echo "Umzug so nicht möglich (siehe oben)."; exit 1; }
  echo "Prüfung ok – nichts geändert. Zum Umziehen ohne --pruefen starten."
  exit 0
fi

# 3. Eigene Datenbank + Benutzer anlegen (fremde werden nie verändert – siehe Prüfung oben).
if [ "$OURS" = 1 ]; then
  PASSWORD="$(sed -n 's|^DATABASE_URL="\{0,1\}mysql://[^:]*:\([^@]*\)@.*|\1|p' "$ENV_FILE")"
  echo "Babo nutzt „$DB_NAME“ schon – Zugang bleibt, wie er ist."
else
  PASSWORD="$(openssl rand -hex 16)"
  "$CLIENT" <<SQL
CREATE DATABASE IF NOT EXISTS \`$DB_NAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER '$DB_USER'@'localhost' IDENTIFIED BY '$PASSWORD';
CREATE USER '$DB_USER'@'127.0.0.1' IDENTIFIED BY '$PASSWORD';
GRANT ALL PRIVILEGES ON \`$DB_NAME\`.* TO '$DB_USER'@'localhost';
GRANT ALL PRIVILEGES ON \`$DB_NAME\`.* TO '$DB_USER'@'127.0.0.1';
SQL
fi
URL="mysql://$DB_USER:$PASSWORD@127.0.0.1:$PORT/$DB_NAME?serverVersion=$SERVER_VERSION&charset=utf8mb4"

# 4. Tabellen anlegen und Daten kopieren – Babo läuft bis hierhin weiter auf SQLite.
DATABASE_URL="$URL" php bin/console doctrine:migrations:migrate --no-interaction --allow-no-migration
if [ -f "$SQLITE" ]; then
  cp "$SQLITE" "$SQLITE.vor-mariadb-$(date +%Y%m%d-%H%M%S)"
  if ! DATABASE_URL="$URL" php bin/console babo:db-umzug --von="$SQLITE"; then
    echo "Umzug nicht gemacht (siehe oben). Liegen in der Datenbank schon Babo-Daten, ist das in Ordnung."
  fi
fi

# 5. Umschalten: ab jetzt nutzt Babo die neue Datenbank.
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
echo "Fertig – Babo läuft jetzt auf „$DB_NAME“. Die alte SQLite-Datei liegt als Sicherung in var/."
echo
echo "PhpStorm → Database → + → Data Source → $([[ $VERSION == *MariaDB* ]] && echo MariaDB || echo MySQL):"
echo "  Host 127.0.0.1 · Port $PORT · Benutzer $DB_USER · Datenbank $DB_NAME"
echo "  Passwort: $PASSWORD"
echo "  Reiter SSH/SSL: „Use SSH tunnel“ → root@<dein Server> mit deinem SSH-Schlüssel"
