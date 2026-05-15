const fetch = require('node-fetch');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { filename, filedata, folder } = req.body;
    const token = process.env.YANDEX_DISK_TOKEN;
    const path = `disk:/CRM Аренда/${folder || 'Документы'}/${filename}`;

    // Получаем ссылку для загрузки
    const uploadUrlRes = await fetch(
      `https://cloud-api.yandex.net/v1/disk/resources/upload?path=${encodeURIComponent(path)}&overwrite=true`,
      { headers: { Authorization: `OAuth ${token}` } }
    );
    const uploadUrlData = await uploadUrlRes.json();
    if (!uploadUrlData.href) {
      return res.status(500).json({ error: 'Не удалось получить ссылку для загрузки: ' + JSON.stringify(uploadUrlData) });
    }

    // Загружаем файл
    const buffer = Buffer.from(filedata, 'base64');
    const uploadRes = await fetch(uploadUrlData.href, {
      method: 'PUT',
      body: buffer,
      headers: { 'Content-Type': 'application/octet-stream' }
    });

    if (uploadRes.status !== 201 && uploadRes.status !== 200) {
      return res.status(500).json({ error: 'Ошибка загрузки файла: ' + uploadRes.status });
    }

    // Получаем публичную ссылку
    await fetch(
      `https://cloud-api.yandex.net/v1/disk/resources/publish?path=${encodeURIComponent(path)}`,
      { method: 'PUT', headers: { Authorization: `OAuth ${token}` } }
    );

    // Получаем public_url
    const infoRes = await fetch(
      `https://cloud-api.yandex.net/v1/disk/resources?path=${encodeURIComponent(path)}`,
      { headers: { Authorization: `OAuth ${token}` } }
    );
    const infoData = await infoRes.json();
    const publicUrl = infoData.public_url || '';

    return res.status(200).json({ success: true, path, public_url: publicUrl });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
