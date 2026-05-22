const fetch = require('node-fetch');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { name } = req.body;
    const token = '7be74127271a523420eaf85a792d97badec52201';

    const r = await fetch('https://suggestions.dadata.ru/suggestions/api/4_1/rs/inflect/name', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Token ${token}`
      },
      body: JSON.stringify({ query: name, cases: ['родительный'] })
    });
    const data = await r.json();
    return res.status(200).json({ result: data.result || null });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
};
