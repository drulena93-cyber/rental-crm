import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';

export default function Settings() {
  const [orgs, setOrgs] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [docTypes, setDocTypes] = useState([]);
  const [newDocType, setNewDocType] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    const { data: orgsData } = await supabase.from('organizations').select('*').order('name');
    setOrgs(orgsData || []);
    await fetchTemplates();
    await fetchDocTypes();
    setLoading(false);
  }

  async function fetchTemplates() {
    try {
      const res = await fetch('/api/yandex-templates');
      const data = await res.json();
      setTemplates(data.items || []);
    } catch(e) {
      setTemplates([]);
    }
  }

  async function fetchDocTypes() {
    const res = await fetch('/api/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `SELECT * FROM document_types ORDER BY created_at`, params: [] })
    });
    const data = await res.json();
    setDocTypes(data.rows || []);
  }

  async function addDocType() {
    if (!newDocType.trim()) return alert('Введите название типа');
    await fetch('/api/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `INSERT INTO document_types (name) VALUES ($1) ON CONFLICT DO NOTHING`, params: [newDocType.trim()] })
    });
    setNewDocType('');
    fetchDocTypes();
  }

  async function deleteDocType(id, name) {
    if (['Договор','Акт','Другое'].includes(name)) return alert('Этот тип нельзя удалить');
    if (!window.confirm(`Удалить тип "${name}"?`)) return;
    await fetch('/api/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `DELETE FROM document_types WHERE id = $1`, params: [id] })
    });
    fetchDocTypes();
  }

  function openAdd() {
    setForm({ is_default: false, basis: 'Устава', position: 'директора' });
    setShowForm(true);
  }

  function openEdit(org) {
    setForm({ ...org });
    setShowForm(true);
  }

  async function saveForm() {
    if (!form.name) return alert('Введите название организации');
    if (form.id) {
      await supabase.from('organizations').update(form).eq('id', form.id);
    } else {
      await supabase.from('organizations').insert(form);
    }
    setShowForm(false);
    fetchAll();
  }

  async function deleteOrg(id) {
    if (!window.confirm('Удалить организацию?')) return;
    await supabase.from('organizations').delete().eq('id', id);
    fetchAll();
  }

  async function uploadTemplate(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await fetch('/api/yandex-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, filedata: base64 })
      });
      const data = await res.json();
      if (!data.success) alert('Ошибка загрузки: ' + data.error);
      await fetchTemplates();
    } catch(e) {
      alert('Ошибка: ' + e.message);
    }
    setUploading(false);
    e.target.value = '';
  }

  async function deleteTemplate(path) {
    if (!window.confirm('Удалить шаблон?')) return;
    await fetch('/api/yandex-templates', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path })
    });
    await fetchTemplates();
  }

  function formatSize(bytes) {
    if (!bytes) return '—';
    if (bytes < 1024) return bytes + ' Б';
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' КБ';
    return (bytes / 1024 / 1024).toFixed(1) + ' МБ';
  }

  return (
    <div>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16}}>
        <h2 style={{fontSize:16, fontWeight:500}}>⚙️ Настройки</h2>
        <button className="btn-add" onClick={openAdd}>+ Добавить организацию</button>
      </div>

      <div style={{fontSize:13, fontWeight:500, color:'#888', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:10}}>Организации арендодателя</div>

      {loading ? <p>Загрузка...</p> : (
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(360px, 1fr))', gap:12, marginBottom:24}}>
          {orgs.map(org => (
            <div key={org.id} style={{background:'#fff', border:`1.5px solid ${org.is_default ? '#534AB7' : '#e5e5e5'}`, borderRadius:10, padding:16}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10}}>
                <div>
                  <div style={{fontWeight:500, fontSize:15}}>{org.name}</div>
                  <div style={{fontSize:12, color:'#888', marginTop:2}}>{org.full_name}</div>
                </div>
                {org.is_default && <span className="badge badge-blue">По умолчанию</span>}
              </div>
              <div style={{fontSize:13, display:'grid', gap:4}}>
                <div><span style={{color:'#888'}}>Директор: </span>{org.director || '—'}</div>
                <div><span style={{color:'#888'}}>Основание: </span>{org.basis || '—'}</div>
                <div><span style={{color:'#888'}}>Адрес: </span>{org.address_legal || '—'}</div>
                <div><span style={{color:'#888'}}>ИНН: </span>{org.inn || '—'} {org.kpp ? `/ КПП: ${org.kpp}` : ''}</div>
                <div><span style={{color:'#888'}}>ОГРН: </span>{org.ogrn || '—'}</div>
                <div><span style={{color:'#888'}}>Банк: </span>{org.bank || '—'}</div>
                <div><span style={{color:'#888'}}>Р/С: </span>{org.bank_account || '—'}</div>
                <div><span style={{color:'#888'}}>К/С: </span>{org.corr_account || '—'}</div>
              </div>
              <div style={{display:'flex', gap:8, marginTop:12}}>
                <button className="btn-save" style={{flex:1, padding:'6px 0'}} onClick={() => openEdit(org)}>Редактировать</button>
                <button className="btn-cancel" style={{padding:'6px 12px'}} onClick={() => deleteOrg(org.id)}>Удалить</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Типы документов */}
      <div style={{fontSize:13, fontWeight:500, color:'#888', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:10}}>Типы документов</div>
      <div style={{background:'#fff', border:'1px solid #e5e5e5', borderRadius:10, padding:16, marginBottom:24}}>
        <div style={{display:'flex', gap:8, marginBottom:16}}>
          <input value={newDocType} onChange={e => setNewDocType(e.target.value)}
            placeholder="Новый тип документа..."
            style={{flex:1, padding:'7px 10px', borderRadius:6, border:'1px solid #ddd', fontSize:13}}
            onKeyDown={e => { if(e.key === 'Enter') addDocType(); }}
          />
          <button className="btn-add" onClick={addDocType}>+ Добавить</button>
        </div>
        <div style={{display:'flex', flexWrap:'wrap', gap:8}}>
          {docTypes.map(dt => (
            <div key={dt.id} style={{display:'flex', alignItems:'center', gap:6, background:'#f4f4f8', borderRadius:6, padding:'4px 10px', fontSize:13}}>
              <span>{dt.name}</span>
              {!['Договор','Акт','Другое'].includes(dt.name) && (
                <button onClick={() => deleteDocType(dt.id, dt.name)}
                  style={{background:'none', border:'none', color:'#A32D2D', cursor:'pointer', fontSize:12, padding:0}}>✕</button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Шаблоны документов */}
      <div style={{fontSize:13, fontWeight:500, color:'#888', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:10}}>Шаблоны документов</div>
      <div style={{background:'#fff', border:'1px solid #e5e5e5', borderRadius:10, padding:16, marginBottom:16}}>
        <div style={{display:'flex', alignItems:'center', gap:12, marginBottom:16}}>
          <button className="btn-add" onClick={() => fileRef.current.click()} disabled={uploading}>
            {uploading ? 'Загружается на Яндекс Диск...' : '📎 Загрузить шаблон'}
          </button>
          <span style={{fontSize:12, color:'#888'}}>Поддерживаются файлы .docx, .doc, .pdf</span>
          <input ref={fileRef} type="file" accept=".docx,.doc,.pdf" style={{display:'none'}} onChange={uploadTemplate} />
        </div>
        {templates.length === 0 ? (
          <div style={{color:'#aaa', fontSize:13, textAlign:'center', padding:20}}>Шаблоны не загружены</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Название файла</th>
                <th>Размер</th>
                <th>Дата загрузки</th>
                <th style={{width:180}}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {templates.map(t => (
                <tr key={t.name}>
                  <td>📄 {t.name}</td>
                  <td>{formatSize(t.size)}</td>
                  <td style={{fontSize:12, color:'#888'}}>{t.created ? new Date(t.created).toLocaleDateString('ru-RU') : '—'}</td>
                  <td>
                    {t.public_url && (
                      <a href={t.public_url} target="_blank" rel="noreferrer"
                        style={{background:'#EAF3DE', color:'#3B6D11', border:'none', borderRadius:6, padding:'4px 10px', cursor:'pointer', fontSize:12, marginRight:6, textDecoration:'none'}}>
                        🔗 Открыть
                      </a>
                    )}
                    <button onClick={() => deleteTemplate(t.path)}
                      style={{background:'#FCEBEB', color:'#A32D2D', border:'none', borderRadius:6, padding:'4px 10px', cursor:'pointer', fontSize:12}}>
                      ✕ Удалить
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">
              {form.id ? 'Редактировать организацию' : 'Новая организация'}
              <button className="modal-close" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <div className="form-group"><label>Название краткое *</label><input value={form.name||''} onChange={e => setForm({...form, name: e.target.value})} placeholder='ООО "Эрия"' /></div>
            <div className="form-group"><label>Название полное</label><input value={form.full_name||''} onChange={e => setForm({...form, full_name: e.target.value})} /></div>
            <div className="form-grid">
              <div className="form-group"><label>ФИО директора (именительный)</label><input value={form.director||''} onChange={e => setForm({...form, director: e.target.value})} /></div>
              <div className="form-group"><label>ФИО директора (родительный)</label><input value={form.director_rod||''} onChange={e => setForm({...form, director_rod: e.target.value})} placeholder="Крякова Михаила Сергеевича" /></div>
              <div className="form-group"><label>Должность</label><input value={form.position||''} onChange={e => setForm({...form, position: e.target.value})} placeholder="директора" /></div>
              <div className="form-group"><label>Основание</label><input value={form.basis||''} onChange={e => setForm({...form, basis: e.target.value})} placeholder="Устава" /></div>
            </div>
            <div className="form-group"><label>Юридический адрес</label><input value={form.address_legal||''} onChange={e => setForm({...form, address_legal: e.target.value})} /></div>
            <div className="form-grid">
              <div className="form-group"><label>ИНН</label><input value={form.inn||''} onChange={e => setForm({...form, inn: e.target.value})} /></div>
              <div className="form-group"><label>ОГРН / ОГРНИП</label><input value={form.ogrn||''} onChange={e => setForm({...form, ogrn: e.target.value})} /></div>
              <div className="form-group"><label>КПП</label><input value={form.kpp||''} onChange={e => setForm({...form, kpp: e.target.value})} /></div>
            </div>
            <div className="form-group"><label>Банк</label><input value={form.bank||''} onChange={e => setForm({...form, bank: e.target.value})} /></div>
            <div className="form-grid">
              <div className="form-group"><label>БИК</label><input value={form.bik||''} onChange={e => setForm({...form, bik: e.target.value})} /></div>
              <div className="form-group"><label>Корр. счёт</label><input value={form.corr_account||''} onChange={e => setForm({...form, corr_account: e.target.value})} /></div>
              <div className="form-group"><label>Расч. счёт</label><input value={form.bank_account||''} onChange={e => setForm({...form, bank_account: e.target.value})} /></div>
            </div>
            <div className="form-group"><label><input type="checkbox" checked={form.is_default||false} onChange={e => setForm({...form, is_default: e.target.checked})} /> Использовать по умолчанию</label></div>
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
