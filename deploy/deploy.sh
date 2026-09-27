#!/usr/bin/env bash
# Обновление CRM на сервере: скачать свежий код из GitHub -> собрать -> перезапустить.
# Запуск:  bash /opt/rental-crm/deploy/deploy.sh
set -euo pipefail

APP_DIR=/opt/rental-crm
cd "$APP_DIR"

echo "==> 1/4 Скачиваю свежий код из GitHub"
git fetch --depth 1 origin main
git reset --hard origin/main

echo "==> 2/4 Устанавливаю зависимости (первый раз — несколько минут)"
npm install --no-audit --no-fund --loglevel=error

echo "==> 3/4 Собираю сайт (1–5 минут)"
# Собираем в отдельную папку, чтобы работающий сайт не пропадал во время сборки
rm -rf build_new
export NODE_OPTIONS="--max-old-space-size=1536"
export GENERATE_SOURCEMAP=false
BUILD_PATH=build_new npm run build
rm -rf build_old
if [ -d build ]; then mv build build_old; fi
mv build_new build
rm -rf build_old

echo "==> 4/4 Перезапускаю сервер"
systemctl restart rental-crm
sleep 2
if curl -fsS http://127.0.0.1:3001/health > /dev/null; then
  echo "Сервер работает."
else
  echo "ВНИМАНИЕ: сервер не отвечает. Журнал: journalctl -u rental-crm -n 50"
  exit 1
fi
systemctl reload nginx

echo
echo "Готово! Версия: $(git log -1 --format='%h — %s')"
