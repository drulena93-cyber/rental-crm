const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  const { tenantId, tenantName, contractStart, createdAt } = req.body;
  
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const otRes = await client.query(
        `SELECT object_id FROM object_tenants WHERE tenant_id = $1`,
        [tenantId]
      );
      
      const today = new Date().toISOString().split('T')[0];
      const dateFrom = contractStart || createdAt?.split('T')[0] || null;
      
      for (const row of otRes.rows) {
        const objectId = row.object_id;
        
        await client.query(
          `INSERT INTO object_history (object_id, tenant_id, tenant_name, date_from, date_to, comment, auto) VALUES ($1, $2, $3, $4, $5, $6, true)`,
          [objectId, tenantId, tenantName, dateFrom, today, 'Автоматически при смене статуса на Съехал']
        );
        
        await client.query(
          `DELETE FROM object_tenants WHERE tenant_id = $1 AND object_id = $2`,
          [tenantId, objectId]
        );
        
        const remainRes = await client.query(
          `SELECT COUNT(*) as cnt FROM object_tenants WHERE object_id = $1`,
          [objectId]
        );
        const cnt = parseInt(remainRes.rows[0]?.cnt || 0);
        
        if (cnt === 0) {
          await client.query(
            `UPDATE objects SET status = 'Не сдано' WHERE id = $1`,
            [objectId]
          );
        }
      }
      
      await client.query(
        `UPDATE tenants SET object_id = NULL WHERE id = $1`,
        [tenantId]
      );
      
      await client.query('COMMIT');
      res.json({ success: true, objectsProcessed: otRes.rows.length });
    } catch(e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch(e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
}
