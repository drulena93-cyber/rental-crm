#!/usr/bin/env bash
# Включение HTTPS для обоих порталов на домене (бесплатные сертификаты Let's Encrypt).
#
# Запуск (от root):
#   bash /opt/rental-crm/deploy/enable-https.sh
#
# Результат:
#   https://crm.ДОМЕН      — CRM
#   https://finance.ДОМЕН  — финансы
#   старые адреса http://IP и http://IP:8080 перенаправляются на новые;
#   сертификаты продлеваются сами (служба certbot.timer).
# Скрипт можно запускать повторно.
set -euo pipefail

DOMAIN=${DOMAIN:-eria1.online}
CRM_HOST=crm.$DOMAIN
FIN_HOST=finance.$DOMAIN
WEBROOT=/var/www/letsencrypt
ACME_CONF=/etc/nginx/sites-available/acme-challenge
HTTPS_CONF=/etc/nginx/sites-available/portals-https
CERT_NAME=portals

if [ "$(id -u)" -ne 0 ]; then echo "Запустите скрипт от имени root."; exit 1; fi
step() { echo; echo "==> $1"; }
fail() { echo; echo "ОШИБКА: $1"; echo "Сайты продолжают работать по-старому. Пришлите этот текст Claude."; exit 1; }

for f in /etc/nginx/.htpasswd-crm /etc/nginx/.htpasswd-eria /opt/rental-crm/build/index.html /opt/eria-finansy/index.html; do
  [ -e "$f" ] || fail "не найден $f — сначала должны быть установлены оба портала"
done

# ---------------------------------------------------------------- 1. DNS
step "1/5 Проверяю, что домены указывают на этот сервер"
MY_IPS=" $(hostname -I) "
resolves_here() {
  local ip
  ip=$(getent ahostsv4 "$1" 2>/dev/null | awk 'NR==1{print $1}')
  [ -n "$ip" ] && [[ "$MY_IPS" == *" $ip "* ]]
}
NAMES=()
for h in "$CRM_HOST" "$FIN_HOST"; do
  if resolves_here "$h"; then echo "  $h — OK"; NAMES+=("$h")
  else fail "$h ещё не указывает на этот сервер. Подождите 10–30 минут после добавления DNS-записи и повторите."; fi
done
# Основной домен и www — по возможности тоже (будут перенаправлять на CRM)
for h in "$DOMAIN" "www.$DOMAIN"; do
  if resolves_here "$h"; then echo "  $h — OK (будет перенаправлять на CRM)"; NAMES+=("$h")
  else echo "  $h — не указывает на сервер, пропускаю (это не страшно)"; fi
done

# ---------------------------------------------------------------- 2. certbot
step "2/5 Устанавливаю certbot"
if ! command -v certbot > /dev/null; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get install -y -qq certbot > /dev/null
fi
echo "$(certbot --version 2>&1)"

# ---------------------------------------------------------------- 3. Подтверждение домена
step "3/5 Готовлю Nginx к проверке домена (сайты при этом продолжают работать)"
mkdir -p "$WEBROOT/.well-known/acme-challenge"
{
  echo "# Временный блок для проверки домена Let's Encrypt (создан enable-https.sh)"
  echo "server {"
  echo "    listen 80;"
  echo "    listen [::]:80;"
  echo "    server_name ${NAMES[*]};"
  echo "    location ^~ /.well-known/acme-challenge/ { root $WEBROOT; default_type text/plain; }"
  echo "    location / { return 404; }"
  echo "}"
} > "$ACME_CONF"
if [ ! -f "$HTTPS_CONF" ]; then
  ln -sf "$ACME_CONF" /etc/nginx/sites-enabled/acme-challenge
  nginx -t 2>&1 | tail -1
  systemctl reload nginx
fi

# Самопроверка: доступен ли путь проверки
TOKEN="selftest-$RANDOM"
echo ok > "$WEBROOT/.well-known/acme-challenge/$TOKEN"
if curl -fsS --max-time 10 --resolve "$CRM_HOST:80:127.0.0.1" "http://$CRM_HOST/.well-known/acme-challenge/$TOKEN" > /dev/null; then
  echo "Путь проверки работает."
else
  rm -f "$WEBROOT/.well-known/acme-challenge/$TOKEN"
  fail "Nginx не отдаёт файл проверки домена"
fi
rm -f "$WEBROOT/.well-known/acme-challenge/$TOKEN"

# ---------------------------------------------------------------- 4. Сертификат
step "4/5 Получаю сертификат Let's Encrypt (до минуты)"
D_ARGS=()
for h in "${NAMES[@]}"; do D_ARGS+=(-d "$h"); done
if ! certbot certonly --webroot -w "$WEBROOT" --cert-name "$CERT_NAME" "${D_ARGS[@]}" \
     --non-interactive --agree-tos --register-unsafely-without-email --keep-until-expiring --expand \
     --deploy-hook "systemctl reload nginx"; then
  fail "Let's Encrypt не выдал сертификат. Возможно, хостинг не пускает проверку из-за рубежа — тогда есть запасной способ через DNS-запись."
fi
CERT_DIR=/etc/letsencrypt/live/$CERT_NAME
[ -f "$CERT_DIR/fullchain.pem" ] || fail "сертификат не найден в $CERT_DIR"
echo "Сертификат получен: $(openssl x509 -in "$CERT_DIR/fullchain.pem" -noout -enddate | cut -d= -f2)"

# ---------------------------------------------------------------- 5. HTTPS
step "5/5 Включаю HTTPS для обоих порталов"
EXTRA_REDIRECT=""
for h in "$DOMAIN" "www.$DOMAIN"; do
  if [[ " ${NAMES[*]} " == *" $h "* ]]; then EXTRA_REDIRECT="$EXTRA_REDIRECT $h"; fi
done

TMP=$(mktemp)
cat > "$TMP" <<EOF
# HTTPS для порталов (создан deploy/enable-https.sh из rental-crm).
# Пока этот файл существует, setup.sh обоих порталов не трогает настройки Nginx.

map \$host \$portal_redirect {
    $FIN_HOST https://$FIN_HOST;
    default     https://$CRM_HOST;
}

# Порт 80 (обычный http, в том числе по IP): проверка домена + перенаправление на https
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    location ^~ /.well-known/acme-challenge/ { root $WEBROOT; default_type text/plain; }
    location / { return 301 \$portal_redirect\$request_uri; }
}

# Старый адрес финансов http://IP:8080 — перенаправление
server {
    listen 8080;
    listen [::]:8080;
    server_name _;
    return 301 https://$FIN_HOST\$request_uri;
}

# ---------------------------------------------------------------- CRM
server {
    listen 443 ssl http2 default_server;
    listen [::]:443 ssl http2 default_server;
    server_name $CRM_HOST;

    ssl_certificate     $CERT_DIR/fullchain.pem;
    ssl_certificate_key $CERT_DIR/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_session_cache shared:SSL:10m;

    auth_basic "CRM Arenda";
    auth_basic_user_file /etc/nginx/.htpasswd-crm;

    client_max_body_size 30m;
    gzip on;
    gzip_types application/json application/javascript text/css text/plain image/svg+xml;
    gzip_min_length 1024;

    root /opt/rental-crm/build;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 120s;
    }
    location /static/ {
        expires 30d;
        add_header Cache-Control "public, immutable";
        try_files \$uri =404;
    }
    location = /index.html {
        add_header Cache-Control "no-cache";
    }
    location / {
        try_files \$uri \$uri/ /index.html;
    }
}

# ---------------------------------------------------------------- Финансы
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name $FIN_HOST;

    ssl_certificate     $CERT_DIR/fullchain.pem;
    ssl_certificate_key $CERT_DIR/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    auth_basic "Finansy";
    auth_basic_user_file /etc/nginx/.htpasswd-eria;

    client_max_body_size 30m;
    gzip on;
    gzip_types application/json application/javascript text/css text/plain image/svg+xml;
    gzip_min_length 1024;

    root /opt/eria-finansy;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 120s;
    }
    location = / {
        add_header Cache-Control "no-cache";
        try_files /index.html =404;
    }
    location = /index.html {
        add_header Cache-Control "no-cache";
    }
    location = /sw.js {
        add_header Cache-Control "no-cache";
    }
    location /vendor/ {
        expires 30d;
        try_files \$uri =404;
    }
    location / {
        return 404;
    }
}
EOF

if [ -n "$EXTRA_REDIRECT" ]; then
cat >> "$TMP" <<EOF

# Основной домен и www — перенаправление на CRM
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name$EXTRA_REDIRECT;
    ssl_certificate     $CERT_DIR/fullchain.pem;
    ssl_certificate_key $CERT_DIR/privkey.pem;
    return 301 https://$CRM_HOST\$request_uri;
}
EOF
fi

# Подменяем настройки и проверяем; при ошибке возвращаем как было
BACKUP=$(mktemp -d)
cp -a /etc/nginx/sites-enabled/. "$BACKUP/" 2>/dev/null || true
[ -f "$HTTPS_CONF" ] && cp "$HTTPS_CONF" "$BACKUP/portals-https.prev"
mv "$TMP" "$HTTPS_CONF"
chmod 644 "$HTTPS_CONF"
rm -f /etc/nginx/sites-enabled/rental-crm /etc/nginx/sites-enabled/eria-finansy \
      /etc/nginx/sites-enabled/acme-challenge /etc/nginx/sites-enabled/default
ln -sf "$HTTPS_CONF" /etc/nginx/sites-enabled/portals-https

if ! nginx -t 2>/tmp/nginx-test.log; then
  cat /tmp/nginx-test.log
  rm -f /etc/nginx/sites-enabled/*
  cp -a "$BACKUP/." /etc/nginx/sites-enabled/
  rm -f /etc/nginx/sites-enabled/portals-https.prev
  if [ -f "$BACKUP/portals-https.prev" ]; then cp "$BACKUP/portals-https.prev" "$HTTPS_CONF"; else rm -f "$HTTPS_CONF"; fi
  systemctl reload nginx
  fail "ошибка в настройках Nginx — всё возвращено как было"
fi
systemctl reload nginx
rm -rf "$BACKUP"

# Открываем порт 443, если включён файрвол
if command -v ufw > /dev/null && ufw status 2>/dev/null | grep -q "Status: active"; then
  ufw allow 443/tcp > /dev/null && echo "Файрвол: порт 443 открыт."
fi

# Проверка
sleep 1
C1=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 --resolve "$CRM_HOST:443:127.0.0.1" "https://$CRM_HOST/" || echo "нет ответа")
C2=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 --resolve "$FIN_HOST:443:127.0.0.1" "https://$FIN_HOST/" || echo "нет ответа")
echo "Проверка: CRM ответила $C1, финансы ответили $C2 (401 = просит пароль, так и должно быть)"
systemctl list-timers certbot.timer --no-pager 2>/dev/null | grep -q certbot && echo "Автопродление сертификата: включено."

echo
echo "=============================================="
echo " HTTPS включён!"
echo "   CRM:      https://$CRM_HOST"
echo "   Финансы:  https://$FIN_HOST"
echo " Старые адреса по IP перенаправляются на новые."
echo "=============================================="
