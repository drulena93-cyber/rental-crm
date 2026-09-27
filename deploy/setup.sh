#!/usr/bin/env bash
# Одноразовая установка CRM на чистый сервер Ubuntu 24.04.
#
# Запуск (от root):
#   bash /opt/rental-crm/deploy/setup.sh
#
# Скрипт можно запускать повторно — уже сделанные шаги он пропустит.
# Дополнительно:
#   bash /opt/rental-crm/deploy/setup.sh --password   — сменить логин/пароль входа в CRM
#   bash /opt/rental-crm/deploy/setup.sh --env        — заново ввести доступы к базе и токен
set -euo pipefail

APP_DIR=/opt/rental-crm
ENV_FILE=/etc/rental-crm.env
HTPASSWD=/etc/nginx/.htpasswd-crm
SERVICE=/etc/systemd/system/rental-crm.service

if [ "$(id -u)" -ne 0 ]; then
  echo "Запустите скрипт от имени root."; exit 1
fi

RESET_PASSWORD=false
RESET_ENV=false
for arg in "$@"; do
  case "$arg" in
    --password) RESET_PASSWORD=true ;;
    --env) RESET_ENV=true ;;
  esac
done

step() { echo; echo "==> $1"; }

# ---------------------------------------------------------------- 1. Программы
step "1/8 Устанавливаю системные программы (Nginx, Git) — пара минут"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq nginx git curl ca-certificates openssl > /dev/null
echo "Готово."

# ---------------------------------------------------------------- 2. Node.js
step "2/8 Устанавливаю Node.js"
NODE_MAJOR=0
if command -v node > /dev/null; then
  NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]')
fi
if [ "$NODE_MAJOR" -ge 18 ]; then
  echo "Node.js уже установлен: $(node -v)"
else
  if curl -fsSL --max-time 60 https://deb.nodesource.com/setup_22.x -o /tmp/nodesource_setup.sh \
     && bash /tmp/nodesource_setup.sh > /dev/null 2>&1 \
     && apt-get install -y -qq nodejs > /dev/null; then
    echo "Установлен Node.js $(node -v) (NodeSource)"
  else
    echo "NodeSource недоступен — ставлю Node.js из репозитория Ubuntu"
    apt-get install -y -qq nodejs npm > /dev/null
    echo "Установлен Node.js $(node -v)"
  fi
fi

# ---------------------------------------------------------------- 3. Подкачка
step "3/8 Файл подкачки (страховка памяти при сборке)"
if swapon --show | grep -q .; then
  echo "Подкачка уже есть."
else
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile > /dev/null
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  echo "Создан файл подкачки 2 ГБ."
fi

# ---------------------------------------------------------------- 4. Настройки
step "4/8 Доступы к базе данных и Яндекс Диску"
if [ -f "$ENV_FILE" ] && [ "$RESET_ENV" = false ]; then
  echo "Файл настроек уже есть ($ENV_FILE) — пропускаю. Чтобы ввести заново: setup.sh --env"
else
  echo "Сейчас нужно ввести доступы. В квадратных скобках — значение по умолчанию,"
  echo "если оно верное, просто нажмите Enter."
  echo "Пароль и токен при вводе НЕ отображаются на экране — это нормально."
  echo
  read -r -p "Адрес базы (DB_HOST) [79.174.88.49]: " DB_HOST;   DB_HOST=${DB_HOST:-79.174.88.49}
  read -r -p "Порт базы (DB_PORT) [19165]: " DB_PORT;           DB_PORT=${DB_PORT:-19165}
  read -r -p "Имя базы (DB_NAME) [rental_crm]: " DB_NAME;       DB_NAME=${DB_NAME:-rental_crm}
  DB_USER=""
  while [ -z "$DB_USER" ]; do read -r -p "Пользователь базы (DB_USER): " DB_USER; done
  DB_PASSWORD=""
  while [ -z "$DB_PASSWORD" ]; do read -r -s -p "Пароль пользователя базы (DB_PASSWORD): " DB_PASSWORD; echo; done
  read -r -s -p "Токен Яндекс Диска (YANDEX_DISK_TOKEN), можно оставить пустым и добавить позже: " YANDEX_DISK_TOKEN; echo

  # Значения в кавычках: пароль может содержать спецсимволы
  q() { local v=${1//\\/\\\\}; v=${v//\"/\\\"}; printf '"%s"' "$v"; }
  umask 077
  {
    echo "DB_HOST=$(q "$DB_HOST")"
    echo "DB_PORT=$(q "$DB_PORT")"
    echo "DB_NAME=$(q "$DB_NAME")"
    echo "DB_USER=$(q "$DB_USER")"
    echo "DB_PASSWORD=$(q "$DB_PASSWORD")"
    echo "YANDEX_DISK_TOKEN=$(q "$YANDEX_DISK_TOKEN")"
    echo "PORT=3001"
  } > "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  umask 022
  echo "Сохранено в $ENV_FILE (доступно только root)."
fi

# ---------------------------------------------------------------- 5. Пароль на вход
step "5/8 Логин и пароль для входа в CRM"
if [ -f "$HTPASSWD" ] && [ "$RESET_PASSWORD" = false ]; then
  echo "Пароль на вход уже задан — пропускаю. Чтобы сменить: setup.sh --password"
else
  CRM_LOGIN=""
  while [ -z "$CRM_LOGIN" ]; do read -r -p "Придумайте логин для входа в CRM: " CRM_LOGIN; done
  while true; do
    read -r -s -p "Придумайте пароль (не короче 8 символов): " P1; echo
    read -r -s -p "Повторите пароль: " P2; echo
    if [ "${#P1}" -lt 8 ]; then echo "Слишком короткий, попробуйте ещё раз."; continue; fi
    if [ "$P1" != "$P2" ]; then echo "Пароли не совпадают, попробуйте ещё раз."; continue; fi
    break
  done
  printf '%s:%s\n' "$CRM_LOGIN" "$(openssl passwd -apr1 "$P1")" > "$HTPASSWD"
  chown root:www-data "$HTPASSWD"
  chmod 640 "$HTPASSWD"
  unset P1 P2
  echo "Логин и пароль сохранены."
fi

# ---------------------------------------------------------------- 6. Служба
step "6/8 Служба, которая держит сервер CRM запущенным"
id -u crm > /dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin crm
cat > "$SERVICE" <<EOF
[Unit]
Description=Rental CRM API server
After=network-online.target
Wants=network-online.target

[Service]
User=crm
WorkingDirectory=$APP_DIR
EnvironmentFile=$ENV_FILE
ExecStart=$(command -v node) $APP_DIR/server.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable rental-crm > /dev/null 2>&1
echo "Служба rental-crm настроена (перезапускается сама при сбое и после перезагрузки сервера)."

# ---------------------------------------------------------------- 7. Nginx
step "7/8 Настраиваю Nginx"
cp "$APP_DIR/deploy/nginx-crm.conf" /etc/nginx/sites-available/rental-crm
ln -sf /etc/nginx/sites-available/rental-crm /etc/nginx/sites-enabled/rental-crm
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable nginx > /dev/null 2>&1
systemctl reload nginx || systemctl restart nginx
echo "Nginx настроен."

# ---------------------------------------------------------------- 8. Сборка и запуск
step "8/8 Собираю и запускаю CRM"
bash "$APP_DIR/deploy/deploy.sh"

# ---------------------------------------------------------------- Проверка базы
echo
echo "==> Проверяю подключение к базе данных"
RESULT=$(curl -s -X POST http://127.0.0.1:3001/api/db \
  -H 'Content-Type: application/json' \
  -d '{"query":"SELECT COUNT(*) AS n FROM objects","params":[]}')
if echo "$RESULT" | grep -q '"rows"'; then
  echo "База подключена. Ответ: $RESULT"
else
  echo "ОШИБКА подключения к базе: $RESULT"
  echo "Проверьте логин/пароль базы и введите их заново: bash $APP_DIR/deploy/setup.sh --env"
fi

IP=$(hostname -I | awk '{print $1}')
echo
echo "=============================================="
echo " Установка завершена."
echo " Откройте в браузере:  http://$IP"
echo "=============================================="
