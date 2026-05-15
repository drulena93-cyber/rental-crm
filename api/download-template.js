const fetch = require('node-fetch');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { public_url } = req.body;
    const fileRes = await fetch(public_url);
    const buffer = await fileRes.buffer();
    const base64 = buffer.toString('base64');
    return res.status(200).json({ success: true, filedata: base64 });
  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
};
