import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const PAGE_SIZE = 30;
const CACHE_KEY = 'contacts_cache';
const CACHE_TIME_KEY = 'contacts_cache_time';
const CACHE_TTL = 60 * 1000;

export default function Contacts({ tenantId, onNavigate }) {
  const [contacts, setContacts] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [selectedTenant, setSelectedTenant] = useState(tenantId || '');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(() => parseInt(localStorage.getItem('contacts_page') || '1'));
  const [lastUpdated, setLastUpdated] = useState(null);
  const [filterObjectType, setFilterObjectType] = useState('');
const [objects, setObjects] = useState([]);
const [objectTenants, setObjectTenants] = useState([]);

  useEffect(() => { fetchAll(false); }, []);

  useEffect(() => {
    if (tenantId) setSelectedTenant(tenantId);
  }, [tenantId]);

  useEffect(() => {
    localStorage.setItem('contacts_page', String(page));
  }, [page]);

  useEffect(() => {
  setPage(1);
}, [search, selectedTenant, filterObjectType]);

  async function fetchAll(forceRefresh = false) {
    if (!forceRefresh) {
      const cached = localStorage.getItem(CACHE_KEY);
      const cachedTime = localStorage.getItem(CACHE_TIME_KEY);
      if (cached && cachedTime && Date.now() - parseInt(cachedTime) < CACHE_TTL) {
        try {
          const { cons, tens, objs, ot } = JSON.parse(cached);
setContacts(cons || []);
setTenants(tens || []);
setObjects(objs || []);
setObjectTenants(ot || []);
          setLastUpdated(new Date(parseInt(cachedTime)));
          setLoading(false);
          return;
        } catch(e) {}
      }
    }

    forceRefresh ? setRefreshing(true) : setLoading(true);

    const { data: cons } = await supabase.from('contacts').select('*').is('deleted_at', null).order('full_name');
const { data: tens } = await supabase.from('tenants').select('id, name').order('name');
const { data: objs } = await supabase.from('objects').select('id, name, type').is('deleted_at', null);
const otRes = await fetch('/api/db', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: `SELECT object_id, tenant_id FROM object_tenants`, params: [] })
});
const otData = await otRes.json();


  const now = Date.now();
const otRows = otData.rows || [];
localStorage.setItem(CACHE_KEY, JSON.stringify({ cons: cons || [], tens: tens || [], objs: objs || [], ot: otRows }));
localStorage.setItem(CACHE_TIME_KEY, String(now));
setContacts(cons || []);
setTenants(tens || []);
setObjects(objs || []);
setObjectTenants(otRows);
setLastUpdated(new Date(now));
setLoading(false);
setRefreshing(false);  
  }

  const objectTypesByTenant = {};
for (const ot of objectTenants) {
  const obj = objects.find(o => o.id === ot.object_id);
  if (obj?.type) {
    if (!objectTypesByTenant[ot.tenant_id]) objectTypesByTenant[ot.tenant_id] = new Set();
    objectTypesByTenant[ot.tenant_id].add(obj.type);
  }
}

const filtered = contacts.filter(c => {
  if (selectedTenant && c.tenant_id !== selectedTenant) return false;
  if (filterObjectType) {
    const types = objectTypesByTenant[c.tenant_id];
    if (!types || !types.has(filterObjectType)) return false;
  }
  if (search && !c.full_name?.toLowerCase().includes(search.toLowerCase()) &&
      !c.phone?.toLowerCase().includes(search.toLowerCase()) && !c.email?.toLowerCase().includes(search.toLowerCase())) return false;
  return true;
});

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const getTenantName = (id) => tenants.find(t => t.id === id)?.name || '—';

  function openAdd() {
    setForm({ tenant_id: selectedTenant || '', is_primary: false });
    setShowForm(true);
  }

  function openEdit(c) {
    setForm({ ...c });
    setShowForm(true);
  }

  async function saveForm() {
    if (!form.full_name) return alert('Введите ФИО контакта');
    if (form.id) {
      await supabase.from('contacts').update(form).eq('id', form.id);
    } else {
      await supabase.from('contacts').insert(form);
    }
    setShowForm(false);
    fetchAll(true);
  }

  async function deleteContact(id) {
    if (!window.confirm('Переместить контакт в корзину?')) return;
    await supabase.from('contacts').update({ deleted_at: new Date().toISOString() }).eq('id', id);
    fetchAll(true);
  }

  return (
    <div>
      <div className="stats">
        <div className="stat"><div className="stat-label">Всего контактов</div><div className="stat-val purple">{contacts.length}</div></div>
        <div className="stat"><div className="stat-label">Показано</div><div className="stat-val">{filtered.length}</div></div>
        <div className="stat"><div className="stat-label">Арендаторов</div><div className="stat-val">{tenants.length}</div></div>
        <div className="stat"><div className="stat-label"></div><div className="stat-val"></div></div>
      </div>

      <div className="toolbar">
        <input placeholder="Поиск по имени или телефону..." value={search} onChange={e => setSearch(e.target.value)} />
        <select value={selectedTenant} onChange={e => setSelectedTenant(e.target.value)}>
          <option value="">Все арендаторы</option>
          {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
  <select value={filterObjectType} onChange={e => setFilterObjectType(e.target.value)}>
  <option value="">Все типы объектов</option>
  {[...new Set(objects.map(o => o.type).filter(Boolean))].sort().map(type => (
    <option key={type} value={type}>{type}</option>
  ))}
</select>
        {selectedTenant && (
          <button className="btn-cancel" style={{padding:'6px 12px', fontSize:13}} onClick={() => { onNavigate('tenants', selectedTenant); }}>
            ← К арендатору
          </button>
        )}
        <button className="btn-add" onClick={openAdd}>+ Добавить контакт</button>
        <button onClick={() => fetchAll(true)} disabled={refreshing}
          style={{background:'#f4f4f8', border:'1px solid #ddd', borderRadius:6, padding:'7px 12px', fontSize:13, cursor:'pointer', whiteSpace:'nowrap'}}>
          {refreshing ? '⏳ Обновление...' : '🔄 Обновить'}
        </button>
      </div>

      {lastUpdated && (
        <div style={{fontSize:11, color:'#aaa', marginBottom:8}}>
          Данные загружены: {lastUpdated.toLocaleTimeString('ru-RU')}
        </div>
      )}

      {loading ? <p>Загрузка...</p> : (
        <>
          <table>
            <thead>
              <tr>
                <th>ФИО контакта</th>
                <th>Телефон</th>
                <th>Должность</th>
                <th>Арендатор</th>
                <th>Email</th>
<th>Комментарий</th>
                <th style={{width:80}}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map(c => (
                <tr key={c.id}>
                  <td>{c.full_name || '—'}</td>
                  <td>{c.phone ? <a href={`tel:${c.phone}`} onClick={e => e.stopPropagation()}>{c.phone}</a> : '—'}</td>
                  <td>{c.position || '—'}</td>
                  <td onClick={() => onNavigate('tenants', c.tenant_id)} style={{cursor:'pointer', color:'#534AB7', textDecoration:'underline'}}>
                    {getTenantName(c.tenant_id)}
                  </td>
                  <td>{c.email ? <a href={`mailto:${c.email}`}>{c.email}</a> : '—'}</td>
<td>{c.description || '—'}</td>
                  <td onClick={e => e.stopPropagation()}>
                    <button onClick={() => openEdit(c)} style={{background:'none', border:'none', cursor:'pointer', color:'#534AB7', marginRight:8}}>✎</button>
                    <button onClick={() => deleteContact(c.id)} style={{background:'none', border:'none', cursor:'pointer', color:'#A32D2D'}}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div style={{display:'flex', alignItems:'center', gap:8, marginTop:12, justifyContent:'center'}}>
              <button onClick={() => setPage(1)} disabled={page === 1}
                style={{background:'#f4f4f8', border:'1px solid #ddd', borderRadius:6, padding:'5px 10px', cursor:'pointer', fontSize:13, opacity: page===1?0.4:1}}>«</button>
              <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1}
                style={{background:'#f4f4f8', border:'1px solid #ddd', borderRadius:6, padding:'5px 10px', cursor:'pointer', fontSize:13, opacity: page===1?0.4:1}}>‹</button>
              {Array.from({length: totalPages}, (_, i) => i+1).filter(p => Math.abs(p - page) <= 2).map(p => (
                <button key={p} onClick={() => setPage(p)}
                  style={{background: p===page ? '#534AB7' : '#f4f4f8', color: p===page ? '#fff' : '#333',
                    border:'1px solid #ddd', borderRadius:6, padding:'5px 10px', cursor:'pointer', fontSize:13, fontWeight: p===page?600:400}}>
                  {p}
                </button>
              ))}
              <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages}
                style={{background:'#f4f4f8', border:'1px solid #ddd', borderRadius:6, padding:'5px 10px', cursor:'pointer', fontSize:13, opacity: page===totalPages?0.4:1}}>›</button>
              <button onClick={() => setPage(totalPages)} disabled={page === totalPages}
                style={{background:'#f4f4f8', border:'1px solid #ddd', borderRadius:6, padding:'5px 10px', cursor:'pointer', fontSize:13, opacity: page===totalPages?0.4:1}}>»</button>
            </div>
          )}
        </>
      )}

      <div className="page-info">Показано {((page-1)*PAGE_SIZE)+1}–{Math.min(page*PAGE_SIZE, filtered.length)} из {filtered.length} (всего {contacts.length})</div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">
              {form.id ? 'Редактировать контакт' : 'Новый контакт'}
              <button className="modal-close" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <div className="form-group"><label>ФИО *</label><input value={form.full_name || ''} onChange={e => setForm({...form, full_name: e.target.value})} /></div>
            <div className="form-grid">
  <div className="form-group"><label>Телефон</label><input value={form.phone || ''} onChange={e => setForm({...form, phone: e.target.value})} /></div>
  <div className="form-group"><label>Email</label><input type="email" value={form.email || ''} onChange={e => setForm({...form, email: e.target.value})} /></div>
  <div className="form-group"><label>Должность</label><input value={form.position || ''} onChange={e => setForm({...form, position: e.target.value})} /></div>
</div>
            <div className="form-group"><label>Арендатор</label>
              <select value={form.tenant_id || ''} onChange={e => setForm({...form, tenant_id: e.target.value})}>
                <option value="">— Выберите арендатора —</option>
                {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Описание</label><textarea rows={2} value={form.description || ''} onChange={e => setForm({...form, description: e.target.value})} /></div>
            <div className="form-group"><label><input type="checkbox" checked={form.is_primary || false} onChange={e => setForm({...form, is_primary: e.target.checked})} /> Основной контакт</label></div>
            <div className="form-actions">
              <button className="btn-cancel" onClick={() => setShowForm(false)}>Отмена</button>
              <button className="btn-save" onClick={saveForm}>Сохранить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
