import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.PG_HOST,
  port: process.env.PG_PORT,
  database: process.env.PG_DATABASE,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  const { tenantId, tenantName, contractStart, createdAt } = req.body;
  
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Находим все объекты арендатора
      const otRes = await client.query(
        `SELECT object_id FROM object_tenants WHERE tenant_id = $1`,
        [tenantId]
      );
      
      const today = new Date().toISOString().split('T')[0];
      const dateFrom = contractStart || createdAt?.split('T')[0] || null;
      
      // Для каждого объекта добавляем историю
      for (const row of otRes.rows) {
        const objectId = row.object_id;
        
        // Добавляем в историю
        await client.query(
          `INSERT INTO object_history (object_id, tenant_id, tenant_name, date_from, date_to, comment, auto) 
           VALUES ($1, $2, $3, $4, $5, $6, true)`,
          [objectId, tenantId, tenantName, dateFrom, today, 'Автоматически при смене статуса на Съехал']
        );
        
        // Удаляем связь
        await client.query(
          `DELETE FROM object_tenants WHERE tenant_id = $1 AND object_id = $2`,
          [tenantId, objectId]
        );
        
        // Проверяем остались ли другие арендаторы
        const remainRes = await client.query(
          `SELECT COUNT(*) as cnt FROM object_tenants WHERE object_id = $1`,
          [objectId]
        );
        const cnt = parseInt(remainRes.rows[0]?.cnt || 0);
        
        // Если никого нет — меняем статус объекта
        if (cnt === 0) {
          await client.query(
            `UPDATE objects SET status = 'Не сдано' WHERE id = $1`,
            [objectId]
          );
        }
      }
      
      // Обнуляем object_id арендатора
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
