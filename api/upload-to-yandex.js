const fetch = require('node-fetch');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { filename, filedata, folder } = req.body;
    const token = process.env.YANDEX_DISK_TOKEN;
    const folderPath = `disk:/CRM Аренда/${folder || 'Документы'}`;
    const filePath = `${folderPath}/${filename}`;

    // Создаём папку если не существует
    await fetch(
      `https://cloud-api.yandex.net/v1/disk/resources?path=${encodeURIComponent('disk:/CRM Аренда')}`,
      { method: 'PUT', headers: { Authorization: `OAuth ${token}` } }
    );
    await fetch(
      `https://cloud-api.yandex.net/v1/disk/resources?path=${encodeURIComponent(folderPath)}`,
      { method: 'PUT', headers: { Authorization: `OAuth ${token}` } }
    );

    // Получаем ссылку для загрузки
    const uploadUrlRes = await fetch(
      `https://cloud-api.yandex.net/v1/disk/resources/upload?path=${encodeURIComponent(filePath)}&overwrite=true`,
      { headers: { Authorization: `OAuth ${token}` } }
    );
    const uploadUrlData = await uploadUrlRes.json();
    if (!uploadUrlData.href) {
      return res.status(500).json({ error: 'Не удалось получить ссылку: ' + JSON.stringify(uploadUrlData) });
    }

    // Загружаем файл
    const buffer = Buffer.from(filedata, 'base64');
    await fetch(uploadUrlData.href, {
      method: 'PUT',
      body: buffer,
      headers: { 'Content-Type': 'application/octet-stream' }
    });

    // Публикуем файл
    await fetch(
      `https://cloud-api.yandex.net/v1/disk/resources/publish?path=${encodeURIComponent(filePath)}`,
      { method: 'PUT', headers: { Authorization: `OAuth ${token}` } }
    );

    // Получаем public_url
    const infoRes = await fetch(
      `https://cloud-api.yandex.net/v1/disk/resources?path=${encodeURIComponent(filePath)}`,
      { headers: { Authorization: `OAuth ${token}` } }
    );
    const infoData = await infoRes.json();

    return res.status(200).json({
      success: true,
      path: filePath,
      public_url: infoData.public_url || ''
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
