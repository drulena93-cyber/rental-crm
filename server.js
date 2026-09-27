// Сервер CRM для VPS (SpaceWeb).
// Заменяет серверные функции Vercel: подключает те же файлы из папки api/ без изменений.
// Сайт (папку build/) раздаёт Nginx, он же проверяет пароль на вход.
// Этот сервер слушает только внутренний адрес 127.0.0.1 — из интернета напрямую он недоступен,
// все запросы идут через Nginx (а значит, только после ввода пароля).

const express = require('express');

const app = express();
const PORT = process.env.PORT || 3001;

// Файлы (шаблоны, документы) передаются в base64 — поэтому лимит больше стандартного
app.use(express.json({ limit: '25mb' }));

// Оборачиваем обработчик: ловим ошибки, чтобы один сбой не ронял весь сервер
function wrap(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (err) {
      console.error(new Date().toISOString(), req.method, req.path, err);
      if (!res.headersSent) res.status(500).json({ error: err.message });
    }
  };
}

// Те же функции, что работали на Vercel
const routes = {
  'db': require('./api/db'),
  'tenant-checkout': require('./api/tenant-checkout'),
  'upload-to-yandex': require('./api/upload-to-yandex'),
  'download-template': require('./api/download-template'),
  'yandex-templates': require('./api/yandex-templates'),
  'decline-name': require('./api/decline-name'),
};

for (const [name, handler] of Object.entries(routes)) {
  app.all(`/api/${name}`, wrap(handler));
}

// Как в vercel.json: любой другой адрес /api/... обрабатывает db
app.all('/api/*', wrap(routes['db']));

// Проверка, что сервер жив (используется при установке)
app.get('/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, '127.0.0.1', () => {
  console.log(`CRM server listening on 127.0.0.1:${PORT}`);
});
