import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function AllDocuments({ onNavigate }) {
  const [documents, setDocuments] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterTenant, setFilterTenant] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingType, setEditingType] = useState(null);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    const { data: docs } = await supabase.from('documents').select('*').order('created_at', { ascending: false });
    const { data: tens } = await supabase.from('tenants').select('id, name').is('deleted_at', null).order('name');
    setDocuments(docs || []);
    setTenants(tens || []);
    setLoading(false);
  }

  async function updateType(id, type) {
    await supabase.from('documents').update({ type }).eq('id', id);
    setDocuments(documents.map(d => d.id === id ? { ...d, type } : d));
    setEditingType(null);
  }

  async function deleteDoc(id) {
    if (!window.confirm('Удалить документ?')) return;
    await supabase.from('documents').delete().eq('id', id);
    setDocuments(documents.filter(d => d.id !== id));
  }

  const filtered = documents.filter(d => {
    if (search && !d.name?.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterType && d.type !== filterType) return false;
    if (filterTenant && d.tenant_id !== filterTenant) return false;
    return true;
  });

  const getTenantName = (id) => tenants.find(t => t.id === id)?.name || '—';

  function formatSize(bytes) {
    if (!bytes) return '—';
    if (bytes < 1024) return bytes + ' Б';
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' КБ';
    return (bytes / 1024 / 1024).toFixed(1) + ' МБ';
  }

  function typeBadge(doc) {
    const colors = {
      'Договор': 'badge-blue',
      'Акт': 'badge-green',
      'Доверенность': 'badge-amber',
      'Скан паспорта': 'badge-gray',
      'Другое': 'badge-gray'
    };
    if (editingType === doc.id) {
      return (
        <select
          autoFocus
          value={doc.type || ''}
          onChange={e => updateType(doc.id, e.target.value)}
          onBlur={() => setEditingType(null)}
          style={{fontSize:12, padding:'2px 4px', borderRadius:4}}
        >
          <option>Договор</option>
          <option>Акт</option>
          <option>Доверенность</option>
          <option>Скан паспорта</option>
          <option>Другое</option>
        </select>
      );
    }
    return (
      <span
        className={`badge ${colors[doc.type] || 'badge-gray'}`}
        style={{cursor:'pointer'}}
        onClick={() => setEditingType(doc.id)}
        title="Нажмите чтобы изменить тип"
      >
        {doc.type || 'Другое'} ▾
      </span>
    );
  }

  return (
    <div>
      <div className="stats">
        <div className="stat"><div className="stat-label">Всего документов</div><div className="stat-val purple">{documents.length}</div></div>
        <div className="stat"><div className="stat-label">Договоров</div><div className="stat-val blue">{documents.filter(d => d.type === 'Договор').length}</div></div>
        <div className="stat"><div className="stat-label">Актов</div><div className="stat-val green">{documents.filter(d => d.type === 'Акт').length}</div></div>
        <div className="stat"><div className="stat-label">Других</div><div className="stat-val">{documents.filter(d => !['Договор','Акт'].includes(d.type)).length}</div></div>
      </div>

      <div className="toolbar">
        <input
          placeholder="Поиск по названию..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">Все типы</option>
          <option>Договор</option>
          <option>Акт</option>
          <option>Доверенность</option>
          <option>Скан паспорта</option>
          <option>Другое</option>
        </select>
        <select value={filterTenant} onChange={e => setFilterTenant(e.target.value)}>
          <option value="">Все арендаторы</option>
          {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      {loading ? <p>Загрузка...</p> : (
        <table>
          <thead>
            <tr>
              <th>Название документа</th>
              <th>Тип</th>
              <th>Арендатор</th>
              <th>Размер</th>
              <th>Дата создания</th>
              <th style={{width:80}}>Действия</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} style={{textAlign:'center', color:'#aaa', padding:30}}>
                  Документы не найдены
                </td>
              </tr>
            )}
            {filtered.map(doc => (
              <tr key={doc.id}>
                <td>📄 {doc.name}</td>
                <td onClick={e => e.stopPropagation()}>{typeBadge(doc)}</td>
                <td
                  onClick={() => onNavigate('tenants', doc.tenant_id)}
                  style={{cursor:'pointer', color:'#534AB7', textDecoration:'underline'}}
                >
                  {getTenantName(doc.tenant_id)}
                </td>
                <td>{formatSize(doc.file_size)}</td>
                <td style={{fontSize:12, color:'#888'}}>
                  {new Date(doc.created_at).toLocaleDateString('ru-RU')}
                </td>
                <td>
                  <button
                    onClick={() => deleteDoc(doc.id)}
                    style={{background:'#FCEBEB', color:'#A32D2D', border:'none', borderRadius:6, padding:'4px 10px', cursor:'pointer', fontSize:12}}
                  >
                    ✕ Удалить
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="page-info">Показано {filtered.length} из {documents.length} документов</div>
    </div>
  );
}
