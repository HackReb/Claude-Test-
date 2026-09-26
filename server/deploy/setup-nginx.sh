#!/usr/bin/env bash
# Einmalig als root: nginx-Seite + HTTPS-Zertifikat für den Babo-Server anlegen.
#
#   bash /var/www/babo-api/deploy/setup-nginx.sh babo.138.199.148.107.sslip.io
#
# Legt nur eine neue Datei /etc/nginx/sites-available/<domain> an (bestehende Seiten bleiben unberührt),
# prüft die Konfiguration mit `nginx -t`, bevor nginx neu geladen wird, und holt dann mit certbot ein
# Let's-Encrypt-Zertifikat. Mehrfaches Ausführen ist harmlos.
set -euo pipefail

DOMAIN="${1:?Aufruf: setup-nginx.sh <domain> [babo-ordner]}"
APP_DIR="${2:-$(cd "$(dirname "$0")/.." && pwd)}"
SITE="/etc/nginx/sites-available/$DOMAIN"

[ "$(id -u)" -eq 0 ] || { echo "Bitte als root ausführen."; exit 1; }
[ -f "$APP_DIR/public/index.php" ] || { echo "Kein Babo-Server in $APP_DIR (erst den Workflow „Deploy Server“ laufen lassen)."; exit 1; }

# PHP-FPM-Socket finden (neueste Version).
SOCKET="$(ls -1 /run/php/php*-fpm.sock 2>/dev/null | sort -V | tail -1 || true)"
if [ -z "$SOCKET" ]; then
  echo "PHP-FPM läuft nicht. Installieren z. B. mit: apt install php-fpm php-sqlite3"
  exit 1
fi
echo "PHP-FPM: $SOCKET"

php -m | grep -qi '^pdo_sqlite$' || { echo "PHP-Erweiterung pdo_sqlite fehlt: apt install php-sqlite3"; exit 1; }

if [ -e "$SITE" ]; then
  echo "$SITE gibt es schon – wird nicht überschrieben."
else
  cat > "$SITE" <<NGINX
# Babo-Server (angelegt von deploy/setup-nginx.sh)
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;
    root $APP_DIR/public;

    client_max_body_size 1m;

    location / {
        try_files \$uri /index.php\$is_args\$args;
    }

    location ~ ^/index\.php(/|\$) {
        fastcgi_pass unix:$SOCKET;
        fastcgi_split_path_info ^(.+\.php)(/.*)\$;
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME \$realpath_root\$fastcgi_script_name;
        fastcgi_param DOCUMENT_ROOT \$realpath_root;
        fastcgi_param HTTP_AUTHORIZATION \$http_authorization;
        internal;
    }

    # Keine anderen PHP-Dateien ausführen.
    location ~ \.php\$ {
        return 404;
    }
}
NGINX
  ln -sf "$SITE" "/etc/nginx/sites-enabled/$DOMAIN"
  echo "Angelegt: $SITE"
fi

nginx -t
systemctl reload nginx
echo "nginx neu geladen."

if command -v certbot >/dev/null 2>&1; then
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email --redirect
else
  echo "certbot fehlt – für HTTPS: apt install certbot python3-certbot-nginx, dann Skript erneut starten."
fi

echo
echo "Test: curl https://$DOMAIN/api/health"
