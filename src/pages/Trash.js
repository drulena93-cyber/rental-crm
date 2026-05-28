import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function Trash() {
  const [objects, setObjects] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [tab, setTab] = useState('objects');
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    const { data: objs } = await supabase.from('objects').select('*').not('deleted_at', 'is', null).order('deleted_at', { ascending: false });
    const { data: tens } = await supabase.from('tenants').select('*').not('deleted_at', 'is', null).order('deleted_at', { ascending: false });
    const { data: cons } = await supabase.from('contacts').select('*').not('deleted_at', 'is', null).order('deleted_at', { ascending: false });
    setObjects(objs || []);
    setTenants(tens || []);
    setContacts(cons || []);
    setLoading(false);
  }

  async function restore(table, id) {
    await supabase.from(table).update({ deleted_at: null }).eq('id', id);
    fetchAll();
  }

  async function deletePermanent(table, id) {
    if (!window.confirm('Удалить навсегда? Это действие нельзя отменить!')) return;
    await supabase.from(table).delete().eq('id', id);
    fetchAll();
  }

  function formatDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleString('ru-RU');
  }

  const total = objects.length + tenants.length + contacts.length;

  return (
    <div>
      <div className="stats">
        <div className="stat"><div className="stat-label">Всего в корзине</div><div className="stat-val red">{total}</div></div>
        <div className="stat"><div className="stat-label">Объектов</div><div className="stat-val">{objects.length}</div></div>
        <div className="stat"><div className="stat-label">Арендаторов</div><div className="stat-val">{tenants.length}</div></div>
        <div className="stat"><div className="stat-label">Контактов</div><div className="stat-val">{contacts.length}</div></div>
      </div>

     <div style={{display:'flex', gap:4, marginBottom:14, justifyContent:'space-between', alignItems:'center'}}>
  <div style={{display:'flex', gap:4}}>
    {['objects','tenants','contacts'].map(t => (
      <button key={t} onClick={() => setTab(t)}
        style={{padding:'6px 14px', borderRadius:6, border:'1px solid #ddd', cursor:'pointer', fontSize:13,
          background: tab===t ? '#534AB7' : '#fff', color: tab===t ? '#fff' : '#666'}}>
        {t==='objects' ? `Объекты (${objects.length})` : t==='tenants' ? `Арендаторы (${tenants.length})` : `Контакты (${contacts.length})`}
      </button>
    ))}
  </div>
  <div style={{display:'flex', gap:8}}>
    <button onClick={async () => {
      if (!window.confirm(`Очистить вкладку "${tab === 'objects' ? 'Объекты' : tab === 'tenants' ? 'Арендаторы' : 'Контакты'}" полностью?`)) return;
      const table = tab === 'objects' ? 'objects' : tab === 'tenants' ? 'tenants' : 'contacts';
      const items = tab === 'objects' ? objects : tab === 'tenants' ? tenants : contacts;
      for (const item of items) {
        await supabase.from(table).delete().eq('id', item.id);
      }
      fetchAll();
    }}
      style={{background:'#FCEBEB', color:'#A32D2D', border:'1px solid #f5c0c0', borderRadius:6, padding:'6px 12px', fontSize:13, cursor:'pointer'}}>
      🗑 Очистить вкладку
    </button>
    <button onClick={async () => {
      if (!window.confirm('Очистить ВСЮ корзину? Это нельзя отменить!')) return;
      for (const o of objects) await supabase.from('objects').delete().eq('id', o.id);
      for (const t of tenants) await supabase.from('tenants').delete().eq('id', t.id);
      for (const c of contacts) await supabase.from('contacts').delete().eq('id', c.id);
      fetchAll();
    }}
      style={{background:'#A32D2D', color:'#fff', border:'none', borderRadius:6, padding:'6px 12px', fontSize:13, cursor:'pointer'}}>
      🗑 Очистить всё
    </button>
  </div>
</div>

      {loading ? <p>Загрузка...</p> : (
        <>
          {tab === 'objects' && (
            <table>
              <thead>
                <tr>
                  <th>Название объекта</th>
                  <th>Тип</th>
                  <th>Статус</th>
                  <th>Удалён</th>
                  <th style={{width:180}}>Действия</th>
                </tr>
              </thead>
              <tbody>
                {objects.length === 0 && <tr><td colSpan={5} style={{textAlign:'center', color:'#aaa', padding:20}}>Корзина пуста</td></tr>}
                {objects.map(o => (
                  <tr key={o.id}>
                    <td>{o.name}</td>
                    <td>{o.type || '—'}</td>
                    <td>{o.status}</td>
                    <td style={{fontSize:12, color:'#888'}}>{formatDate(o.deleted_at)}</td>
                    <td>
                      <button onClick={() => restore('objects', o.id)}
                        style={{background:'#EAF3DE', color:'#3B6D11', border:'none', borderRadius:6, padding:'4px 10px', cursor:'pointer', fontSize:12, marginRight:6}}>
                        ↩ Восстановить
                      </button>
                      <button onClick={() => deletePermanent('objects', o.id)}
                        style={{background:'#FCEBEB', color:'#A32D2D', border:'none', borderRadius:6, padding:'4px 10px', cursor:'pointer', fontSize:12}}>
                        ✕ Удалить
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === 'tenants' && (
            <table>
              <thead>
                <tr>
                  <th>ФИО / Название</th>
                  <th>Тип</th>
                  <th>Статус</th>
                  <th>Удалён</th>
                  <th style={{width:180}}>Действия</th>
                </tr>
              </thead>
              <tbody>
                {tenants.length === 0 && <tr><td colSpan={5} style={{textAlign:'center', color:'#aaa', padding:20}}>Корзина пуста</td></tr>}
                {tenants.map(t => (
                  <tr key={t.id}>
                    <td>{t.name}</td>
                    <td>{t.type || '—'}</td>
                    <td>{t.status}</td>
                    <td style={{fontSize:12, color:'#888'}}>{formatDate(t.deleted_at)}</td>
                    <td>
                      <button onClick={() => restore('tenants', t.id)}
                        style={{background:'#EAF3DE', color:'#3B6D11', border:'none', borderRadius:6, padding:'4px 10px', cursor:'pointer', fontSize:12, marginRight:6}}>
                        ↩ Восстановить
                      </button>
                      <button onClick={() => deletePermanent('tenants', t.id)}
                        style={{background:'#FCEBEB', color:'#A32D2D', border:'none', borderRadius:6, padding:'4px 10px', cursor:'pointer', fontSize:12}}>
                        ✕ Удалить
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === 'contacts' && (
            <table>
              <thead>
                <tr>
                  <th>ФИО контакта</th>
                  <th>Телефон</th>
                  <th>Должность</th>
                  <th>Удалён</th>
                  <th style={{width:180}}>Действия</th>
                </tr>
              </thead>
              <tbody>
                {contacts.length === 0 && <tr><td colSpan={5} style={{textAlign:'center', color:'#aaa', padding:20}}>Корзина пуста</td></tr>}
                {contacts.map(c => (
                  <tr key={c.id}>
                    <td>{c.full_name || '—'}</td>
                    <td>{c.phone || '—'}</td>
                    <td>{c.position || '—'}</td>
                    <td style={{fontSize:12, color:'#888'}}>{formatDate(c.deleted_at)}</td>
                    <td>
                      <button onClick={() => restore('contacts', c.id)}
                        style={{background:'#EAF3DE', color:'#3B6D11', border:'none', borderRadius:6, padding:'4px 10px', cursor:'pointer', fontSize:12, marginRight:6}}>
                        ↩ Восстановить
                      </button>
                      <button onClick={() => deletePermanent('contacts', c.id)}
                        style={{background:'#FCEBEB', color:'#A32D2D', border:'none', borderRadius:6, padding:'4px 10px', cursor:'pointer', fontSize:12}}>
                        ✕ Удалить
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
