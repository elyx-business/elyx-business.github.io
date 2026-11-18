#!/usr/bin/env bash
# Elyx: сайт и показ по ИНН на своём сервере. Чистый сервер Ubuntu 24.04, запуск от root одной командой:
#
#   curl -fsSL https://elyx-business.github.io/server/install.sh | bash -s -- ваш-домен.ru
#
# Домен можно не указывать: тогда сайт будет по адресу вида 185-12-34-56.sslip.io (бесплатно, с HTTPS).
# Повторный запуск той же командой обновляет программу до последней версии; показы посетителей при этом сбрасываются.
set -euo pipefail

REL="https://elyx-business.github.io/server"
DOMAIN="${1:-}"
say() { printf '\n\033[1;32m== %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31mОшибка: %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" = 0 ] || die "запустите от root: sudo -i, затем команду ещё раз"
. /etc/os-release
python3 -c 'import sys; sys.exit(0 if sys.version_info[:2] == (3, 12) else 1)' 2>/dev/null \
  || die "нужна Ubuntu 24.04 (в ней Python 3.12), у вас ${PRETTY_NAME:-неизвестная система}"

say "Ставим nginx, Python и certbot"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -yq nginx python3-venv certbot python3-certbot-nginx curl ca-certificates >/dev/null

if [ -z "$DOMAIN" ]; then
  IP="$(curl -fsS4 --max-time 8 https://ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')"
  [ -n "$IP" ] || die "не удалось узнать IP сервера — укажите домен: … | bash -s -- ваш-домен.ru"
  DOMAIN="$(echo "$IP" | tr . -).sslip.io"
fi
say "Адрес сайта: $DOMAIN"

say "Скачиваем программу"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
curl -fSL --retry 3 "$REL/elyx-server.tar.gz" -o "$TMP/elyx.tgz"
tar -xzf "$TMP/elyx.tgz" -C "$TMP"
cat "$TMP/VERSION" 2>/dev/null || true

say "Устанавливаем программу"
id elyx >/dev/null 2>&1 || useradd --system --home-dir /opt/elyx --shell /usr/sbin/nologin elyx
mkdir -p /opt/elyx
[ -x /opt/elyx/venv/bin/python ] || python3 -m venv /opt/elyx/venv
/opt/elyx/venv/bin/pip install -q --upgrade pip
/opt/elyx/venv/bin/pip install -q -r "$TMP/requirements.txt"
/opt/elyx/venv/bin/pip install -q --force-reinstall --no-deps "$TMP"/kp_app-*.whl

say "Кладём файлы сайта"
rm -rf /var/www/elyx.new && mkdir -p /var/www/elyx.new
cp -a "$TMP/site/." /var/www/elyx.new/
rm -rf /var/www/elyx.old && { [ -d /var/www/elyx ] && mv /var/www/elyx /var/www/elyx.old || true; }
mv /var/www/elyx.new /var/www/elyx && rm -rf /var/www/elyx.old

say "Запускаем программу показа"
cp "$TMP/elyx-demo.service" /etc/systemd/system/elyx-demo.service
systemctl daemon-reload
systemctl enable elyx-demo >/dev/null 2>&1
systemctl restart elyx-demo
for i in $(seq 1 30); do curl -fsS http://127.0.0.1:8100/api/__ping >/dev/null 2>&1 && break; sleep 1; done
curl -fsS http://127.0.0.1:8100/api/__ping >/dev/null || { journalctl -u elyx-demo -n 30 --no-pager; die "программа показа не запустилась"; }

say "Настраиваем nginx"
sed "s/elyx\.example\.ru/$DOMAIN/g" "$TMP/nginx.conf" > /etc/nginx/sites-available/elyx
ln -sf /etc/nginx/sites-available/elyx /etc/nginx/sites-enabled/elyx
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then ufw allow 'Nginx Full' >/dev/null; fi

say "Подключаем HTTPS (Let's Encrypt)"
if certbot --nginx -d "$DOMAIN" --redirect --keep-until-expiring --non-interactive --agree-tos --register-unsafely-without-email; then
  URL="https://$DOMAIN"
else
  URL="http://$DOMAIN"
  echo "HTTPS пока не подключился: проверьте, что домен $DOMAIN указывает на IP этого сервера, и запустите команду ещё раз."
fi

say "Готово"
echo "Показ по ИНН:        $URL/"
echo "Рабочая версия:      $URL/app/"
echo "Проверка программы:  curl -s $URL/api/__ping"
