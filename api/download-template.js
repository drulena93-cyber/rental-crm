const fetch = require('node-fetch');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { public_url } = req.body;
    
    // Сначала получаем реальную ссылку для скачивания
    const token = process.env.YANDEX_DISK_TOKEN;
    const infoRes = await fetch(
      `https://cloud-api.yandex.net/v1/disk/public/resources/download?public_key=${encodeURIComponent(public_url)}`,
      { headers: { Authorization: `OAuth ${token}` } }
    );
    const infoData = await infoRes.json();
    
    if (!infoData.href) {
      return res.status(500).json({ error: 'Нет ссылки для скачивания: ' + JSON.stringify(infoData) });
    }

    // Скачиваем файл по прямой ссылке
    const fileRes = await fetch(infoData.href);
    const buffer = await fileRes.buffer();
    const base64 = buffer.toString('base64');
    
    return res.status(200).json({ success: true, filedata: base64 });
  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
};
