const API_URL = '/api/db';

async function query(sql, params = []) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql, params })
  });
  const data = await response.json();
  if (data.error) throw new Error(data.error);
  return { data: data.rows, error: null };
}

export const supabase = {
  from: (table) => ({
    select: (columns = '*') => ({
      order: (col, opts) => ({
        then: async (resolve) => {
          const dir = opts?.ascending === false ? 'DESC' : 'ASC';
          const { data } = await query(`SELECT ${columns} FROM ${table} ORDER BY ${col} ${dir}`);
          resolve({ data, error: null });
        },
        is: (col2, val) => ({
          order: (col3, opts2) => ({
            then: async (resolve) => {
              const dir = opts2?.ascending === false ? 'DESC' : 'ASC';
              const { data } = await query(`SELECT ${columns} FROM ${table} WHERE ${col2} IS ${val === null ? 'NULL' : `'${val}'`} ORDER BY ${col3} ${dir}`);
              resolve({ data, error: null });
            }
          })
        })
      }),
      eq: (col, val) => ({
        single: async () => {
          const { data } = await query(`SELECT ${columns} FROM ${table} WHERE ${col} = $1 LIMIT 1`, [val]);
          return { data: data[0] || null, error: null };
        },
        then: async (resolve) => {
          const { data } = await query(`SELECT ${columns} FROM ${table} WHERE ${col} = $1`, [val]);
          resolve({ data, error: null });
        }
      }),
      is: (col, val) => ({
        order: (col2, opts) => ({
          then: async (resolve) => {
            const dir = opts?.ascending === false ? 'DESC' : 'ASC';
            const { data } = await query(`SELECT ${columns} FROM ${table} WHERE ${col} IS ${val === null ? 'NULL' : `'${val}'`} ORDER BY ${col2} ${dir}`);
            resolve({ data, error: null });
          }
        }),
        not: (col2, op, val2) => ({
          order: (col3, opts) => ({
            then: async (resolve) => {
              const dir = opts?.ascending === false ? 'DESC' : 'ASC';
              const { data } = await query(`SELECT ${columns} FROM ${table} WHERE ${col} IS NULL AND ${col2} IS NOT NULL ORDER BY ${col3} ${dir}`);
              resolve({ data, error: null });
            }
          })
        })
      }),
      not: (col, op, val) => ({
        order: (col2, opts) => ({
          then: async (resolve) => {
            const dir = opts?.ascending === false ? 'DESC' : 'ASC';
            const { data } = await query(`SELECT ${columns} FROM ${table} WHERE ${col} IS NOT NULL ORDER BY ${col2} ${dir}`);
            resolve({ data, error: null });
          }
        })
      }),
      single: async () => {
        const { data } = await query(`SELECT ${columns} FROM ${table} LIMIT 1`);
        return { data: data[0] || null, error: null };
      }
    }),
    insert: async (values) => {
      const arr = Array.isArray(values) ? values : [values];
      for (const row of arr) {
        const keys = Object.keys(row).filter(k => row[k] !== undefined);
        const vals = keys.map(k => row[k]);
        const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
        await query(`INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`, vals);
      }
      return { error: null };
    },
    update: (values) => ({
      eq: async (col, val) => {
        const keys = Object.keys(values).filter(k => values[k] !== undefined);
        const set = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
        const vals = [...keys.map(k => values[k]), val];
        await query(`UPDATE ${table} SET ${set} WHERE ${col} = $${keys.length + 1}`, vals);
        return { error: null };
      },
      neq: async (col, val) => {
        const keys = Object.keys(values).filter(k => values[k] !== undefined);
        const set = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
        const vals = [...keys.map(k => values[k]), val];
        await query(`UPDATE ${table} SET ${set} WHERE ${col} != $${keys.length + 1}`, vals);
        return { error: null };
      }
    }),
    delete: () => ({
      eq: async (col, val) => {
        await query(`DELETE FROM ${table} WHERE ${col} = $1`, [val]);
        return { error: null };
      }
    }),
    upsert: async (values) => {
      return { error: null };
    }
  }),
  storage: {
    from: (bucket) => ({
      list: async () => ({ data: [], error: null }),
      upload: async () => ({ error: null }),
      download: async () => ({ data: null, error: null }),
      remove: async () => ({ error: null }),
      getPublicUrl: () => ({ data: { publicUrl: '' } })
    })
  }
};
