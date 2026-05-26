import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const PAGE_SIZE = 30;
const CACHE_KEY = 'documents_cache';
const CACHE_TIME_KEY = 'documents_cache_time';
const CACHE_TTL = 60 * 1000;

export default function AllDocuments({ onNavigate }) {
  const [documents, setDocuments] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterTenant, setFilterTenant] = useState('');
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
  }, [search, filterType, filterTenant]);

  async function fetchAll(forceRefresh = false) {
    if (!forceRefresh) {
      const cached = localStorage.getItem(CACHE_KEY);
      const cachedTime = localStorage.getItem(CACHE_TIME_KEY);
      if (cached && cachedTime && Date.now() - parseInt(cachedTime) < CACHE_TTL) {
        try {
          const { docs, tens } = JSON.parse(cached);
          setDocuments(docs || []);
          setTenants(tens || []);
          setLastUpdated(new Date(parseInt(cachedTime)));
          setLoading(false);
          return;
        } catch(e) {}
      }
    }

    forceRefresh ? setRefreshing(true) : setLoading(true);

    const { data: docs } = await supabase.from('documents').select('*').order('created_at', { ascending: false });
    const { data: tens } = await supabase.from('tenants').select('id, name').is('deleted_at', null).order('name');

    const now = Date.now();
    localStorage.setItem(CACHE_KEY, JSON.stringify({ docs, tens }));
    localStorage.setItem(CACHE_TIME_KEY, String(now));

    setDocuments(docs || []);
    setTenants(tens || []);
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
    const colors = { 'Договор': 'badge-blue', 'Акт': 'badge-green', 'Доверенность': 'badge-amber', 'Скан паспорта': 'badge-gray', 'Другое': 'badge-gray' };
    if (editingType === doc.id) {
      return (
        <select autoFocus value={doc.type || ''} onChange={e => updateType(doc.id, e.target.value)}
          onBlur={() => setEditingType(null)} style={{fontSize:12, padding:'2px 4px', borderRadius:4}}>
          <option>Договор</option><option>Акт</option><option>Доверенность</option><option>Скан паспорта</option><option>Другое</option>
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

  return (
    <div>
      <div className="stats">
        <div className="stat"><div className="stat-label">Всего документов</div><div className="stat-val purple">{documents.length}</div></div>
        <div className="stat"><div className="stat-label">Договоров</div><div className="stat-val blue">{documents.filter(d => d.type === 'Договор').length}</div></div>
        <div className="stat"><div className="stat-label">Актов</div><div className="stat-val green">{documents.filter(d => d.type === 'Акт').length}</div></div>
        <div className="stat"><div className="stat-label">Счетов</div><div className="stat-val">{documents.filter(d => d.type === 'Счёт').length}</div></div> <div className="stat"><div className="stat-label">Других</div><div className="stat-val">{documents.filter(d => !['Договор','Акт','Счёт'].includes(d.type)).length}</div></div>
      </div>

      <div className="toolbar">
        <input placeholder="Поиск по названию..." value={search} onChange={e => setSearch(e.target.value)} />
        <select value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">Все типы</option>
          <option>Договор</option><option>Акт</option><option>Доверенность</option><option>Скан паспорта</option><option>Другое</option>
        </select>
        <select value={filterTenant} onChange={e => setFilterTenant(e.target.value)}>
          <option value="">Все арендаторы</option>
          {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
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
    <th style={thStyle} onClick={() => handleSort('name')}>Название документа{sortIcon('name')}</th>
    <th style={thStyle} onClick={() => handleSort('type')}>Тип{sortIcon('type')}</th>
    <th style={thStyle} onClick={() => handleSort('tenant_id')}>Арендатор{sortIcon('tenant_id')}</th>
    <th>Услуги</th>
<th style={{textAlign:'right'}}>Сумма</th>
    <th style={thStyle} onClick={() => handleSort('file_size')}>Размер{sortIcon('file_size')}</th>
    <th style={thStyle} onClick={() => handleSort('created_at')}>Дата создания{sortIcon('created_at')}</th>
    <th style={{width:100}}>Действия</th>
  </tr>
</thead>
            <tbody>
              {paginated.length === 0 && (
                <tr><td colSpan={6} style={{textAlign:'center', color:'#aaa', padding:30}}>Документы не найдены</td></tr>
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
