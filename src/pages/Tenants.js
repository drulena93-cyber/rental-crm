import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import Documents from './Documents';
import { saveAs } from 'file-saver';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';

export default function Tenants({ onNavigate, highlightId }) {
  const [tenants, setTenants] = useState([]);
  const [objects, setObjects] = useState([]);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterShared, setFilterShared] = useState('');
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [editingStatus, setEditingStatus] = useState(null);
const [showDocuments, setShowDocuments] = useState(false);
  const [dadataLoading, setDadataLoading] = useState(false);
const DADATA_TOKEN = '7be74127271a523420eaf85a792d97badec52201';

  useEffect(() => { fetchAll(); }, []);

  useEffect(() => {
    if (highlightId && tenants.length > 0) {
      const t = tenants.find(t => t.id === highlightId);
      if (t) setSelected(t);
    }
  }, [highlightId, tenants]);

async function fetchAll() {
  setLoading(true);
  const { data: tens } = await supabase.from('tenants').select('*').is('deleted_at', null).order('created_at', { ascending: false });
  const { data: objs } = await supabase.from('objects').select('*').is('deleted_at', null).order('name');
  setTenants(tens || []);
  setObjects(objs || []);
  setLoading(false);
}

  const filtered = tenants.filter(t => {
    if (search && !t.name?.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterType && t.type !== filterType) return false;
    if (filterStatus && t.status !== filterStatus) return false;
    if (filterShared && (filterShared === 'да' ? !t.shared : t.shared)) return false;
    return true;
  });

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

    // Если арендатор съехал — создаём запись в истории объекта
    if (status === 'Съехал') {
      const tenant = tenants.find(t => t.id === id);
      if (tenant) {
        // Ищем объект через object_tenants
        const otRes = await fetch('/api/db', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: `SELECT object_id FROM object_tenants WHERE tenant_id = $1 LIMIT 1`,
            params: [id]
          })
        });
        const otData = await otRes.json();
        const objectId = otData.rows?.[0]?.object_id || tenant.object_id;

        if (objectId) {
          await fetch('/api/db', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              query: `INSERT INTO object_history (object_id, tenant_id, tenant_name, date_from, date_to, comment, auto)
                      VALUES ($1, $2, $3, $4, $5, $6, true)`,
              params: [
                objectId,
                id,
                tenant.name,
                tenant.contract_start || null,
                new Date().toISOString().split('T')[0],
                'Автоматически при смене статуса на Съехал'
              ]
            })
          });
        }
      }
    }

    setTenants(tenants.map(t => t.id === id ? { ...t, status } : t));
    setEditingStatus(null);
  }

  function openAdd() {
    setForm({ type: 'ФИЗ.ЛИЦО', status: 'Активный', shared: false });
    setShowForm(true);
  }
async function findByInn(inn) {
  if (!inn || inn.length < 10) return alert('Введите ИНН (10 или 12 цифр)');
  setDadataLoading(true);
  try {
    const res = await fetch('https://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/party', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Token ${DADATA_TOKEN}`
      },
      body: JSON.stringify({ query: inn, count: 1 })
    });
    const data = await res.json();
    if (!data.suggestions || data.suggestions.length === 0) {
      alert('Организация не найдена');
      setDadataLoading(false);
      return;
    }
    const s = data.suggestions[0];
    const d = s.data;
    setForm(f => ({
      ...f,
      name: s.value || f.name,
      inn: d.inn || f.inn,
      ogrn: d.ogrn || f.ogrn,
      kpp: d.kpp || f.kpp,
      passport: d.address?.value || f.passport,
      director: d.management?.name || f.director,
      type: d.type === 'INDIVIDUAL' ? 'ИП' : 'ЮРИД.ЛИЦО',
      basis: d.management?.post || f.basis,
    }));
  } catch(e) {
    alert('Ошибка запроса к DaData');
  }
  setDadataLoading(false);
}
  function openEdit(t) {
    setForm({ ...t });
    setShowForm(true);
    setSelected(null);
  }

  async function saveForm() {
    if (!form.name) return alert('Введите имя арендатора');
    if (form.id) {
      await supabase.from('tenants').update(form).eq('id', form.id);
    } else {
      await supabase.from('tenants').insert(form);
    }
    if (form.object_id) {
      await supabase.from('objects').update({ status: 'Сдано' }).eq('id', form.object_id);
    }
    setShowForm(false);
    fetchAll();
  }

async function deleteTenant(id) {
  if (!window.confirm('Переместить арендатора в корзину?')) return;
  await supabase.from('tenants').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  setSelected(null);
  fetchAll();
}
async function generateContract(tenant) {
  if (!selectedTemplate) return alert('Выберите шаблон договора');
  if (!selectedOrg) return alert('Выберите организацию арендодателя');
  setGenerating(true);
  try {
    const org = organizations.find(o => o.id === selectedOrg);
    const obj = getObject(tenant.object_id);
    const { data: fileData } = await supabase.storage.from('templates').download(selectedTemplate);
    const arrayBuffer = await fileData.arrayBuffer();
    const zip = new PizZip(arrayBuffer);
    const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
    doc.render({
      номер_договора: contractForm.номер_договора || '___',
      дата_договора: contractForm.дата_договора || '___',
      арендодатель_название: org?.full_name || org?.name || '',
      арендодатель_директор: org?.director_rod || org?.director || '',
      арендодатель_основание: org?.basis || '',
      арендодатель_адрес: org?.address_legal || '',
      арендодатель_инн: org?.inn || '',
      арендодатель_огрн: org?.ogrn || '',
      арендодатель_кпп: org?.kpp || '',
      арендодатель_бик: org?.bik || '',
      арендодатель_банк: org?.bank || '',
      арендодатель_рс: org?.bank_account || '',
      арендодатель_кс: org?.corr_account || '',
      арендатор_название: tenant.name || '',
      арендатор_директор: tenant.director || '',
      арендатор_основание: tenant.basis || '',
      арендатор_адрес: tenant.passport || '',
      арендатор_инн: tenant.inn || '',
      арендатор_огрн: tenant.ogrn || '',
      арендатор_кпп: tenant.kpp || '',
      арендатор_бик: '',
      арендатор_банк: tenant.bank || '',
      арендатор_рс: '',
      арендатор_кс: '',
      объект_название: obj?.name || '',
      объект_площадь: obj?.area || '',
      объект_стоимость: obj?.rent || '',
      объект_этаж: obj?.floor || '',
    });
    const blob = doc.getZip().generate({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    saveAs(blob, `Договор_${tenant.name}_${contractForm.номер_договора || 'б-н'}.docx`);
    setShowContractForm(false);
  } catch(e) {
    console.error(e);
    alert('Ошибка генерации договора: ' + e.message);
  }
  setGenerating(false);
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

  const daysLeft = (date) => {
    if (!date) return null;
    return Math.ceil((new Date(date) - today) / (1000 * 60 * 60 * 24));
  };

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
        <select value={filterShared} onChange={e => setFilterShared(e.target.value)}>
          <option value="">Совместное: все</option>
          <option value="да">Да</option>
          <option value="нет">Нет</option>
        </select>
        <button className="btn-add" onClick={openAdd}>+ Добавить арендатора</button>
      </div>

      {loading ? <p>Загрузка...</p> : (
        <table>
          <thead>
            <tr>
              <th>Название / ФИО</th>
              <th>Тип</th>
              <th>Статус</th>
              <th>Вид деятельности</th>
              <th>Объект</th>
              <th>Окончание договора</th>
              <th>Контакты</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(t => {
              const obj = getObject(t.object_id);
              const days = daysLeft(t.contract_end);
              return (
                <tr key={t.id} onClick={() => setSelected(t)}>
                  <td>{t.name}</td>
                  <td>{typeBadge(t.type)}</td>
                  <td onClick={e => e.stopPropagation()}>
                    {editingStatus === t.id ? (
                      <select autoFocus value={t.status} onChange={e => quickUpdateStatus(t.id, e.target.value)} onBlur={() => setEditingStatus(null)}>
                        <option>Активный</option>
<option>Неактивный</option>
<option>В работе</option>
<option>Съехал</option>
<option>Не указан</option>
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
                  <td onClick={e => { e.stopPropagation(); onNavigate('contacts', t.id); }}>
                    <span style={{color:'#534AB7', cursor:'pointer', textDecoration:'underline'}}>Контакты →</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <div className="page-info">Показано {filtered.length} из {tenants.length}</div>

      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">
              {selected.name}
              <button className="modal-close" onClick={() => setSelected(null)}>✕ Закрыть</button>
            </div>
            <div className="detail-row"><div className="detail-key">Тип</div><div className="detail-val">{typeBadge(selected.type)}</div></div>
            <div className="detail-row"><div className="detail-key">Статус</div><div className="detail-val">{selected.status}</div></div>
            <div className="detail-row"><div className="detail-key">Вид деятельности</div><div className="detail-val">{selected.activity || '—'}</div></div>
            <div className="detail-row"><div className="detail-key">Паспорт / Прописка</div><div className="detail-val" style={{fontSize:12}}>{selected.passport || '—'}</div></div>
            <div className="detail-row"><div className="detail-key">ИНН</div><div className="detail-val">{selected.inn || '—'}</div></div>
            <div className="detail-row"><div className="detail-key">ОГРН/П</div><div className="detail-val">{selected.ogrn || '—'}</div></div>
            <div className="detail-row"><div className="detail-key">Банк / Р/С</div><div className="detail-val">{selected.bank || '—'}</div></div>
            <div className="detail-row"><div className="detail-key">Окончание договора</div><div className="detail-val">{selected.contract_end ? new Date(selected.contract_end).toLocaleDateString('ru-RU') : '—'}</div></div>
            <div className="detail-row"><div className="detail-key">Совместное пользование</div><div className="detail-val">{selected.shared ? 'Да' : 'Нет'}</div></div>
            <div className="detail-row"><div className="detail-key">Комментарии</div><div className="detail-val">{selected.comments || '—'}</div></div>
            {getObject(selected.object_id) && (
              <div className="linked-section">
                <div className="linked-title">Арендуемый объект</div>
                <div className="linked-item" style={{cursor:'pointer', color:'#534AB7'}}
                  onClick={() => { setSelected(null); onNavigate('objects', getObject(selected.object_id).id); }}>
                  → {getObject(selected.object_id).name}
                </div>
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
  <button style={{background:'#3B6D11', color:'#fff', border:'none', borderRadius:6, padding:'8px 14px', fontSize:13, cursor:'pointer'}} onClick={() => setShowDocuments(true)}>📄 Документы</button>
  <button className="btn-save" onClick={() => openEdit(selected)}>Редактировать</button>
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
            <div className="form-group"><label>ФИО / Название *</label><input value={form.name || ''} onChange={e => setForm({...form, name: e.target.value})} /></div>
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
            <div className="form-group"><label>Вид деятельности</label><input value={form.activity || ''} onChange={e => setForm({...form, activity: e.target.value})} /></div>
            <div className="form-group"><label>Паспорт / Прописка</label><textarea rows={2} value={form.passport || ''} onChange={e => setForm({...form, passport: e.target.value})} /></div>
            <div className="form-grid">
              <div className="form-group"><label>ИНН</label>
  <div style={{display:'flex', gap:6}}>
    <input value={form.inn || ''} onChange={e => setForm({...form, inn: e.target.value})} placeholder="Введите ИНН..." />
    <button type="button" onClick={() => findByInn(form.inn)}
      style={{background:'#534AB7', color:'#fff', border:'none', borderRadius:6, padding:'0 12px', cursor:'pointer', fontSize:12, whiteSpace:'nowrap'}}>
      {dadataLoading ? '...' : '🔍 Найти'}
    </button>
  </div>
</div>
              <div className="form-group"><label>ОГРН/П</label><input value={form.ogrn || ''} onChange={e => setForm({...form, ogrn: e.target.value})} /></div>
              <div className="form-group"><label>Дата регистрации</label><input type="date" value={form.reg_date || ''} onChange={e => setForm({...form, reg_date: e.target.value})} /></div>
              <div className="form-group"><label>Окончание договора</label><input type="date" value={form.contract_end || ''} onChange={e => setForm({...form, contract_end: e.target.value})} /></div>
            </div>
            <div className="form-group"><label>Банк / Р/С / К/С</label><input value={form.bank || ''} onChange={e => setForm({...form, bank: e.target.value})} /></div>
            <div className="form-group"><label>Объект (помещение)</label>
              <select value={form.object_id || ''} onChange={e => setForm({...form, object_id: e.target.value})}>
                <option value="">— Не назначен —</option>
                {objects.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Комментарии</label><textarea rows={2} value={form.comments || ''} onChange={e => setForm({...form, comments: e.target.value})} /></div>
            <div className="form-group"><label><input type="checkbox" checked={form.shared || false} onChange={e => setForm({...form, shared: e.target.checked})} /> Совместное пользование</label></div>
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
