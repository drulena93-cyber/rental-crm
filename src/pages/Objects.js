import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';

const PAGE_SIZE = 30;
const CACHE_KEY = 'objects_cache';
const CACHE_TIME_KEY = 'objects_cache_time';
const CACHE_TTL = 60 * 1000; // 1 минута

async function dbQuery(sql, params = []) {
  const res = await fetch('/api/db', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql, params })
  });
  const data = await res.json();
  return data.rows || [];
}

function HistorySection({ objectId, tenants, onNavigate }) {
  const [history, setHistory] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState({ tenant_id: '', tenant_name: '', date_from: '', date_to: '', comment: '' });

  useEffect(() => { fetchHistory(); }, [objectId]);

  async function fetchHistory() {
    const res = await fetch('/api/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `SELECT * FROM object_history WHERE object_id = $1 ORDER BY date_to DESC NULLS FIRST`,
        params: [objectId]
      })
    });
    const data = await res.json();
    setHistory(data.rows || []);
  }

  async function addHistory() {
    if (!form.tenant_name && !form.tenant_id) return alert('Укажите арендатора');
    const tenantName = form.tenant_id
      ? tenants.find(t => t.id === form.tenant_id)?.name || form.tenant_name
      : form.tenant_name;
    await fetch('/api/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `INSERT INTO object_history (object_id, tenant_id, tenant_name, date_from, date_to, comment, auto) VALUES ($1, $2, $3, $4, $5, $6, false)`,
        params: [objectId, form.tenant_id || null, tenantName, form.date_from || null, form.date_to || null, form.comment || null]
      })
    });
    setShowAddForm(false);
    setForm({ tenant_id: '', tenant_name: '', date_from: '', date_to: '', comment: '' });
    fetchHistory();
  }

  async function deleteHistory(id) {
    if (!window.confirm('Удалить запись?')) return;
    await fetch('/api/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `DELETE FROM object_history WHERE id = $1`, params: [id] })
    });
    fetchHistory();
  }

  return (
    <div className="linked-section">
      <div className="linked-title" style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <span>📋 История объекта</span>
        <button onClick={() => setShowAddForm(!showAddForm)}
          style={{background:'#534AB7', color:'#fff', border:'none', borderRadius:6, padding:'4px 10px', fontSize:12, cursor:'pointer'}}>
          + Добавить
        </button>
      </div>
      {showAddForm && (
        <div style={{background:'#f8f8f8', borderRadius:8, padding:12, marginBottom:12}}>
          <div style={{marginBottom:8}}>
            <label style={{fontSize:12, color:'#888'}}>Арендатор из списка</label>
            <select value={form.tenant_id} onChange={e => setForm({...form, tenant_id: e.target.value})}
              style={{width:'100%', padding:'6px', borderRadius:6, border:'1px solid #ddd', fontSize:13, marginTop:4}}>
              <option value="">— Выберите или введите вручную —</option>
              {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          {!form.tenant_id && (
            <div style={{marginBottom:8}}>
              <label style={{fontSize:12, color:'#888'}}>Или введите имя вручную</label>
              <input value={form.tenant_name} onChange={e => setForm({...form, tenant_name: e.target.value})}
                placeholder="ФИО / название"
                style={{width:'100%', padding:'6px', borderRadius:6, border:'1px solid #ddd', fontSize:13, marginTop:4, boxSizing:'border-box'}} />
            </div>
          )}
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8}}>
            <div>
              <label style={{fontSize:12, color:'#888'}}>Дата с</label>
              <input type="date" value={form.date_from} onChange={e => setForm({...form, date_from: e.target.value})}
                style={{width:'100%', padding:'6px', borderRadius:6, border:'1px solid #ddd', fontSize:13, marginTop:4}} />
            </div>
            <div>
              <label style={{fontSize:12, color:'#888'}}>Дата по</label>
              <input type="date" value={form.date_to} onChange={e => setForm({...form, date_to: e.target.value})}
                style={{width:'100%', padding:'6px', borderRadius:6, border:'1px solid #ddd', fontSize:13, marginTop:4}} />
            </div>
          </div>
          <div style={{marginBottom:8}}>
            <label style={{fontSize:12, color:'#888'}}>Комментарий</label>
            <input value={form.comment} onChange={e => setForm({...form, comment: e.target.value})}
              placeholder="Комментарий..."
              style={{width:'100%', padding:'6px', borderRadius:6, border:'1px solid #ddd', fontSize:13, marginTop:4, boxSizing:'border-box'}} />
          </div>
          <div style={{display:'flex', gap:8}}>
            <button className="btn-save" onClick={addHistory}>Сохранить</button>
            <button className="btn-cancel" onClick={() => setShowAddForm(false)}>Отмена</button>
          </div>
        </div>
      )}
      {history.length === 0 ? (
        <div style={{color:'#aaa', fontSize:13, padding:'8px 0'}}>История пуста</div>
      ) : (
        <table style={{fontSize:12}}>
          <thead>
            <tr>
              <th>Арендатор</th><th>С</th><th>По</th><th>Комментарий</th><th style={{width:40}}></th>
            </tr>
          </thead>
          <tbody>
            {history.map(h => (
              <tr key={h.id}>
                <td>
                  {h.tenant_id
                    ? <span style={{color:'#534AB7', cursor:'pointer', textDecoration:'underline'}} onClick={() => onNavigate('tenants', h.tenant_id)}>
                        {h.tenant_name}{h.auto && <span style={{color:'#aaa', fontSize:10, marginLeft:4}}>(авто)</span>}
                      </span>
                    : <span>{h.tenant_name}</span>
                  }
                </td>
                <td>{h.date_from ? new Date(h.date_from).toLocaleDateString('ru-RU') : '—'}</td>
                <td>{h.date_to ? new Date(h.date_to).toLocaleDateString('ru-RU') : '—'}</td>
                <td style={{maxWidth:200, wordBreak:'break-word'}} title={h.comment}>{h.comment || '—'}</td>
                <td><button onClick={() => deleteHistory(h.id)} style={{background:'none', border:'none', color:'#A32D2D', cursor:'pointer', fontSize:12}}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function Objects({ onNavigate, highlightId }) {
  const [objects, setObjects] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [objectTenants, setObjectTenants] = useState([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState(() => localStorage.getItem('objects_filterStatus') || '');
const [filterFloor, setFilterFloor] = useState(() => localStorage.getItem('objects_filterFloor') || '');
const [filterType, setFilterType] = useState(() => localStorage.getItem('objects_filterType') || '');
const [filterShared, setFilterShared] = useState(() => localStorage.getItem('objects_filterShared') || '');
const [filterTenant, setFilterTenant] = useState(() => localStorage.getItem('objects_filterTenant') || '');
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingStatus, setEditingStatus] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [editingValue, setEditingValue] = useState('');
  const [note, setNote] = useState('');
  const [editingNote, setEditingNote] = useState(false);
  const [noteValue, setNoteValue] = useState('');
  const [sortField, setSortField] = useState(() => localStorage.getItem('objects_sortField') || 'name');
const [sortDir, setSortDir] = useState(() => localStorage.getItem('objects_sortDir') || 'asc');
  const [showTenantsModal, setShowTenantsModal] = useState(false);
  const [selectedObjectForTenants, setSelectedObjectForTenants] = useState(null);
  const [objectTenantsList, setObjectTenantsList] = useState([]);
  const [addingTenant, setAddingTenant] = useState('');
  const [showNewTenantFromObject, setShowNewTenantFromObject] = useState(false);
  const [newTenantForm, setNewTenantForm] = useState({});
  const [page, setPage] = useState(() => {
    const saved = localStorage.getItem('objects_page');
    return saved ? parseInt(saved) : 1;
  });
  const [lastUpdated, setLastUpdated] = useState(null);
  const [showCheckout, setShowCheckout] = useState(false);
const [checkoutData, setCheckoutData] = useState({ tenantId: '', tenantName: '', objectId: '', date: '', comment: '' });

  useEffect(() => { fetchAll(false); }, []);

  useEffect(() => {
    if (highlightId && objects.length > 0) {
      const o = objects.find(o => o.id === highlightId);
      if (o) { setSelected(o); window.scrollTo(0, 0); }
    }
  }, [highlightId, objects]);

  // Сохраняем страницу в localStorage
  useEffect(() => {
    localStorage.setItem('objects_page', String(page));
  }, [page]);

  // Сбрасываем страницу при изменении фильтров
useEffect(() => {
  setPage(1);
}, [search, filterStatus, filterFloor, filterType, filterShared, filterTenant]);

useEffect(() => { localStorage.setItem('objects_filterStatus', filterStatus); }, [filterStatus]);
useEffect(() => { localStorage.setItem('objects_filterFloor', filterFloor); }, [filterFloor]);
useEffect(() => { localStorage.setItem('objects_filterType', filterType); }, [filterType]);
useEffect(() => { localStorage.setItem('objects_filterShared', filterShared); }, [filterShared]);
useEffect(() => { localStorage.setItem('objects_filterTenant', filterTenant); }, [filterTenant]);
useEffect(() => { localStorage.setItem('objects_sortField', sortField); }, [sortField]);
useEffect(() => { localStorage.setItem('objects_sortDir', sortDir); }, [sortDir]);

  async function fetchAll(forceRefresh = false) {
    // Проверяем кэш
    if (!forceRefresh) {
      const cached = localStorage.getItem(CACHE_KEY);
      const cachedTime = localStorage.getItem(CACHE_TIME_KEY);
      if (cached && cachedTime && Date.now() - parseInt(cachedTime) < CACHE_TTL) {
        try {
          const { objs, tens, ot, noteVal } = JSON.parse(cached);
          setObjects(objs || []);
          setTenants(tens || []);
          setObjectTenants(ot || []);
          setNote(noteVal || '');
          setLastUpdated(new Date(parseInt(cachedTime)));
          setLoading(false);
          return;
        } catch(e) {}
      }
    }

    forceRefresh ? setRefreshing(true) : setLoading(true);

    const { data: objs } = await supabase.from('objects').select('*').is('deleted_at', null).order('name');
    const { data: tens } = await supabase.from('tenants').select('*').is('deleted_at', null).order('name');
    const { data: noteData } = await supabase.from('settings').select('value').eq('id', 'objects_note').single();
    const ot = await dbQuery(`SELECT ot.*, t.name as tenant_name FROM object_tenants ot JOIN tenants t ON t.id = ot.tenant_id WHERE t.deleted_at IS NULL`);

    const now = Date.now();
    localStorage.setItem(CACHE_KEY, JSON.stringify({ objs, tens, ot, noteVal: noteData?.value || '' }));
    localStorage.setItem(CACHE_TIME_KEY, String(now));

    setObjects(objs || []);
    setTenants(tens || []);
    setObjectTenants(ot || []);
    setNote(noteData?.value || '');
    setLastUpdated(new Date(now));
    setLoading(false);
    setRefreshing(false);
  }

  async function fetchObjectTenants(objectId) {
    const rows = await dbQuery(`SELECT ot.*, t.name as tenant_name FROM object_tenants ot JOIN tenants t ON t.id = ot.tenant_id WHERE ot.object_id = $1 AND t.deleted_at IS NULL ORDER BY ot.is_primary DESC, t.name ASC`, [objectId]);
    setObjectTenantsList(rows);
  }

  function openTenantsModal(o) {
    setSelectedObjectForTenants(o);
    setShowTenantsModal(true);
    fetchObjectTenants(o.id);
    setAddingTenant('');
  }

  async function addTenantToObject(tenantId) {
    if (!tenantId) return;
    await dbQuery(`INSERT INTO object_tenants (object_id, tenant_id, is_primary) VALUES ($1, $2, false) ON CONFLICT DO NOTHING`, [selectedObjectForTenants.id, tenantId]);
    await fetchObjectTenants(selectedObjectForTenants.id);
    await fetchAll(true);
    setAddingTenant('');
  }

  async function removeTenantFromObject(id) {
    if (!window.confirm('Убрать арендатора с объекта?')) return;
    await dbQuery(`DELETE FROM object_tenants WHERE id = $1`, [id]);
    await fetchObjectTenants(selectedObjectForTenants.id);
    await fetchAll(true);
  }

  async function setPrimaryTenant(id) {
    await dbQuery(`UPDATE object_tenants SET is_primary = false WHERE object_id = $1`, [selectedObjectForTenants.id]);
    await dbQuery(`UPDATE object_tenants SET is_primary = true WHERE id = $1`, [id]);
    await fetchObjectTenants(selectedObjectForTenants.id);
    await fetchAll(true);
  }

  async function saveNewTenantFromObject() {
    if (!newTenantForm.name) return alert('Введите имя арендатора');
    const res = await fetch('/api/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `INSERT INTO tenants (name, type, status, activity, comments, object_id, shared, contract_end) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        params: [newTenantForm.name, newTenantForm.type||'ФИЗ.ЛИЦО', newTenantForm.status||'Активный', newTenantForm.activity||null, newTenantForm.comments||null, newTenantForm.object_id||null, false, newTenantForm.contract_end||null]
      })
    });
    const data = await res.json();
    const newTenantId = data.rows?.[0]?.id;
    if (newTenantId && newTenantForm.object_id) {
      await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `INSERT INTO object_tenants (object_id, tenant_id, is_primary) VALUES ($1,$2,false) ON CONFLICT DO NOTHING`,
          params: [newTenantForm.object_id, newTenantId]
        })
      });
    }
    setShowNewTenantFromObject(false);
    setNewTenantForm({});
    fetchAll(true);
  }

  function handleSort(field) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  }

  function sortIcon(field) {
    if (sortField !== field) return <span style={{color:'#ccc', marginLeft:4}}>↕</span>;
    return <span style={{marginLeft:4}}>{sortDir === 'asc' ? '↑' : '↓'}</span>;
  }

  const types = [...new Set(objects.map(o => o.type).filter(Boolean))];
  const floors = [...new Set(objects.map(o => o.floor).filter(Boolean))].sort((a,b)=>a-b);
  const getObjectTenants = (id) => objectTenants.filter(ot => ot.object_id === id);

  const filtered = objects.filter(o => {
    if (search && !o.name?.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterStatus && o.status !== filterStatus) return false;
    if (filterFloor && o.floor !== parseInt(filterFloor)) return false;
    if (filterType && o.type !== filterType) return false;
    if (filterShared && (filterShared === 'да' ? !o.shared : o.shared)) return false;
    if (filterTenant && !getObjectTenants(o.id).find(ot => ot.tenant_id === filterTenant)) return false;
    return true;
  }).sort((a, b) => {
    let va = a[sortField], vb = b[sortField];
    if (va == null) va = ''; if (vb == null) vb = '';
    if (typeof va === 'number' && typeof vb === 'number') return sortDir === 'asc' ? va - vb : vb - va;
    return sortDir === 'asc' ? String(va).localeCompare(String(vb), 'ru') : String(vb).localeCompare(String(va), 'ru');
  });

  // Пагинация
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const rented = objects.filter(o => o.status === 'Сдано');
  const free = objects.filter(o => o.status === 'Не сдано');

  async function quickUpdate(id, field, value) {
    const now = new Date().toISOString();
    await supabase.from('objects').update({ [field]: value, updated_at: now }).eq('id', id);
    const updated = objects.map(o => o.id === id ? { ...o, [field]: value, updated_at: now } : o);
    setObjects(updated);
    // Обновляем кэш
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const data = JSON.parse(cached);
        data.objs = updated;
        localStorage.setItem(CACHE_KEY, JSON.stringify(data));
      } catch(e) {}
    }
    setEditingField(null);
  }

  function openAdd() { setForm({ status: 'Не сдано', shared: false, address: 'Г.САРАТОВ. ' }); setShowForm(true); }
  function openEdit(o) {
    const autoAddress = o.address || `Г.САРАТОВ. ${o.type ? o.type + '. ' : ''}${o.name}${o.floor ? ', ' + o.floor + ' этаж' : ''}${o.area ? ', ' + o.area + ' кв. м.' : ''}`;
    setForm({ ...o, address: autoAddress });
    setShowForm(true);
    setSelected(null);
  }

  async function saveForm() {
    if (!form.name) return alert('Введите название объекта');
    const now = new Date().toISOString();
    if (form.id) await supabase.from('objects').update({ ...form, updated_at: now }).eq('id', form.id);
    else await supabase.from('objects').insert({ ...form, updated_at: now });
    setShowForm(false);
    fetchAll(true);
  }
async function deleteObj(id) {
  if (!window.confirm('Переместить объект в корзину?')) return;
  await supabase.from('objects').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  setSelected(null);
  fetchAll(true);
}
  async function confirmCheckout() {
  try {
    await supabase.from('tenants').update({ status: 'Съехал' }).eq('id', checkoutData.tenantId);
    await fetch('/api/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `INSERT INTO object_history (object_id, tenant_id, tenant_name, date_from, date_to, comment, auto) VALUES ($1, $2, $3, $4, $5, $6, false)`,
        params: [checkoutData.objectId, checkoutData.tenantId, checkoutData.tenantName, checkoutData.contractStart || checkoutData.createdAt?.split('T')[0] || null, checkoutData.date, checkoutData.comment || 'Съехал']
      })
    });
    await fetch('/api/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `DELETE FROM object_tenants WHERE tenant_id = $1`,
        params: [checkoutData.tenantId]
      })
    });
    await supabase.from('tenants').update({ 
  object_id: null,
  comments: checkoutData.comment ? `Съехал ${checkoutData.date}: ${checkoutData.comment}` : `Съехал ${checkoutData.date}`
}).eq('id', checkoutData.tenantId);
    const remainRes = await fetch('/api/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `SELECT COUNT(*) as cnt FROM object_tenants WHERE object_id = $1`,
        params: [checkoutData.objectId]
      })
    });
    const remainData = await remainRes.json();
    const cnt = parseInt(remainData.rows?.[0]?.cnt || 0);
    if (cnt === 0) {
      await supabase.from('objects').update({ status: 'Не сдано' }).eq('id', checkoutData.objectId);
    }
    setShowCheckout(false);
    setCheckoutData({ tenantId: '', tenantName: '', objectId: '', date: '', comment: '' });
    fetchAll(true);
    setSelected(null);
  } catch(e) {
    alert('Ошибка: ' + e.message);
  }
}

  function statusBadge(o) {
    const s = o.status;
    const cls = s === 'Сдано' ? 'badge-green' : s === 'Не сдано' ? 'badge-red' : s === 'Освобождается с 1 числа' ? 'badge-amber' : 'badge-gray';
    return <span className={`badge ${cls}`} style={{cursor:'pointer'}} onClick={e => { e.stopPropagation(); setEditingStatus(o.id); }}>{s} ▾</span>;
  }

  function formatDateTime(dt) {
    if (!dt) return '—';
    const d = new Date(dt);
    return d.toLocaleDateString('ru-RU') + ' ' + d.toLocaleTimeString('ru-RU', {hour:'2-digit', minute:'2-digit'});
  }

  const thStyle = {cursor:'pointer', userSelect:'none', whiteSpace:'nowrap'};

  return (
    <div>
      <div className="stats">
        <div className="stat"><div className="stat-label">Всего объектов</div><div className="stat-val purple">{objects.length}</div></div>
        <div className="stat"><div className="stat-label">Сдано</div><div className="stat-val green">{rented.length}</div></div>
        <div className="stat"><div className="stat-label">Свободно</div><div className="stat-val red">{free.length}</div></div>
        <div className="stat" style={{cursor:'pointer'}} onClick={() => { setEditingNote(true); setNoteValue(note); }}>
          <div className="stat-label">📝 Заметка {!editingNote && <span style={{fontSize:10,color:'#aaa'}}>✎</span>}</div>
          {editingNote ? (
            <textarea autoFocus value={noteValue} onChange={e => setNoteValue(e.target.value)}
              onBlur={async () => { await supabase.from('settings').update({value: noteValue}).eq('id','objects_note'); setNote(noteValue); setEditingNote(false); }}
              onKeyDown={e => { if(e.key==='Escape') setEditingNote(false); }}
              style={{width:'100%',fontSize:13,border:'1px solid #ddd',borderRadius:6,padding:6,resize:'none',height:60}}
              onClick={e => e.stopPropagation()} />
          ) : (
            <div style={{fontSize:13,color:note?'#1a1a1a':'#aaa',marginTop:4,whiteSpace:'pre-wrap',wordBreak:'break-word'}}>
              {note || 'Нажмите чтобы добавить заметку...'}
            </div>
          )}
        </div>
      </div>

      <div className="toolbar">
        <input placeholder="Поиск по названию..." value={search} onChange={e => setSearch(e.target.value)} />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">Все статусы</option>
          <option>Сдано</option><option>Не сдано</option><option>Освобождается с 1 числа</option><option>Не учитывать</option><option>Не указано</option>
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">Все типы</option>
          {types.map(t => <option key={t}>{t}</option>)}
        </select>
        <select value={filterFloor} onChange={e => setFilterFloor(e.target.value)}>
          <option value="">Все этажи</option>
          {floors.map(f => <option key={f} value={f}>{f} этаж</option>)}
        </select>
        <select value={filterTenant} onChange={e => setFilterTenant(e.target.value)}>
          <option value="">Все арендаторы</option>
          {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select value={filterShared} onChange={e => setFilterShared(e.target.value)}>
          <option value="">Совместное: все</option>
          <option value="да">Да</option><option value="нет">Нет</option>
        </select>
            {(filterStatus || filterFloor || filterType || filterShared || filterTenant || search) && (
  <button onClick={() => { setFilterStatus(''); setFilterFloor(''); setFilterType(''); setFilterShared(''); setFilterTenant(''); setSearch(''); }}
    style={{background:'#FCEBEB', color:'#A32D2D', border:'none', borderRadius:6, padding:'7px 12px', fontSize:13, cursor:'pointer', whiteSpace:'nowrap'}}>
    ✕ Сбросить фильтры
  </button>
)}
        <button className="btn-add" onClick={openAdd}>+ Добавить объект</button>
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
          <div style={{overflowX:'auto'}}>
            <table>
              <thead>
                <tr>
                  <th style={thStyle} onClick={() => handleSort('name')}>Название{sortIcon('name')}</th>
                  <th style={thStyle} onClick={() => handleSort('type')}>Тип{sortIcon('type')}</th>
                  <th style={thStyle} onClick={() => handleSort('status')}>Статус{sortIcon('status')}</th>
                  <th style={thStyle} onClick={() => handleSort('office')}>№ оф/кв{sortIcon('office')}</th>
                  <th style={thStyle} onClick={() => handleSort('area')}>Площадь{sortIcon('area')}</th>
                  <th>Арендаторы</th>
                  <th style={thStyle} onClick={() => handleSort('rent')}>₽/мес{sortIcon('rent')}</th>
                  <th style={thStyle} onClick={() => handleSort('utility_cost')}>Коммуналка ₽{sortIcon('utility_cost')}</th>
                  <th>Вид коммуналки</th>
                  <th style={thStyle} onClick={() => handleSort('payment')}>Оплата{sortIcon('payment')}</th>
                  <th>Совместное</th>
                  <th>Комментарии</th>
                  <th style={thStyle} onClick={() => handleSort('updated_at')}>Изменён{sortIcon('updated_at')}</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map(o => {
                  const ots = getObjectTenants(o.id);
                  return (
                    <tr key={o.id} onClick={() => setSelected(o)}>
                      <td>{o.name}</td>
                      <td>{o.type}</td>
                      <td onClick={e => e.stopPropagation()}>
                        {editingStatus === o.id ? (
                          <select autoFocus value={o.status||''} onChange={e => { quickUpdate(o.id, 'status', e.target.value); setEditingStatus(null); }} onBlur={() => setEditingStatus(null)}>
                            <option>Сдано</option><option>Не сдано</option><option>Освобождается с 1 числа</option><option>Не учитывать</option><option>Не указано</option>
                          </select>
                        ) : statusBadge(o)}
                      </td>
                      <td>{o.floor || '—'}</td>
                        <td>{o.office || '—'}</td>
                      <td>{o.area ? `${o.area} м²` : '—'}</td>
                      <td onClick={e => e.stopPropagation()}>
                        <div style={{display:'flex', flexDirection:'column', gap:2}}>
                          {ots.length === 0 && <span style={{color:'#aaa'}}>—</span>}
                          {ots.map(ot => (
                            <span key={ot.id} style={{color:'#534AB7', cursor:'pointer', textDecoration:'underline', fontSize:12, display:'flex', alignItems:'center', gap:4}}
                              onClick={() => onNavigate('tenants', ot.tenant_id)}>
                              {ot.is_primary && <span style={{color:'#f59e0b', fontSize:10}}>★</span>}
                              {ot.tenant_name}
                            </span>
                          ))}
                          <span style={{color:'#534AB7', cursor:'pointer', fontSize:11, marginTop:2}} onClick={() => openTenantsModal(o)}>✎ изменить</span>
                        </div>
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        {editingField === o.id+'_rent' ? (
                          <input autoFocus type="number" value={editingValue} onChange={e => setEditingValue(e.target.value)}
                            onBlur={() => quickUpdate(o.id, 'rent', parseFloat(editingValue))}
                            onKeyDown={e => { if(e.key==='Enter') quickUpdate(o.id, 'rent', parseFloat(editingValue)); if(e.key==='Escape') setEditingField(null); }}
                            style={{width:90}} />
                        ) : (
                          <span style={{cursor:'pointer'}} onClick={() => { setEditingField(o.id+'_rent'); setEditingValue(o.rent||''); }}>
                            {o.rent ? o.rent.toLocaleString('ru-RU')+' ₽' : '— ✎'}
                          </span>
                        )}
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        {editingField === o.id+'_utility' ? (
                          <input autoFocus type="number" value={editingValue} onChange={e => setEditingValue(e.target.value)}
                            onBlur={() => quickUpdate(o.id, 'utility_cost', parseFloat(editingValue))}
                            onKeyDown={e => { if(e.key==='Enter') quickUpdate(o.id, 'utility_cost', parseFloat(editingValue)); if(e.key==='Escape') setEditingField(null); }}
                            style={{width:90}} />
                        ) : (
                          <span style={{cursor:'pointer'}} onClick={() => { setEditingField(o.id+'_utility'); setEditingValue(o.utility_cost||''); }}>
                            {o.utility_cost ? o.utility_cost.toLocaleString('ru-RU')+' ₽' : '— ✎'}
                          </span>
                        )}
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        <select value={o.utility_type||''} onChange={e => quickUpdate(o.id, 'utility_type', e.target.value)}
                          style={{fontSize:12, border:'1px solid #ddd', borderRadius:4, padding:'2px 4px'}}>
                          <option value="">Не указано</option>
                          <option>Фиксированная</option><option>По счётчику</option>
                        </select>
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        {editingField === o.id+'_payment' ? (
                          <input autoFocus value={editingValue} onChange={e => setEditingValue(e.target.value)}
                            onBlur={() => quickUpdate(o.id, 'payment', editingValue)}
                            onKeyDown={e => { if(e.key==='Enter') quickUpdate(o.id, 'payment', editingValue); if(e.key==='Escape') setEditingField(null); }}
                            style={{width:120}} />
                        ) : (
                          <span style={{cursor:'pointer'}} onClick={() => { setEditingField(o.id+'_payment'); setEditingValue(o.payment||''); }}>
                            {o.payment || '— ✎'}
                          </span>
                        )}
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={o.shared||false} onChange={e => quickUpdate(o.id, 'shared', e.target.checked)} />
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        {editingField === o.id+'_comments' ? (
                          <input autoFocus value={editingValue} onChange={e => setEditingValue(e.target.value)}
                            onBlur={() => quickUpdate(o.id, 'comments', editingValue)}
                            onKeyDown={e => { if(e.key==='Enter') quickUpdate(o.id, 'comments', editingValue); if(e.key==='Escape') setEditingField(null); }}
                            style={{width:120}} />
                        ) : (
                          <span style={{cursor:'pointer', maxWidth:120, display:'block', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}
                            title={o.comments} onClick={() => { setEditingField(o.id+'_comments'); setEditingValue(o.comments||''); }}>
                            {o.comments || '— ✎'}
                          </span>
                        )}
                      </td>
                      <td style={{fontSize:11, color:'#888', whiteSpace:'nowrap'}}>{formatDateTime(o.updated_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Пагинация */}
          {totalPages > 1 && (
            <div style={{display:'flex', alignItems:'center', gap:8, marginTop:12, justifyContent:'center'}}>
              <button onClick={() => setPage(1)} disabled={page === 1}
                style={{background:'#f4f4f8', border:'1px solid #ddd', borderRadius:6, padding:'5px 10px', cursor:'pointer', fontSize:13, opacity: page===1?0.4:1}}>
                «
              </button>
              <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1}
                style={{background:'#f4f4f8', border:'1px solid #ddd', borderRadius:6, padding:'5px 10px', cursor:'pointer', fontSize:13, opacity: page===1?0.4:1}}>
                ‹
              </button>
              {Array.from({length: totalPages}, (_, i) => i+1).filter(p => Math.abs(p - page) <= 2).map(p => (
                <button key={p} onClick={() => setPage(p)}
                  style={{background: p===page ? '#534AB7' : '#f4f4f8', color: p===page ? '#fff' : '#333',
                    border:'1px solid #ddd', borderRadius:6, padding:'5px 10px', cursor:'pointer', fontSize:13, fontWeight: p===page?600:400}}>
                  {p}
                </button>
              ))}
              <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages}
                style={{background:'#f4f4f8', border:'1px solid #ddd', borderRadius:6, padding:'5px 10px', cursor:'pointer', fontSize:13, opacity: page===totalPages?0.4:1}}>
                ›
              </button>
              <button onClick={() => setPage(totalPages)} disabled={page === totalPages}
                style={{background:'#f4f4f8', border:'1px solid #ddd', borderRadius:6, padding:'5px 10px', cursor:'pointer', fontSize:13, opacity: page===totalPages?0.4:1}}>
                »
              </button>
            </div>
          )}
        </>
      )}

      <div className="page-info">Показано {((page-1)*PAGE_SIZE)+1}–{Math.min(page*PAGE_SIZE, filtered.length)} из {filtered.length} (всего {objects.length})</div>

      {showTenantsModal && selectedObjectForTenants && (
        <div className="modal-overlay" onClick={() => setShowTenantsModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">
              👥 Арендаторы — {selectedObjectForTenants.name}
              <button className="modal-close" onClick={() => setShowTenantsModal(false)}>✕ Закрыть</button>
            </div>
            {objectTenantsList.length === 0 ? (
              <div style={{color:'#aaa', textAlign:'center', padding:20}}>Арендаторы не привязаны</div>
            ) : (
              <table style={{marginBottom:16}}>
                <thead><tr><th>Арендатор</th><th>Главный</th><th style={{width:80}}>Действия</th></tr></thead>
                <tbody>
                  {objectTenantsList.map(ot => (
                    <tr key={ot.id}>
                      <td>
                        <span style={{color:'#534AB7', cursor:'pointer', textDecoration:'underline'}}
                          onClick={() => { setShowTenantsModal(false); onNavigate('tenants', ot.tenant_id); }}>
                          {ot.tenant_name}
                        </span>
                      </td>
                      <td>
                        {ot.is_primary
                          ? <span style={{color:'#f59e0b', fontWeight:500}}>★ Главный</span>
                          : <button onClick={() => setPrimaryTenant(ot.id)}
                              style={{background:'none', border:'1px solid #ddd', borderRadius:4, padding:'2px 8px', cursor:'pointer', fontSize:12}}>
                              Сделать главным
                            </button>
                        }
                      </td>
                      <td>
                        <button onClick={() => removeTenantFromObject(ot.id)}
                          style={{background:'#FCEBEB', color:'#A32D2D', border:'none', borderRadius:6, padding:'4px 8px', cursor:'pointer', fontSize:12}}>✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div style={{display:'flex', gap:8, alignItems:'center', marginBottom:8}}>
              <select value={addingTenant} onChange={e => setAddingTenant(e.target.value)}
                style={{flex:1, padding:'6px 8px', borderRadius:6, border:'1px solid #ddd', fontSize:13}}>
                <option value="">— Выберите арендатора —</option>
                {tenants.filter(t => !objectTenantsList.find(ot => ot.tenant_id === t.id)).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <button className="btn-save" onClick={() => addTenantToObject(addingTenant)} disabled={!addingTenant}>+ Добавить</button>
            </div>
            <button
              onClick={() => { setShowTenantsModal(false); setNewTenantForm({ type: 'ФИЗ.ЛИЦО', status: 'Активный', shared: false, object_id: selectedObjectForTenants.id }); setShowNewTenantFromObject(true); }}
              style={{background:'#3B6D11', color:'#fff', border:'none', borderRadius:6, padding:'7px 14px', fontSize:13, cursor:'pointer', width:'100%'}}>
              + Создать нового арендатора и привязать к объекту
            </button>
          </div>
        </div>
      )}

      {showNewTenantFromObject && (
        <div className="modal-overlay" onClick={() => setShowNewTenantFromObject(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">
              Новый арендатор → {newTenantForm.object_id && objects.find(o => o.id === newTenantForm.object_id)?.name}
              <button className="modal-close" onClick={() => setShowNewTenantFromObject(false)}>✕</button>
            </div>
            <div className="form-group"><label>ФИО / Название *</label>
              <input value={newTenantForm.name||''} onChange={e => setNewTenantForm({...newTenantForm, name: e.target.value})} />
            </div>
            <div className="form-grid">
              <div className="form-group"><label>Тип</label>
                <select value={newTenantForm.type||''} onChange={e => setNewTenantForm({...newTenantForm, type: e.target.value})}>
                  <option>ФИЗ.ЛИЦО</option><option>ЮРИД.ЛИЦО</option><option>ИП</option>
                </select>
              </div>
              <div className="form-group"><label>Статус</label>
                <select value={newTenantForm.status||''} onChange={e => setNewTenantForm({...newTenantForm, status: e.target.value})}>
                  <option>Активный</option><option>В работе</option><option>Неактивный</option>
                </select>
              </div>
              <div className="form-group"><label>Окончание договора</label>
                <input type="date" value={newTenantForm.contract_end||''} onChange={e => setNewTenantForm({...newTenantForm, contract_end: e.target.value})} />
              </div>
              <div className="form-group"><label>Вид деятельности</label>
                <input value={newTenantForm.activity||''} onChange={e => setNewTenantForm({...newTenantForm, activity: e.target.value})} />
              </div>
            </div>
            <div className="form-group"><label>Комментарии</label>
              <textarea rows={2} value={newTenantForm.comments||''} onChange={e => setNewTenantForm({...newTenantForm, comments: e.target.value})} />
            </div>
            <div className="form-actions">
              <button className="btn-cancel" onClick={() => setShowNewTenantFromObject(false)}>Отмена</button>
              <button className="btn-save" onClick={saveNewTenantFromObject}>Сохранить и привязать</button>
            </div>
          </div>
        </div>
      )}

      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{maxWidth:680}}>
            <div className="modal-title">
              {selected.name}
              <button className="modal-close" onClick={() => setSelected(null)}>✕ Закрыть</button>
            </div>
            <div className="detail-row"><div className="detail-key">Статус</div><div className="detail-val">{selected.status}</div></div>
            <div className="detail-row"><div className="detail-key">Тип</div><div className="detail-val">{selected.type||'—'}</div></div>
            <div className="detail-row"><div className="detail-key">Этаж</div><div className="detail-val">{selected.floor||'—'}</div></div>
        <div className="detail-row"><div className="detail-key">№ оф/кв</div><div className="detail-val">{selected.office||'—'}</div></div>
            <div className="detail-row"><div className="detail-key">Площадь</div><div className="detail-val">{selected.area ? `${selected.area} м²` : '—'}</div></div>
            <div className="detail-row"><div className="detail-key">₽/мес</div><div className="detail-val">{selected.rent ? selected.rent.toLocaleString('ru-RU')+' ₽' : '—'}</div></div>
            <div className="detail-row"><div className="detail-key">Коммуналка</div><div className="detail-val">{selected.utility_cost ? selected.utility_cost.toLocaleString('ru-RU')+' ₽' : '—'} {selected.utility_type ? `(${selected.utility_type})` : ''}</div></div>
            <div className="detail-row"><div className="detail-key">Оплата помещения</div><div className="detail-val">{selected.payment||'—'}</div></div>
            <div className="detail-row"><div className="detail-key">Совместное пользование</div><div className="detail-val">{selected.shared ? 'Да' : 'Нет'}</div></div>
            <div className="detail-row"><div className="detail-key">Адрес для договора</div><div className="detail-val" style={{fontSize:12}}>{selected.address||'—'}</div></div>
            <div className="detail-row"><div className="detail-key">Яндекс Диск</div><div className="detail-val">{selected.yandex_link ? <a href={selected.yandex_link} target="_blank" rel="noreferrer">Открыть папку</a> : '—'}</div></div>
            <div className="detail-row"><div className="detail-key">Комментарии</div><div className="detail-val">{selected.comments||'—'}</div></div>
            <div className="detail-row"><div className="detail-key">Изменён</div><div className="detail-val">{formatDateTime(selected.updated_at)}</div></div>
            <div className="linked-section">
              <div className="linked-title">Арендаторы</div>
              {getObjectTenants(selected.id).length === 0
                ? <div style={{color:'#aaa', fontSize:13}}>Не привязаны</div>
                : getObjectTenants(selected.id).map(ot => (
  <div key={ot.id} className="linked-item" style={{display:'flex', alignItems:'center', gap:6, justifyContent:'space-between'}}>
    <span style={{cursor:'pointer', color:'#534AB7'}}
      onClick={() => { setSelected(null); onNavigate('tenants', ot.tenant_id); }}>
      {ot.is_primary && <span style={{color:'#f59e0b'}}>★</span>}
      → {ot.tenant_name}
    </span>
    <button onClick={e => { e.stopPropagation(); const tenantData = tenants ? tenants.find(t => t.id === ot.tenant_id) : null; setCheckoutData({ tenantId: ot.tenant_id, tenantName: ot.tenant_name, objectId: selected.id, date: new Date().toISOString().split('T')[0], comment: '', contractStart: tenantData?.contract_start || tenantData?.created_at?.split('T')[0] || null, createdAt: tenantData?.created_at || null }); setShowCheckout(true); }}
      style={{background:'#FCEBEB', color:'#A32D2D', border:'none', borderRadius:6, padding:'3px 8px', fontSize:11, cursor:'pointer', whiteSpace:'nowrap'}}>
      🚪 Съехал
    </button>
  </div>
))
              }
              <div style={{marginTop:8}}>
                <button style={{background:'#534AB7', color:'#fff', border:'none', borderRadius:6, padding:'6px 12px', fontSize:12, cursor:'pointer'}}
                  onClick={() => { setSelected(null); openTenantsModal(selected); }}>
                  ✎ Управлять арендаторами
                </button>
              </div>
            </div>
            <HistorySection objectId={selected.id} tenants={tenants} onNavigate={onNavigate} />
            <div className="form-actions">
              <button className="btn-cancel" onClick={() => deleteObj(selected.id)}>В корзину</button>
              <button className="btn-save" onClick={() => openEdit(selected)}>Редактировать</button>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">
              {form.id ? 'Редактировать объект' : 'Новый объект'}
              <button className="modal-close" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <div className="form-group"><label>Название *</label><input value={form.name||''} onChange={e => setForm({...form, name: e.target.value})} /></div>
            <div className="form-grid">
              <div className="form-group"><label>Тип</label><input value={form.type||''} onChange={e => setForm({...form, type: e.target.value})} /></div>
              <div className="form-group"><label>Статус</label>
                <select value={form.status||''} onChange={e => setForm({...form, status: e.target.value})}>
                  <option>Сдано</option><option>Не сдано</option><option>Освобождается с 1 числа</option><option>Не учитывать</option><option>Не указано</option>
                </select>
              </div>
              <div className="form-group"><label>Этаж</label><input type="number" value={form.floor||''} onChange={e => setForm({...form, floor: parseInt(e.target.value)})} /></div>
              <div className="form-group"><label>Номер офиса</label><input value={form.office||''} onChange={e => setForm({...form, office: e.target.value})} /></div>
              <div className="form-group"><label>Площадь (м²)</label><input type="number" value={form.area||''} onChange={e => setForm({...form, area: parseFloat(e.target.value)})} /></div>
              <div className="form-group"><label>₽/мес</label><input type="number" value={form.rent||''} onChange={e => setForm({...form, rent: parseFloat(e.target.value)})} /></div>
              <div className="form-group"><label>Страховой взнос (₽)</label><input type="number" value={form.insurance||''} onChange={e => setForm({...form, insurance: parseFloat(e.target.value)})} /></div>
              <div className="form-group"><label>Оплата помещения</label>
                <input value={form.payment||''} onChange={e => setForm({...form, payment: e.target.value})} placeholder="например: с 25 по 05 числа" />
              </div>
              <div className="form-group"><label>Коммуналка (₽)</label><input type="number" value={form.utility_cost||''} onChange={e => setForm({...form, utility_cost: parseFloat(e.target.value)})} /></div>
              <div className="form-group"><label>Вид коммуналки</label>
                <select value={form.utility_type||''} onChange={e => setForm({...form, utility_type: e.target.value})}>
                <option value="">Не указано</option><option>Фиксированная</option><option>По счётчику</option>
                </select>
              </div>
            </div>
            <div className="form-group"><label>Адрес для договора</label>
              <input value={form.address||''} onChange={e => setForm({...form, address: e.target.value})}
                placeholder="Г.САРАТОВ.УЛ.2-Я ВЫСЕЛОЧНАЯ ЗД.21стр.1. ОФ №1, 3 этаж, 21,0 кв. м." />
            </div>
            <div className="form-group"><label>Ссылка на Яндекс Диск</label><input value={form.yandex_link||''} onChange={e => setForm({...form, yandex_link: e.target.value})} placeholder="https://disk.yandex.ru/..." /></div>
            <div className="form-group"><label>Комментарии</label><textarea rows={2} value={form.comments||''} onChange={e => setForm({...form, comments: e.target.value})} /></div>
            <div className="form-group"><label><input type="checkbox" checked={form.shared||false} onChange={e => setForm({...form, shared: e.target.checked})} /> Совместное пользование</label></div>
            <div className="form-actions">
              <button className="btn-cancel" onClick={() => setShowForm(false)}>Отмена</button>
              <button className="btn-save" onClick={saveForm}>Сохранить</button>
            </div>
          </div>
        </div>
      )}
        {showCheckout && (
  <div className="modal-overlay" onClick={() => setShowCheckout(false)}>
    <div className="modal" onClick={e => e.stopPropagation()} style={{maxWidth:400}}>
      <div className="modal-title">
        🚪 Арендатор съехал
        <button className="modal-close" onClick={() => setShowCheckout(false)}>✕</button>
      </div>
      <p style={{fontSize:13, color:'#555', marginBottom:16}}>
        Подтвердите что <strong>{checkoutData.tenantName}</strong> съехал. Это добавит запись в историю объекта и уберёт привязку.
      </p>
      <div className="form-group"><label>Дата заезда</label>
  <input type="date" value={checkoutData.contractStart || ''}
    onChange={e => setCheckoutData({...checkoutData, contractStart: e.target.value})} />
</div>
<div className="form-group"><label>Дата выезда</label>
  <input type="date" value={checkoutData.date}
    onChange={e => setCheckoutData({...checkoutData, date: e.target.value})} />
</div>
      <div className="form-group"><label>Комментарий</label>
        <input value={checkoutData.comment}
          onChange={e => setCheckoutData({...checkoutData, comment: e.target.value})}
          placeholder="Необязательно..." />
      </div>
      <div className="form-actions">
        <button className="btn-cancel" onClick={() => setShowCheckout(false)}>Отмена</button>
        <button style={{background:'#A32D2D', color:'#fff', border:'none', borderRadius:6, padding:'8px 14px', fontSize:13, cursor:'pointer'}}
          onClick={confirmCheckout}>
          ✓ Подтвердить выезд
        </button>
      </div>
    </div>
  </div>
)}
    </div>
  );
}
