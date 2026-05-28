import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import Documents from './Documents';

const PAGE_SIZE = 30;
const CACHE_KEY = 'tenants_cache';
const CACHE_TIME_KEY = 'tenants_cache_time';
const CACHE_TTL = 60 * 1000;

export default function Tenants({ onNavigate, highlightId }) {
  const [tenants, setTenants] = useState([]);
  const [objects, setObjects] = useState([]);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState(() => localStorage.getItem('tenants_filterType') || '');
  const [filterStatus, setFilterStatus] = useState(() => localStorage.getItem('tenants_filterStatus') || 'Активный');
  const [filterShared, setFilterShared] = useState(() => localStorage.getItem('tenants_filterShared') || '');
  const [filterObject, setFilterObject] = useState(() => localStorage.getItem('tenants_filterObject') || '');
  const [sortField, setSortField] = useState(() => localStorage.getItem('tenants_sortField') || 'created_at');
  const [sortDir, setSortDir] = useState(() => localStorage.getItem('tenants_sortDir') || 'desc');
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingStatus, setEditingStatus] = useState(null);
  const [showDocuments, setShowDocuments] = useState(false);
  const [dadataLoading, setDadataLoading] = useState(false);
  const [declLoading, setDeclLoading] = useState(false);
  const [page, setPage] = useState(() => parseInt(localStorage.getItem('tenants_page') || '1'));
  const [lastUpdated, setLastUpdated] = useState(null);
  const [tenantHistory, setTenantHistory] = useState([]);
  const [tenantTotalRent, setTenantTotalRent] = useState(0);
  const [showCheckoutTenant, setShowCheckoutTenant] = useState(false);
  const [checkoutTenantData, setCheckoutTenantData] = useState({ date: '', comment: '' });
  const DADATA_TOKEN = '7be74127271a523420eaf85a792d97badec52201';

  useEffect(() => { fetchAll(false); }, []);

  useEffect(() => {
    if (highlightId && tenants.length > 0) {
      const t = tenants.find(t => t.id === highlightId);
      if (t) setSelected(t);
    }
  }, [highlightId, tenants]);

  useEffect(() => {
    if (selected) {
      fetchTenantDetails(selected.id);
      setCheckoutTenantData({ date: new Date().toISOString().split('T')[0], comment: '' });
    }
  }, [selected]);

  useEffect(() => { localStorage.setItem('tenants_page', String(page)); }, [page]);
  useEffect(() => { setPage(1); }, [search, filterType, filterStatus, filterShared, filterObject]);
  useEffect(() => { localStorage.setItem('tenants_filterType', filterType); }, [filterType]);
  useEffect(() => { localStorage.setItem('tenants_filterStatus', filterStatus); }, [filterStatus]);
  useEffect(() => { localStorage.setItem('tenants_filterShared', filterShared); }, [filterShared]);
  useEffect(() => { localStorage.setItem('tenants_filterObject', filterObject); }, [filterObject]);
  useEffect(() => { localStorage.setItem('tenants_sortField', sortField); }, [sortField]);
  useEffect(() => { localStorage.setItem('tenants_sortDir', sortDir); }, [sortDir]);

  async function fetchAll(forceRefresh = false) {
    if (!forceRefresh) {
      const cached = localStorage.getItem(CACHE_KEY);
      const cachedTime = localStorage.getItem(CACHE_TIME_KEY);
      if (cached && cachedTime && Date.now() - parseInt(cachedTime) < CACHE_TTL) {
        try {
          const { tens, objs } = JSON.parse(cached);
          setTenants(tens || []);
          setObjects(objs || []);
          setLastUpdated(new Date(parseInt(cachedTime)));
          setLoading(false);
          return;
        } catch(e) {}
      }
    }
    forceRefresh ? setRefreshing(true) : setLoading(true);
    const { data: tens } = await supabase.from('tenants').select('*').is('deleted_at', null).order('created_at', { ascending: false });
    const { data: objs } = await supabase.from('objects').select('*').is('deleted_at', null).order('name');
    const now = Date.now();
    localStorage.setItem(CACHE_KEY, JSON.stringify({ tens, objs }));
    localStorage.setItem(CACHE_TIME_KEY, String(now));
    setTenants(tens || []);
    setObjects(objs || []);
    setLastUpdated(new Date(now));
    setLoading(false);
    setRefreshing(false);
  }

  async function fetchTenantDetails(tenantId) {
    const histRes = await fetch('/api/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `SELECT oh.*, o.name as object_name FROM object_history oh LEFT JOIN objects o ON o.id = oh.object_id WHERE oh.tenant_id = $1 ORDER BY oh.date_to DESC NULLS FIRST`,
        params: [tenantId]
      })
    });
    const histData = await histRes.json();
    setTenantHistory(histData.rows || []);

    const rentRes = await fetch('/api/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `SELECT COALESCE(SUM(o.rent), 0) + COALESCE(SUM(o.utility_cost), 0) as total FROM object_tenants ot JOIN objects o ON o.id = ot.object_id WHERE ot.tenant_id = $1`,
        params: [tenantId]
      })
    });
    const rentData = await rentRes.json();
    setTenantTotalRent(parseFloat(rentData.rows?.[0]?.total || 0));
  }

  async function confirmCheckoutTenant() {
    if (!selected) return;
    try {
      await supabase.from('tenants').update({ status: 'Съехал' }).eq('id', selected.id);
      const otRes = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: `SELECT object_id FROM object_tenants WHERE tenant_id = $1`, params: [selected.id] })
      });
      const otData = await otRes.json();
      for (const row of otData.rows || []) {
        await fetch('/api/db', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: `INSERT INTO object_history (object_id, tenant_id, tenant_name, date_from, date_to, comment, auto) VALUES ($1, $2, $3, $4, $5, $6, false)`,
            params: [row.object_id, selected.id, selected.name, selected.contract_start || null, checkoutTenantData.date, checkoutTenantData.comment || 'Съехал']
          })
        });
        await fetch('/api/db', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: `DELETE FROM object_tenants WHERE tenant_id = $1`, params: [selected.id] })
        });
        const remainRes = await fetch('/api/db', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: `SELECT COUNT(*) as cnt FROM object_tenants WHERE object_id = $1`, params: [row.object_id] })
        });
        const remainData = await remainRes.json();
        if (parseInt(remainData.rows?.[0]?.cnt || 0) === 0) {
          await supabase.from('objects').update({ status: 'Не сдано' }).eq('id', row.object_id);
        }
      }
      await supabase.from('tenants').update({
        object_id: null,
        comments: checkoutTenantData.comment ? `Съехал ${checkoutTenantData.date}: ${checkoutTenantData.comment}` : `Съехал ${checkoutTenantData.date}`
      }).eq('id', selected.id);
      setShowCheckoutTenant(false);
      setSelected(null);
      fetchAll(true);
    } catch(e) { alert('Ошибка: ' + e.message); }
  }

  function handleSort(field) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  }

  function sortIcon(field) {
    if (sortField !== field) return <span style={{color:'#ccc', marginLeft:4}}>↕</span>;
    return <span style={{marginLeft:4}}>{sortDir === 'asc' ? '↑' : '↓'}</span>;
  }

  const filtered = tenants.filter(t => {
    if (search && !t.name?.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterType && t.type !== filterType) return false;
    if (filterStatus && t.status !== filterStatus) return false;
    if (filterShared && (filterShared === 'да' ? !t.shared : t.shared)) return false;
    if (filterObject) {
      const tenantObj = objects.find(o => o.id === t.object_id);
      if (!tenantObj || tenantObj.type !== filterObject) return false;
    }
    return true;
  }).sort((a, b) => {
    let va = a[sortField], vb = b[sortField];
    if (va == null) va = ''; if (vb == null) vb = '';
    if (sortField === 'contract_end' || sortField === 'contract_start' || sortField === 'created_at') {
      return sortDir === 'asc' ? new Date(va) - new Date(vb) : new Date(vb) - new Date(va);
    }
    return sortDir === 'asc' ? String(va).localeCompare(String(vb), 'ru') : String(vb).localeCompare(String(va), 'ru');
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const active = tenants.filter(t => t.status === 'Активный');
  const withObj = tenants.filter(t => t.object_id);
  const today = new Date();
  const expiring = tenants.filter(t => {
    if (!t.contract_end) return false;
    const d = new Date(t.contract_end);
    const diff = (d - today) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 30;
  });

  async function quickUpdateStatus(id, status) {
    await supabase.from('tenants').update({ status }).eq('id', id);
    const updated = tenants.map(t => t.id === id ? { ...t, status } : t);
    setTenants(updated);
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) { const d = JSON.parse(cached); d.tens = updated; localStorage.setItem(CACHE_KEY, JSON.stringify(d)); }
    } catch(e) {}
    setEditingStatus(null);
  }

  async function findByInn(inn) {
    if (!inn || inn.length < 10) return alert('Введите ИНН (10 или 12 цифр)');
    setDadataLoading(true);
    try {
      const res = await fetch('https://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/party', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Token ${DADATA_TOKEN}` },
        body: JSON.stringify({ query: inn, count: 1 })
      });
      const data = await res.json();
      if (!data.suggestions?.length) { alert('Организация не найдена'); setDadataLoading(false); return; }
      const s = data.suggestions[0];
      const d = s.data;
      setForm(f => ({
        ...f,
        name: s.value || f.name,
        inn: d.inn || f.inn,
        ogrn: d.ogrn || f.ogrn,
        kpp: d.kpp || f.kpp,
        address_legal: d.address?.value || f.address_legal,
        director: d.management?.name || f.director,
        type: d.type === 'INDIVIDUAL' ? 'ИП' : 'ЮРИД.ЛИЦО',
        basis: d.type === 'INDIVIDUAL' ? 'Свидетельства о регистрации' : 'Устава',
      }));
    } catch(e) { alert('Ошибка запроса к DaData'); }
    setDadataLoading(false);
  }

  async function declineName(name, field) {
    if (!name) return alert('Введите ФИО');
    setForm(f => ({ ...f, [field]: name }));
  }

  function openAdd() {
    setForm({ type: 'ФИЗ.ЛИЦО', status: 'Активный', shared: false });
    setShowForm(true);
  }

  function openEdit(t) {
    setForm({ ...t });
    setSelected(null);
    setShowForm(true);
  }

  async function saveForm() {
    if (!form.name) return alert('Введите имя арендатора');
    if (form.id) {
      const oldTenant = tenants.find(t => t.id === form.id);
      if (oldTenant?.object_id && oldTenant.object_id !== form.object_id) {
        await fetch('/api/db', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: `DELETE FROM object_tenants WHERE tenant_id = $1 AND object_id = $2`,
            params: [form.id, oldTenant.object_id]
          })
        });
      }
      await supabase.from('tenants').update(form).eq('id', form.id);
      if (form.object_id) {
        await fetch('/api/db', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: `INSERT INTO object_tenants (object_id, tenant_id, is_primary) VALUES ($1, $2, true) ON CONFLICT DO NOTHING`,
            params: [form.object_id, form.id]
          })
        });
        await supabase.from('objects').update({ status: 'Сдано' }).eq('id', form.object_id);
      }
    } else {
      await supabase.from('tenants').insert(form);
      const { data: newTenants } = await supabase.from('tenants').select('id').eq('name', form.name);
      const newTenant = newTenants?.[newTenants.length - 1];
      if (newTenant && form.object_id) {
        await fetch('/api/db', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: `INSERT INTO object_tenants (object_id, tenant_id, is_primary) VALUES ($1, $2, true) ON CONFLICT DO NOTHING`,
            params: [form.object_id, newTenant.id]
          })
        });
        await supabase.from('objects').update({ status: 'Сдано' }).eq('id', form.object_id);
      }
    }
    setShowForm(false);
    setSelected(null);
    fetchAll(true);
  }

  async function deleteTenant(id) {
    if (!window.confirm('Переместить арендатора в корзину?')) return;
    await supabase.from('tenants').update({ deleted_at: new Date().toISOString() }).eq('id', id);
    setSelected(null);
    fetchAll(true);
  }

  function statusBadge(t) {
    const s = t.status;
    const cls = s === 'Активный' ? 'badge-green' : 'badge-gray';
    return (
      <span className={`badge ${cls}`} style={{cursor:'pointer'}} onClick={e => { e.stopPropagation(); setEditingStatus(t.id); }}>
        {s} ▾
      </span>
    );
  }

  function typeBadge(tp) {
    if (tp === 'ЮРИД.ЛИЦО') return <span className="badge badge-amber">{tp}</span>;
    if (tp === 'ИП') return <span className="badge badge-blue">{tp}</span>;
    return <span className="badge badge-gray">{tp}</span>;
  }

  const getObject = (id) => objects.find(o => o.id === id);
  const daysLeft = (date) => { if (!date) return null; return Math.ceil((new Date(date) - today) / (1000 * 60 * 60 * 24)); };
  const isJuridical = form.type === 'ЮРИД.ЛИЦО' || form.type === 'ИП';
  const isFiz = form.type === 'ФИЗ.ЛИЦО';
  const btnStyle = { background:'#534AB7', color:'#fff', border:'none', borderRadius:6, padding:'0 10px', cursor:'pointer', fontSize:12, whiteSpace:'nowrap', height:36 };
  const thStyle = { cursor:'pointer', userSelect:'none', whiteSpace:'nowrap' };

  return (
    <div>
      {expiring.length > 0 && (
        <div className="alert">
          ⚠️ Истекает договор в ближайшие 30 дней: {expiring.map(t => `${t.name} (${daysLeft(t.contract_end)} дн.)`).join(', ')}
        </div>
      )}

      <div className="stats">
        <div className="stat"><div className="stat-label">Всего арендаторов</div><div className="stat-val purple">{tenants.length}</div></div>
        <div className="stat"><div className="stat-label">Активных</div><div className="stat-val green">{active.length}</div></div>
        <div className="stat"><div className="stat-label">С объектом</div><div className="stat-val">{withObj.length}</div></div>
        <div className="stat"><div className="stat-label">Истекает скоро</div><div className="stat-val red">{expiring.length}</div></div>
      </div>

      <div className="toolbar">
        <input placeholder="Поиск по имени..." value={search} onChange={e => setSearch(e.target.value)} />
        <select value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">Все типы</option>
          <option>ФИЗ.ЛИЦО</option><option>ЮРИД.ЛИЦО</option><option>ИП</option><option>Не указан</option>
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">Все статусы</option>
          <option>Активный</option><option>Неактивный</option><option>В работе</option><option>Съехал</option><option>Не указан</option>
        </select>
        <select value={filterObject} onChange={e => setFilterObject(e.target.value)}>
          <option value="">Все объекты</option>
          {[...new Set(objects.map(o => o.type).filter(Boolean))].map(type => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
        <select value={filterShared} onChange={e => setFilterShared(e.target.value)}>
          <option value="">Совместное: все</option>
          <option value="да">Да</option><option value="нет">Нет</option>
        </select>
        {(filterType || filterStatus || filterShared || filterObject || search) && (
          <button onClick={() => { setFilterType(''); setFilterStatus(''); setFilterShared(''); setFilterObject(''); setSearch(''); }}
            style={{background:'#FCEBEB', color:'#A32D2D', border:'none', borderRadius:6, padding:'7px 12px', fontSize:13, cursor:'pointer', whiteSpace:'nowrap'}}>
            ✕ Сбросить фильтры
          </button>
        )}
        <button className="btn-add" onClick={openAdd}>+ Добавить арендатора</button>
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
                <th style={thStyle} onClick={() => handleSort('name')}>Название / ФИО{sortIcon('name')}</th>
                <th style={thStyle} onClick={() => handleSort('type')}>Тип{sortIcon('type')}</th>
                <th style={thStyle} onClick={() => handleSort('status')}>Статус{sortIcon('status')}</th>
                <th style={thStyle} onClick={() => handleSort('activity')}>Вид деятельности{sortIcon('activity')}</th>
                <th style={thStyle} onClick={() => handleSort('object_id')}>Объект{sortIcon('object_id')}</th>
                <th style={thStyle} onClick={() => handleSort('contract_end')}>Окончание договора{sortIcon('contract_end')}</th>
                <th>В счёт</th>
                <th style={thStyle} onClick={() => handleSort('updated_at')}>Изменён{sortIcon('updated_at')}</th>
                <th>Контакты</th>
                <th style={{width:40}}></th>
              </tr>
            </thead>
            <tbody>
              {paginated.map(t => {
                const obj = getObject(t.object_id);
                const days = daysLeft(t.contract_end);
                return (
                  <tr key={t.id} onClick={() => setSelected(t)}>
                    <td>{t.name}</td>
                    <td>{typeBadge(t.type)}</td>
                    <td onClick={e => e.stopPropagation()}>
                      {editingStatus === t.id ? (
                        <select autoFocus value={t.status}
                          onChange={e => { const val = e.target.value; setEditingStatus(null); quickUpdateStatus(t.id, val); }}
                          onBlur={() => setEditingStatus(null)}>
                          <option>Активный</option><option>Неактивный</option><option>В работе</option><option>Съехал</option><option>Не указан</option>
                        </select>
                      ) : statusBadge(t)}
                    </td>
                    <td>{t.activity || '—'}</td>
                    <td onClick={e => { e.stopPropagation(); if(obj) onNavigate('objects', obj.id); }}>
                      {obj ? <span style={{color:'#534AB7', cursor:'pointer', textDecoration:'underline'}}>{obj.name}</span> : <span style={{color:'#aaa'}}>—</span>}
                    </td>
                    <td>{t.contract_end ? (
                      <span style={{color: days <= 30 ? '#A32D2D' : 'inherit'}}>
                        {new Date(t.contract_end).toLocaleDateString('ru-RU')}
                        {days <= 30 && ` (${days} дн.)`}
                      </span>
                    ) : '—'}</td>
                    <td onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={t.in_invoice || false}
                        onChange={async e => {
                          await supabase.from('tenants').update({ in_invoice: e.target.checked }).eq('id', t.id);
                          setTenants(tenants.map(ten => ten.id === t.id ? { ...ten, in_invoice: e.target.checked } : ten));
                        }} />
                    </td>
                    <td style={{fontSize:11, color:'#888', whiteSpace:'nowrap'}}>{t.updated_at ? new Date(t.updated_at).toLocaleDateString('ru-RU') : '—'}</td>
                    <td onClick={e => { e.stopPropagation(); onNavigate('contacts', t.id); }}>
                      <span style={{color:'#534AB7', cursor:'pointer', textDecoration:'underline'}}>Контакты →</span>
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <button onClick={() => deleteTenant(t.id)}
                        style={{background:'none', border:'none', cursor:'pointer', color:'#A32D2D', fontSize:16}}>✕</button>
                    </td>
                  </tr>
                );
              })}
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

      <div className="page-info">Показано {((page-1)*PAGE_SIZE)+1}–{Math.min(page*PAGE_SIZE, filtered.length)} из {filtered.length} (всего {tenants.length})</div>

      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">
              {selected.name}
              <button className="modal-close" onClick={() => setSelected(null)}>✕ Закрыть</button>
            </div>
            {getObject(selected.object_id) && (
              <div className="detail-row"><div className="detail-key">Объект</div>
                <div className="detail-val" style={{color:'#534AB7', cursor:'pointer'}}
                  onClick={() => { setSelected(null); onNavigate('objects', getObject(selected.object_id).id); }}>
                  → {getObject(selected.object_id).name}
                </div>
              </div>
            )}
            <div className="detail-row"><div className="detail-key">Тип</div><div className="detail-val">{typeBadge(selected.type)}</div></div>
            <div className="detail-row"><div className="detail-key">Статус</div><div className="detail-val">{selected.status}</div></div>
            <div className="detail-row"><div className="detail-key">Вид деятельности</div><div className="detail-val">{selected.activity || '—'}</div></div>
            {selected.type === 'ФИЗ.ЛИЦО' && <>
              <div className="detail-row"><div className="detail-key">Паспорт</div><div className="detail-val" style={{fontSize:12}}>{selected.passport || '—'}</div></div>
              <div className="detail-row"><div className="detail-key">Прописка</div><div className="detail-val" style={{fontSize:12}}>{selected.address || '—'}</div></div>
              <div className="detail-row"><div className="detail-key">ФИО (род. падеж)</div><div className="detail-val">{selected.name_rod || '—'}</div></div>
            </>}
            {(selected.type === 'ЮРИД.ЛИЦО' || selected.type === 'ИП') && <>
              <div className="detail-row"><div className="detail-key">Директор</div><div className="detail-val">{selected.director || '—'}</div></div>
              <div className="detail-row"><div className="detail-key">Директор (род.)</div><div className="detail-val">{selected.director_rod || '—'}</div></div>
              <div className="detail-row"><div className="detail-key">Юр. адрес</div><div className="detail-val" style={{fontSize:12}}>{selected.address_legal || '—'}</div></div>
              <div className="detail-row"><div className="detail-key">КПП</div><div className="detail-val">{selected.kpp || '—'}</div></div>
            </>}
            <div className="detail-row"><div className="detail-key">ИНН</div><div className="detail-val">{selected.inn || '—'}</div></div>
            {(selected.type === 'ЮРИД.ЛИЦО' || selected.type === 'ИП') && selected.inn && (
              <div className="detail-row"><div className="detail-key">РусПрофиль</div>
                <div className="detail-val">
                  <a href={`https://rusprofile.ru/search?query=${selected.inn}`} target="_blank" rel="noreferrer"
                    style={{color:'#534AB7'}}>🔍 Открыть на РусПрофиль</a>
                </div>
              </div>
            )}
            <div className="detail-row"><div className="detail-key">ОГРН</div><div className="detail-val">{selected.ogrn || '—'}</div></div>
            <div className="detail-row"><div className="detail-key">Банк / Р/С / К/С</div><div className="detail-val" style={{fontSize:12, whiteSpace:'pre-wrap'}}>{selected.bank || '—'}</div></div>
            <div className="detail-row"><div className="detail-key">Начало договора</div><div className="detail-val">{selected.contract_start ? new Date(selected.contract_start).toLocaleDateString('ru-RU') : '—'}</div></div>
            <div className="detail-row"><div className="detail-key">Окончание договора</div><div className="detail-val">{selected.contract_end ? new Date(selected.contract_end).toLocaleDateString('ru-RU') : '—'}</div></div>
            <div className="detail-row"><div className="detail-key">Совместное пользование</div><div className="detail-val">{selected.shared ? 'Да' : 'Нет'}</div></div>
            <div className="detail-row"><div className="detail-key">В счёт</div><div className="detail-val">{selected.in_invoice ? '✅ Да' : '—'}</div></div>
            <div className="detail-row"><div className="detail-key">Комментарии</div><div className="detail-val">{selected.comments || '—'}</div></div>

            {tenantTotalRent > 0 && (
              <div className="detail-row"><div className="detail-key">💰 Итого аренда+коммуналка</div>
                <div className="detail-val" style={{fontWeight:500, color:'#3B6D11'}}>{tenantTotalRent.toLocaleString('ru-RU')} ₽/мес</div>
              </div>
            )}

            {tenantHistory.length > 0 && (
              <div className="linked-section">
                <div className="linked-title">📋 История объектов</div>
                <table style={{fontSize:12}}>
                  <thead><tr><th>Объект</th><th>С</th><th>По</th><th>Комментарий</th></tr></thead>
                  <tbody>
                    {tenantHistory.map(h => (
                      <tr key={h.id}>
                        <td>{h.object_name || '—'}</td>
                        <td>{h.date_from ? new Date(h.date_from).toLocaleDateString('ru-RU') : '—'}</td>
                        <td>{h.date_to ? new Date(h.date_to).toLocaleDateString('ru-RU') : '—'}</td>
                        <td style={{maxWidth:150, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{h.comment || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="linked-section">
              <div className="linked-title">Контакты</div>
              <div className="linked-item" style={{cursor:'pointer', color:'#534AB7'}}
                onClick={() => { setSelected(null); onNavigate('contacts', selected.id); }}>
                → Открыть контакты арендатора
              </div>
            </div>
            <div className="form-actions">
              <button className="btn-cancel" onClick={() => deleteTenant(selected.id)}>В корзину</button>
              {selected.status !== 'Съехал' && (
                <button style={{background:'#A32D2D', color:'#fff', border:'none', borderRadius:6, padding:'8px 14px', fontSize:13, cursor:'pointer'}}
                  onClick={() => setShowCheckoutTenant(true)}>
                  🚪 Съехал
                </button>
              )}
              <button style={{background:'#3B6D11', color:'#fff', border:'none', borderRadius:6, padding:'8px 14px', fontSize:13, cursor:'pointer'}} onClick={() => setShowDocuments(true)}>📄 Документы</button>
              <button className="btn-save" onClick={() => openEdit(selected)}>Редактировать</button>
            </div>
          </div>
        </div>
      )}

      {showCheckoutTenant && selected && (
        <div className="modal-overlay" onClick={() => setShowCheckoutTenant(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{maxWidth:400}}>
            <div className="modal-title">
              🚪 Арендатор съехал
              <button className="modal-close" onClick={() => setShowCheckoutTenant(false)}>✕</button>
            </div>
            <p style={{fontSize:13, color:'#555', marginBottom:16}}>
              Подтвердите что <strong>{selected.name}</strong> съехал.
            </p>
            <div className="form-group"><label>Дата выезда</label>
              <input type="date" value={checkoutTenantData.date}
                onChange={e => setCheckoutTenantData({...checkoutTenantData, date: e.target.value})} />
            </div>
            <div className="form-group"><label>Комментарий</label>
              <input value={checkoutTenantData.comment}
                onChange={e => setCheckoutTenantData({...checkoutTenantData, comment: e.target.value})}
                placeholder="Необязательно..." />
            </div>
            <div className="form-actions">
              <button className="btn-cancel" onClick={() => setShowCheckoutTenant(false)}>Отмена</button>
              <button style={{background:'#A32D2D', color:'#fff', border:'none', borderRadius:6, padding:'8px 14px', fontSize:13, cursor:'pointer'}}
                onClick={confirmCheckoutTenant}>
                ✓ Подтвердить выезд
              </button>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">
              {form.id ? 'Редактировать арендатора' : 'Новый арендатор'}
              <button className="modal-close" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <div className="form-group"><label>Объект (помещение)</label>
              <select value={form.object_id || ''} onChange={e => setForm({...form, object_id: e.target.value})}>
                <option value="">— Не назначен —</option>
                {objects.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
            <div className="form-group"><label>ФИО / Название *</label>
              <input value={form.name || ''} onChange={e => setForm({...form, name: e.target.value})} />
            </div>
            <div className="form-grid">
              <div className="form-group"><label>Тип</label>
                <select value={form.type || ''} onChange={e => setForm({...form, type: e.target.value})}>
                  <option>ФИЗ.ЛИЦО</option><option>ЮРИД.ЛИЦО</option><option>ИП</option><option>Не указан</option>
                </select>
              </div>
              <div className="form-group"><label>Статус</label>
                <select value={form.status || ''} onChange={e => setForm({...form, status: e.target.value})}>
                  <option>Активный</option><option>Неактивный</option><option>В работе</option><option>Съехал</option><option>Не указан</option>
                </select>
              </div>
            </div>
            <div className="form-group"><label>Вид деятельности</label>
              <input value={form.activity || ''} onChange={e => setForm({...form, activity: e.target.value})} />
            </div>
            {isFiz && <>
              <div className="form-group"><label>ФИО в родительном падеже</label>
                <div style={{display:'flex', gap:6}}>
                  <input value={form.name_rod || ''} onChange={e => setForm({...form, name_rod: e.target.value})}
                    placeholder="Иванова Ивана Ивановича" style={{flex:1}} />
                  <button type="button" style={btnStyle} onClick={() => declineName(form.name, 'name_rod')}>
                    {declLoading ? '...' : '📝 Склонить'}
                  </button>
                </div>
              </div>
              <div className="form-group"><label>Паспорт</label>
                <textarea rows={2} value={form.passport || ''} onChange={e => setForm({...form, passport: e.target.value})}
                  placeholder="Серия, номер, кем и когда выдан" />
              </div>
              <div className="form-group"><label>Прописка</label>
                <textarea rows={2} value={form.address || ''} onChange={e => setForm({...form, address: e.target.value})}
                  placeholder="Адрес регистрации" />
              </div>
              <div className="form-group"><label>ИНН</label>
                <input value={form.inn || ''} onChange={e => setForm({...form, inn: e.target.value})} />
              </div>
            </>}
            {isJuridical && <>
              <div className="form-group"><label>ИНН</label>
                <div style={{display:'flex', gap:6}}>
                  <input value={form.inn || ''} onChange={e => setForm({...form, inn: e.target.value})} placeholder="Введите ИНН..." style={{flex:1}} />
                  <button type="button" style={btnStyle} onClick={() => findByInn(form.inn)}>
                    {dadataLoading ? '...' : '🔍 Найти'}
                  </button>
                </div>
              </div>
              <div className="form-grid">
                <div className="form-group"><label>ОГРН</label>
                  <input value={form.ogrn || ''} onChange={e => setForm({...form, ogrn: e.target.value})} />
                </div>
                <div className="form-group"><label>КПП</label>
                  <input value={form.kpp || ''} onChange={e => setForm({...form, kpp: e.target.value})} />
                </div>
              </div>
              <div className="form-group"><label>Юридический адрес</label>
                <textarea rows={2} value={form.address_legal || ''} onChange={e => setForm({...form, address_legal: e.target.value})} />
              </div>
              <div className="form-group"><label>Директор (именительный)</label>
                <input value={form.director || ''} onChange={e => setForm({...form, director: e.target.value})}
                  placeholder="Иванов Иван Иванович" />
              </div>
              <div className="form-group"><label>Директор (родительный падеж)</label>
                <div style={{display:'flex', gap:6}}>
                  <input value={form.director_rod || ''} onChange={e => setForm({...form, director_rod: e.target.value})}
                    placeholder="Иванова Ивана Ивановича" style={{flex:1}} />
                  <button type="button" style={btnStyle} onClick={() => declineName(form.director, 'director_rod')}>
                    {declLoading ? '...' : '📝 Склонить'}
                  </button>
                </div>
              </div>
              <div className="form-group"><label>Действует на основании</label>
                <input value={form.basis || ''} onChange={e => setForm({...form, basis: e.target.value})}
                  placeholder={form.type === 'ИП' ? 'Свидетельства о регистрации' : 'Устава'} />
              </div>
            </>}
            <div className="form-group"><label>Банк / Р/С / К/С</label>
              <textarea rows={3} value={form.bank || ''} onChange={e => setForm({...form, bank: e.target.value})}
                placeholder={'Банк: \nР/С: \nК/С: \nБИК: '} />
            </div>
            <div className="form-grid">
              <div className="form-group"><label>Дата начала договора</label>
                <input type="date" value={form.contract_start || ''} onChange={e => setForm({...form, contract_start: e.target.value})} />
              </div>
              <div className="form-group"><label>Окончание договора</label>
                <input type="date" value={form.contract_end || ''} onChange={e => setForm({...form, contract_end: e.target.value})} />
              </div>
            </div>
            <div className="form-group"><label>Комментарии</label>
              <textarea rows={2} value={form.comments || ''} onChange={e => setForm({...form, comments: e.target.value})} />
            </div>
            <div className="form-group"><label>
              <input type="checkbox" checked={form.shared || false} onChange={e => setForm({...form, shared: e.target.checked})} /> Совместное пользование
            </label></div>
            <div className="form-group"><label>
              <input type="checkbox" checked={form.in_invoice || false} onChange={e => setForm({...form, in_invoice: e.target.checked})} /> В счёт
            </label></div>
            <div className="form-actions">
              <button className="btn-cancel" onClick={() => setShowForm(false)}>Отмена</button>
              <button className="btn-save" onClick={saveForm}>Сохранить</button>
            </div>
          </div>
        </div>
      )}

      {showDocuments && selected && (
        <Documents
          tenantId={selected.id}
          tenantName={selected.name}
          onClose={() => setShowDocuments(false)}
        />
      )}
    </div>
  );
}
