import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function Contacts({ tenantId, onNavigate }) {
  const [contacts, setContacts] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [selectedTenant, setSelectedTenant] = useState(tenantId || '');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchAll(); }, []);

  useEffect(() => {
    if (tenantId) setSelectedTenant(tenantId);
  }, [tenantId]);

  async function fetchAll() {
    setLoading(true);
    const { data: cons } = await supabase.from('contacts').select('*').order('full_name');
    const { data: tens } = await supabase.from('tenants').select('id, name').order('name');
    setContacts(cons || []);
    setTenants(tens || []);
    setLoading(false);
  }

  const filtered = contacts.filter(c => {
    if (selectedTenant && c.tenant_id !== selectedTenant) return false;
    if (search && !c.full_name?.toLowerCase().includes(search.toLowerCase()) &&
        !c.phone?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

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
    fetchAll();
  }

  async function deleteContact(id) {
    if (!window.confirm('Удалить контакт?')) return;
    await supabase.from('contacts').delete().eq('id', id);
    fetchAll();
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
        {selectedTenant && (
          <button className="btn-cancel" style={{padding:'6px 12px', fontSize:13}} onClick={() => { onNavigate('tenants', selectedTenant); }}>
            ← К арендатору
          </button>
        )}
        <button className="btn-add" onClick={openAdd}>+ Добавить контакт</button>
      </div>

      {loading ? <p>Загрузка...</p> : (
        <table>
          <thead>
            <tr>
              <th>ФИО контакта</th>
              <th>Телефон</th>
              <th>Должность</th>
              <th>Арендатор</th>
              <th>Описание</th>
              <th style={{width:80}}>Действия</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.id}>
                <td>{c.full_name || '—'}</td>
                <td>{c.phone ? <a href={`tel:${c.phone}`} onClick={e => e.stopPropagation()}>{c.phone}</a> : '—'}</td>
                <td>{c.position || '—'}</td>
                <td onClick={() => onNavigate('tenants', c.tenant_id)} style={{cursor:'pointer', color:'#534AB7', textDecoration:'underline'}}>
                  {getTenantName(c.tenant_id)}
                </td>
                <td>{c.description || '—'}</td>
                <td onClick={e => e.stopPropagation()}>
                  <button onClick={() => openEdit(c)} style={{background:'none', border:'none', cursor:'pointer', color:'#534AB7', marginRight:8}}>✎</button>
                  <button onClick={() => deleteContact(c.id)} style={{background:'none', border:'none', cursor:'pointer', color:'#A32D2D'}}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="page-info">Показано {filtered.length} контактов</div>

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
