#!/usr/bin/env bash
# Одноразовая установка портала «Финансы» на сервер, где уже работает CRM.
#
# Запуск (от root):
#   bash /opt/eria-finansy/deploy/setup.sh
#
# Можно запускать повторно — сделанные шаги пропускаются.
#   bash /opt/eria-finansy/deploy/setup.sh --password   — сменить логин/пароль входа в портал
#   bash /opt/eria-finansy/deploy/setup.sh --env        — заново ввести доступы к базе
set -euo pipefail

APP_DIR=/opt/eria-finansy
ENV_FILE=/etc/eria-finansy.env
CRM_ENV=/etc/rental-crm.env
HTPASSWD=/etc/nginx/.htpasswd-eria
CRM_HTPASSWD=/etc/nginx/.htpasswd-crm
SERVICE=/etc/systemd/system/eria-finansy.service
TOOL="node $APP_DIR/deploy/envtool.js"

if [ "$(id -u)" -ne 0 ]; then echo "Запустите скрипт от имени root."; exit 1; fi

RESET_PASSWORD=false; RESET_ENV=false
for arg in "$@"; do
  case "$arg" in
    --password) RESET_PASSWORD=true ;;
    --env) RESET_ENV=true ;;
  esac
done

step() { echo; echo "==> $1"; }
# Значения в кавычках: пароль может содержать спецсимволы
q() { local v=${1//\\/\\\\}; v=${v//\"/\\\"}; printf '"%s"' "$v"; }

# ---------------------------------------------------------------- 1. Программы
step "1/6 Проверяю программы (Node.js, Nginx)"
if ! command -v node > /dev/null || ! command -v nginx > /dev/null; then
  echo "Не найдены Node.js или Nginx. Сначала должна быть установлена CRM (deploy/setup.sh из rental-crm)."
  exit 1
fi
echo "Node.js $(node -v), Nginx — на месте."

# ---------------------------------------------------------------- 2. Настройки
step "2/6 Доступы к базе данных портала"
if [ -f "$ENV_FILE" ] && [ "$RESET_ENV" = false ]; then
  echo "Файл настроек уже есть ($ENV_FILE) — пропускаю. Чтобы ввести заново: setup.sh --env"
else
  echo "Введите доступы к НОВОЙ базе портала на SpaceWeb (не к Supabase и не к базе CRM)."
  echo "В квадратных скобках — значение по умолчанию: если верно, просто нажмите Enter."
  echo "Пароль при вводе НЕ отображается на экране — это нормально."
  echo
  read -r -p "Адрес базы [79.174.88.49]: " DB_HOST; DB_HOST=${DB_HOST:-79.174.88.49}
  read -r -p "Порт базы [19165]: " DB_PORT;       DB_PORT=${DB_PORT:-19165}
  DB_NAME=""
  while [ -z "$DB_NAME" ]; do read -r -p "ТЕХНИЧЕСКОЕ имя базы (из панели SpaceWeb): " DB_NAME; done
  DB_USER=""
  while [ -z "$DB_USER" ]; do read -r -p "Пользователь базы: " DB_USER; done
  DB_PASSWORD=""
  while [ -z "$DB_PASSWORD" ]; do read -r -s -p "Пароль пользователя базы: " DB_PASSWORD; echo; done

  if [ -f "$CRM_ENV" ]; then
    CRM_NAME=$($TOOL get "$CRM_ENV" DB_NAME)
    if [ "$DB_NAME" = "$CRM_NAME" ]; then
      echo "ОШИБКА: это база CRM ($CRM_NAME). Для портала нужна отдельная новая база."; exit 1
    fi
  fi

  DATABASE_URL=$(PASS="$DB_PASSWORD" $TOOL url "$DB_HOST" "$DB_PORT" "$DB_NAME" "$DB_USER")
  CRM_DATABASE_URL=""
  if [ -f "$CRM_ENV" ]; then
    CRM_DATABASE_URL=$($TOOL crm-url "$CRM_ENV")
    echo "Подключение к базе CRM (для кнопки «Обновить арендаторов») взято из настроек CRM."
  else
    echo "ВНИМАНИЕ: настройки CRM не найдены — синхронизация арендаторов работать не будет."
  fi

  umask 077
  {
    echo "DATABASE_URL=$(q "$DATABASE_URL")"
    echo "CRM_DATABASE_URL=$(q "$CRM_DATABASE_URL")"
    echo "PORT=3002"
  } > "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  umask 022
  unset DB_PASSWORD
  echo "Сохранено в $ENV_FILE (доступно только root)."
fi

# ---------------------------------------------------------------- 3. Пароль на вход
step "3/6 Логин и пароль для входа в портал"
if [ -f "$HTPASSWD" ] && [ "$RESET_PASSWORD" = false ]; then
  echo "Пароль на вход уже задан — пропускаю. Чтобы сменить: setup.sh --password"
else
  SAME="n"
  if [ -f "$CRM_HTPASSWD" ]; then
    read -r -p "Использовать тот же логин и пароль, что для входа в CRM? (да/нет) [нет]: " SAME
  fi
  if [ "$SAME" = "да" ] || [ "$SAME" = "y" ] || [ "$SAME" = "yes" ]; then
    cp "$CRM_HTPASSWD" "$HTPASSWD"
    echo "Скопирован логин и пароль от CRM."
  else
    LOGIN=""
    while [ -z "$LOGIN" ]; do read -r -p "Придумайте логин для входа в портал: " LOGIN; done
    while true; do
      read -r -s -p "Придумайте пароль (не короче 8 символов): " P1; echo
      read -r -s -p "Повторите пароль: " P2; echo
      if [ "${#P1}" -lt 8 ]; then echo "Слишком короткий, попробуйте ещё раз."; continue; fi
      if [ "$P1" != "$P2" ]; then echo "Пароли не совпадают, попробуйте ещё раз."; continue; fi
      break
    done
    printf '%s:%s\n' "$LOGIN" "$(openssl passwd -apr1 "$P1")" > "$HTPASSWD"
    unset P1 P2
    echo "Логин и пароль сохранены."
  fi
  chown root:www-data "$HTPASSWD"
  chmod 640 "$HTPASSWD"
fi

# ---------------------------------------------------------------- 4. Служба
step "4/6 Служба, которая держит сервер портала запущенным"
id -u eria > /dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin eria
cat > "$SERVICE" <<EOF
[Unit]
Description=Eria finance portal API server
After=network-online.target
Wants=network-online.target

[Service]
User=eria
WorkingDirectory=$APP_DIR
EnvironmentFile=$ENV_FILE
ExecStart=$(command -v node) $APP_DIR/server.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable eria-finansy > /dev/null 2>&1
echo "Служба eria-finansy настроена."

# ---------------------------------------------------------------- 5. Nginx
step "5/6 Настраиваю Nginx"
if [ -f /etc/nginx/sites-available/portals-https ]; then
  # HTTPS настроен скриптом enable-https.sh (из rental-crm) — его настройки не перезаписываем
  echo "HTTPS уже настроен (enable-https.sh) — настройки Nginx не меняю."
else
  cp "$APP_DIR/deploy/nginx-eria.conf" /etc/nginx/sites-available/eria-finansy
  ln -sf /etc/nginx/sites-available/eria-finansy /etc/nginx/sites-enabled/eria-finansy
  nginx -t
  systemctl reload nginx
  echo "Nginx настроен."
fi

# ---------------------------------------------------------------- 6. Запуск
step "6/6 Запускаю портал"
bash "$APP_DIR/deploy/deploy.sh"

echo
echo "==> Проверяю подключения"
RESULT=$(curl -s -X POST http://127.0.0.1:3002/api/db -H 'Content-Type: application/json' \
  -d '{"query":"SELECT count(*) AS tables FROM information_schema.tables WHERE table_schema = '"'"'public'"'"'","params":[]}')
if echo "$RESULT" | grep -q '"rows"'; then
  echo "База портала подключена. Таблиц в ней сейчас: $(echo "$RESULT" | grep -o '"tables":"[0-9]*"' | grep -o '[0-9]*')"
  echo "(0 — это нормально до переноса данных из Supabase)"
else
  echo "ОШИБКА подключения к базе портала: $RESULT"
  echo "Введите доступы заново: bash $APP_DIR/deploy/setup.sh --env"
fi

IP=$(hostname -I | awk '{print $1}')
echo
echo "=============================================="
echo " Установка портала завершена."
echo " Следующий шаг — перенос данных:"
echo "   bash $APP_DIR/deploy/migrate-from-supabase.sh"
echo " Адрес портала:  http://$IP:8080"
echo "=============================================="
