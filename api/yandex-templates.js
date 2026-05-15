const fetch = require('node-fetch');

const TOKEN = process.env.YANDEX_DISK_TOKEN;
const FOLDER = 'disk:/CRM Аренда/Шаблоны';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // Список шаблонов
    if (req.method === 'GET') {
      const r = await fetch(
        `https://cloud-api.yandex.net/v1/disk/resources?path=${encodeURIComponent(FOLDER)}&limit=100`,
        { headers: { Authorization: `OAuth ${TOKEN}` } }
      );
      const data = await r.json();
      if (data.error) return res.status(200).json({ items: [] });
      const items = (data._embedded?.items || []).map(i => ({
        name: i.name,
        size: i.size,
        created: i.created,
        path: i.path,
        public_url: i.public_url || ''
      }));
      return res.status(200).json({ items });
    }

    // Загрузка шаблона
    if (req.method === 'POST') {
      const { filename, filedata } = req.body;

      // Создаём папку если нет
      await fetch(
        `https://cloud-api.yandex.net/v1/disk/resources?path=${encodeURIComponent('disk:/CRM Аренда')}`,
        { method: 'PUT', headers: { Authorization: `OAuth ${TOKEN}` } }
      );
      await fetch(
        `https://cloud-api.yandex.net/v1/disk/resources?path=${encodeURIComponent(FOLDER)}`,
        { method: 'PUT', headers: { Authorization: `OAuth ${TOKEN}` } }
      );

      const filePath = `${FOLDER}/${filename}`;

      // Получаем ссылку для загрузки
      const uploadUrlRes = await fetch(
        `https://cloud-api.yandex.net/v1/disk/resources/upload?path=${encodeURIComponent(filePath)}&overwrite=true`,
        { headers: { Authorization: `OAuth ${TOKEN}` } }
      );
      const uploadUrlData = await uploadUrlRes.json();
      if (!uploadUrlData.href) return res.status(500).json({ error: 'Нет ссылки для загрузки' });

      const buffer = Buffer.from(filedata, 'base64');
      await fetch(uploadUrlData.href, {
        method: 'PUT',
        body: buffer,
        headers: { 'Content-Type': 'application/octet-stream' }
      });

      // Публикуем
      await fetch(
        `https://cloud-api.yandex.net/v1/disk/resources/publish?path=${encodeURIComponent(filePath)}`,
        { method: 'PUT', headers: { Authorization: `OAuth ${TOKEN}` } }
      );

      // Ждём
      await new Promise(r => setTimeout(r, 2000));

      const infoRes = await fetch(
        `https://cloud-api.yandex.net/v1/disk/resources?path=${encodeURIComponent(filePath)}`,
        { headers: { Authorization: `OAuth ${TOKEN}` } }
      );
      const info = await infoRes.json();

      return res.status(200).json({ success: true, public_url: info.public_url || '', path: filePath });
    }

    // Удаление шаблона
    if (req.method === 'DELETE') {
      const { path } = req.body;
      await fetch(
        `https://cloud-api.yandex.net/v1/disk/resources?path=${encodeURIComponent(path)}&permanently=true`,
        { method: 'DELETE', headers: { Authorization: `OAuth ${TOKEN}` } }
      );
      return res.status(200).json({ success: true });
    }

  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
};
