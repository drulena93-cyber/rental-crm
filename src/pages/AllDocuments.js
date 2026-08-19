import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const PAGE_SIZE = 30;
const CACHE_KEY = 'documents_cache';
const CACHE_TIME_KEY = 'documents_cache_time';
const CACHE_TTL = 60 * 1000;

export default function AllDocuments({ onNavigate }) {
  const [documents, setDocuments] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [docTypes, setDocTypes] = useState([]);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterTenant, setFilterTenant] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const [page, setPage] = useState(() => parseInt(localStorage.getItem('documents_page') || '1'));
  const [lastUpdated, setLastUpdated] = useState(null);
  const [sortField, setSortField] = useState('created_at');
  const [sortDir, setSortDir] = useState('desc');

  useEffect(() => { fetchAll(false); }, []);

  useEffect(() => {
    localStorage.setItem('documents_page', String(page));
  }, [page]);

  useEffect(() => {
    setPage(1);
  }, [search, filterType, filterTenant, filterDateFrom, filterDateTo]);

  async function fetchAll(forceRefresh = false) {
    if (!forceRefresh) {
      const cached = localStorage.getItem(CACHE_KEY);
      const cachedTime = localStorage.getItem(CACHE_TIME_KEY);
      if (cached && cachedTime && Date.now() - parseInt(cachedTime) < CACHE_TTL) {
        try {
          const { docs, tens, types } = JSON.parse(cached);
          setDocuments(docs || []);
          setTenants(tens || []);
          setDocTypes(types || []);
          setLastUpdated(new Date(parseInt(cachedTime)));
          setLoading(false);
          return;
        } catch(e) {}
      }
    }

    forceRefresh ? setRefreshing(true) : setLoading(true);

    const defaultTypes = ['Договор', 'Акт', 'Счёт', 'Доверенность', 'Скан паспорта', 'Другое'];
    const [docsRes, tensRes, dtRes] = await Promise.all([
      supabase.from('documents').select('*').order('created_at', { ascending: false }),
      supabase.from('tenants').select('id, name').is('deleted_at', null).order('name'),
      fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: `SELECT name FROM document_types ORDER BY created_at`, params: [] })
      }).then(r => r.json()).catch(() => null)
    ]);
    const docs = docsRes.data;
    const tens = tensRes.data;
    const types = dtRes?.rows?.length ? dtRes.rows.map(r => r.name) : defaultTypes;

    const now = Date.now();
    localStorage.setItem(CACHE_KEY, JSON.stringify({ docs, tens, types }));
    localStorage.setItem(CACHE_TIME_KEY, String(now));

    setDocuments(docs || []);
    setTenants(tens || []);
    setDocTypes(types);
    setLastUpdated(new Date(now));
    setLoading(false);
    setRefreshing(false);
  }

  async function updateType(id, type) {
    await supabase.from('documents').update({ type }).eq('id', id);
    const updated = documents.map(d => d.id === id ? { ...d, type } : d);
    setDocuments(updated);
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) { const d = JSON.parse(cached); d.docs = updated; localStorage.setItem(CACHE_KEY, JSON.stringify(d)); }
    } catch(e) {}
    setEditingType(null);
  }

  async function deleteDoc(id) {
    if (!window.confirm('Удалить документ?')) return;
    await supabase.from('documents').delete().eq('id', id);
    const updated = documents.filter(d => d.id !== id);
    setDocuments(updated);
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) { const d = JSON.parse(cached); d.docs = updated; localStorage.setItem(CACHE_KEY, JSON.stringify(d)); }
    } catch(e) {}
  }

  

  function handleSort(field) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  }

  function sortIcon(field) {
    if (sortField !== field) return <span style={{color:'#ccc', marginLeft:4}}>↕</span>;
    return <span style={{marginLeft:4}}>{sortDir === 'asc' ? '↑' : '↓'}</span>;
  }

  const getTenantName = (id) => tenants.find(t => t.id === id)?.name || '—';

  const filtered = documents.filter(d => {
    if (search && !d.name?.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterType && d.type !== filterType) return false;
    if (filterTenant && d.tenant_id !== filterTenant) return false;
    if (filterDateFrom && new Date(d.created_at) < new Date(filterDateFrom)) return false;
    if (filterDateTo && new Date(d.created_at) > new Date(filterDateTo + 'T23:59:59')) return false;
    return true;
  }).sort((a, b) => {
    let va = a[sortField], vb = b[sortField];
    if (va == null) va = ''; if (vb == null) vb = '';
    if (sortField === 'created_at' || sortField === 'file_size') {
      return sortDir === 'asc' ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
    }
    if (sortField === 'tenant_id') { va = getTenantName(va); vb = getTenantName(vb); }
    return sortDir === 'asc' ? String(va).localeCompare(String(vb), 'ru') : String(vb).localeCompare(String(va), 'ru');
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function formatSize(bytes) {
    if (!bytes) return '—';
    if (bytes < 1024) return bytes + ' Б';
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' КБ';
    return (bytes / 1024 / 1024).toFixed(1) + ' МБ';
  }

  function typeBadge(doc) {
    const colors = { 'Договор': 'badge-blue', 'Акт': 'badge-green', 'Доверенность': 'badge-amber', 'Скан паспорта': 'badge-gray', 'Счёт': 'badge-purple', 'Другое': 'badge-gray' };
    if (editingType === doc.id) {
      return (
        <select autoFocus value={doc.type || ''} onChange={e => updateType(doc.id, e.target.value)}
          onBlur={() => setEditingType(null)} style={{fontSize:12, padding:'2px 4px', borderRadius:4}}>
          {docTypes.map(dt => <option key={dt}>{dt}</option>)}
        </select>
      );
    }
    return (
      <span className={`badge ${colors[doc.type] || 'badge-gray'}`} style={{cursor:'pointer'}}
        onClick={() => setEditingType(doc.id)} title="Нажмите чтобы изменить тип">
        {doc.type || 'Другое'} ▾
      </span>
    );
  }

  const thStyle = { cursor:'pointer', userSelect:'none', whiteSpace:'nowrap' };
  const PILL = {
    purple: { bg:'#EDEAFB', border:'#C9BFF2', text:'#534AB7' },
    green:  { bg:'#E1F3D8', border:'#B7DDA0', text:'#2F6B0C' },
    red:    { bg:'#FBE1E1', border:'#EFB3B3', text:'#A32D2D' },
    blue:   { bg:'#DCEBFA', border:'#A8CDEF', text:'#185FA5' },
    amber:  { bg:'#FBEEDA', border:'#F0CE8E', text:'#8A5A0B' },
    gray:   { bg:'#EDEDF2', border:'#D2D2DC', text:'#4a4a55' },
  };
  const tagStyle = (active) => ({
    background: active ? '#534AB7' : PILL.gray.bg,
    color: active ? '#fff' : '#3f3f4a',
    border: active ? '1px solid #534AB7' : `1px solid ${PILL.gray.border}`,
    borderRadius: 16, padding: '5px 12px', fontSize: 12, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap',
    boxShadow: active ? '0 1px 3px rgba(83,74,183,0.35)' : 'none'
  });

  return (
    <div>
      <div className="toolbar" style={{flexWrap:'wrap', alignItems:'center', gap:8}}>
        <input placeholder="Поиск по названию..." value={search} onChange={e => setSearch(e.target.value)} style={{minWidth:160}} />
        <select value={filterTenant} onChange={e => setFilterTenant(e.target.value)}>
          <option value="">Все арендаторы</option>
          {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)}
          title="Дата от" style={{padding:'7px 8px', borderRadius:6, border:'1px solid #ddd', fontSize:13}} />
        <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)}
          title="Дата до" style={{padding:'7px 8px', borderRadius:6, border:'1px solid #ddd', fontSize:13}} />
        {(search || filterType || filterTenant || filterDateFrom || filterDateTo) && (
          <button onClick={() => { setSearch(''); setFilterType(''); setFilterTenant(''); setFilterDateFrom(''); setFilterDateTo(''); }}
            style={{background:'#FCEBEB', color:'#A32D2D', border:'none', borderRadius:6, padding:'7px 12px', fontSize:13, cursor:'pointer', whiteSpace:'nowrap'}}>
            ✕ Сбросить фильтры
          </button>
        )}
        <button onClick={() => fetchAll(true)} disabled={refreshing}
          style={{background:'#f4f4f8', border:'1px solid #ddd', borderRadius:6, padding:'7px 12px', fontSize:13, cursor:'pointer', whiteSpace:'nowrap'}}>
          {refreshing ? '⏳ Обновление...' : '🔄 Обновить'}
        </button>
      </div>

      <div style={{display:'flex', flexWrap:'wrap', gap:6, marginTop:10, marginBottom:12, alignItems:'center'}}>
        <span style={{fontSize:12, color:'#888', marginRight:2}}>Тип:</span>
        <button onClick={() => setFilterType('')} style={tagStyle(filterType === '')}>Все типы</button>
        {docTypes.map(dt => (
          <button key={dt} onClick={() => setFilterType(filterType === dt ? '' : dt)} style={tagStyle(filterType === dt)}>{dt}</button>
        ))}
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
                <th style={thStyle} onClick={() => handleSort('name')}>Название документа{sortIcon('name')}</th>
                <th style={thStyle} onClick={() => handleSort('type')}>Тип{sortIcon('type')}</th>
                <th style={thStyle} onClick={() => handleSort('tenant_id')}>Арендатор{sortIcon('tenant_id')}</th>
                <th>Услуги</th>
                <th style={{textAlign:'right'}}>Сумма</th>
                <th style={thStyle} onClick={() => handleSort('file_size')}>Размер{sortIcon('file_size')}</th>
                <th style={thStyle} onClick={() => handleSort('created_at')}>Дата создания{sortIcon('created_at')}</th>
                <th style={{width:120}}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 && (
                <tr><td colSpan={8} style={{textAlign:'center', color:'#aaa', padding:30}}>Документы не найдены</td></tr>
              )}
              {paginated.map(doc => (
                <tr key={doc.id}>
                  <td>📄 {doc.name}</td>
                  <td onClick={e => e.stopPropagation()}>{typeBadge(doc)}</td>
                  <td onClick={() => onNavigate('tenants', doc.tenant_id)} style={{cursor:'pointer', color:'#534AB7', textDecoration:'underline'}}>
                    {getTenantName(doc.tenant_id)}
                  </td>
                  <td style={{fontSize:12, color:'#555', maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}} title={doc.description}>
                    {doc.description || '—'}
                  </td>
                  <td style={{fontSize:12, textAlign:'right', whiteSpace:'nowrap'}}>
                    {doc.amount ? doc.amount.toLocaleString('ru-RU', {minimumFractionDigits:2}) + ' ₽' : '—'}
                  </td>
                  <td>{formatSize(doc.file_size)}</td>
                  <td style={{fontSize:12, color:'#888'}}>{new Date(doc.created_at).toLocaleDateString('ru-RU')}</td>
                  <td>
                    {doc.file_path && (
                      <a href={doc.file_path} target="_blank" rel="noreferrer"
                        style={{background:'#EAF3DE', color:'#3B6D11', border:'none', borderRadius:6, padding:'4px 8px', cursor:'pointer', fontSize:12, marginRight:4, textDecoration:'none'}}>
                        🔗
                      </a>
                    )}
                    {doc.items && (
  <button
    onClick={() => {
      const items = typeof doc.items === 'string' ? JSON.parse(doc.items) : doc.items;
      onNavigate('generation', null, { tenantId: doc.tenant_id, позиции: items });
    }}
    title="Открыть в Генерации"
    style={{background:'#f0f0ff', color:'#534AB7', border:'none', borderRadius:6, padding:'4px 8px', cursor:'pointer', fontSize:12, marginRight:4}}>
    ✨
  </button>
)}
                    <button onClick={() => deleteDoc(doc.id)}
                      style={{background:'#FCEBEB', color:'#A32D2D', border:'none', borderRadius:6, padding:'4px 8px', cursor:'pointer', fontSize:12}}>
                      ✕
                    </button>
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

      <div className="page-info">Показано {((page-1)*PAGE_SIZE)+1}–{Math.min(page*PAGE_SIZE, filtered.length)} из {filtered.length} (всего {documents.length})</div>
    </div>
  );
}
