import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function Tenants() {
  const [tenants, setTenants] = useState([]);
  const [objects, setObjects] = useState([]);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    const { data: tens } = await supabase.from('tenants').select('*').order('name');
    const { data: objs } = await supabase.from('objects').select('*').order('name');
    setTenants(tens || []);
    setObjects(objs || []);
    setLoading(false);
  }

  const filtered = tenants.filter(t => {
    if (search && !t.name?.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterType && t.type !== filterType) return false;
    if (filterStatus && t.status !== filterStatus) return false;
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

  function openAdd() {
    setForm({ type: 'ФИЗ.ЛИЦО', status: 'Активный', shared: false });
    setShowForm(true);
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
    if (!window.confirm('Удалить арендатора?')) return;
    await supabase.from('tenants').delete().eq('id', id);
    setSelected(null);
    fetchAll();
  }

  function statusBadge(s) {
    if (s === 'Активный') return <span className="badge badge-green">{s}</span>;
    return <span className="badge badge-gray">{s}</span>;
  }

  function typeBadge(t) {
    if (t === 'ЮРИД.ЛИЦО') return <span className="badge badge-amber">{t}</span>;
    if (t === 'ИП') return <span className="badge badge-blue">{t}</span>;
    return <span className="badge badge-gray">{t}</span>;
  }

  const getObject = (id) => objects.find(o => o.id === id);

  const daysLeft = (date) => {
    if (!date) return null;
    const d = new Date(date);
    const diff = Math.ceil((d - today) / (1000 * 60 * 60 * 24));
    return diff;
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
          <option>ФИЗ.ЛИЦО</option>
          <option>ЮРИД.ЛИЦО</option>
          <option>ИП</option>
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">Все статусы</option>
          <option>Активный</option>
          <option>Завершён</option>
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
              <th>Совместное</th>
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
                  <td>{statusBadge(t.status)}</td>
                  <td>{t.activity || '—'}</td>
                  <td>{obj ? obj.name : <span style={{color:'#aaa'}}>—</span>}</td>
                  <td>{t.contract_end ? (
                    <span style={{color: days <= 30 ? '#A32D2D' : 'inherit'}}>
                      {new Date(t.contract_end).toLocaleDateString('ru-RU')}
                      {days <= 30 && ` (${days} дн.)`}
                    </span>
                  ) : '—'}</td>
                  <td>{t.shared ? 'Да' : 'Нет'}</td>
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
            <div className="detail-row"><div className="detail-key">Статус</div><div className="detail-val">{statusBadge(selected.status)}</div></div>
            <div className="detail-row"><div className="detail-key">Вид деятельности</div><div className="detail-val">{selected.activity || '—'}</div></div>
            <div className="detail-row"><div className="detail-key">Паспорт / Прописка</div><div className="detail-val">{selected.passport || '—'}</div></div>
            <div className="detail-row"><div className="detail-key">Директор</div><div className="detail-val">{selected.director || '—'}</div></div>
            <div className="detail-row"><div className="detail-key">ИНН</div><div className="detail-val">{selected.inn || '—'}</div></div>
            <div className="detail-row"><div className="detail-key">ОГРН/П</div><div className="detail-val">{selected.ogrn || '—'}</div></div>
            <div className="detail-row"><div className="detail-key">КПП</div><div className="detail-val">{selected.kpp || '—'}</div></div>
            <div className="detail-row"><div className="detail-key">Дата регистрации</div><div className="detail-val">{selected.reg_date ? new Date(selected.reg_date).toLocaleDateString('ru-RU') : '—'}</div></div>
            <div className="detail-row"><div className="detail-key">Окончание договора</div><div className="detail-val">{selected.contract_end ? new Date(selected.contract_end).toLocaleDateString('ru-RU') : '—'}</div></div>
            <div className="detail-row"><div className="detail-key">Банк / Р/С</div><div className="detail-val">{selected.bank || '—'}</div></div>
            <div className="detail-row"><div className="detail-key">Действует на основании</div><div className="detail-val">{selected.basis || '—'}</div></div>
            <div className="detail-row"><div className="detail-key">Руспрофиль</div><div className="detail-val">{selected.rusprofile ? <a href={selected.rusprofile} target="_blank" rel="noreferrer">Открыть</a> : '—'}</div></div>
            <div className="detail-row"><div className="detail-key">Совместное пользование</div><div className="detail-val">{selected.shared ? 'Да' : 'Нет'}</div></div>
            <div className="detail-row"><div className="detail-key">Комментарии</div><div className="detail-val">{selected.comments || '—'}</div></div>
            {getObject(selected.object_id) && (
              <div className="linked-section">
                <div className="linked-title">Арендуемый объект</div>
                <div className="linked-item">{getObject(selected.object_id).name}</div>
              </div>
            )}
            <div className="form-actions">
              <button className="btn-cancel" onClick={() => deleteTenant(selected.id)}>Удалить</button>
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
                  <option>ФИЗ.ЛИЦО</option><option>ЮРИД.ЛИЦО</option><option>ИП</option>
                </select>
              </div>
              <div className="form-group"><label>Статус</label>
                <select value={form.status || ''} onChange={e => setForm({...form, status: e.target.value})}>
                  <option>Активный</option><option>Завершён</option>
                </select>
              </div>
            </div>
            <div className="form-group"><label>Вид деятельности</label><input value={form.activity || ''} onChange={e => setForm({...form, activity: e.target.value})} /></div>
            <div className="form-group"><label>Паспорт / Прописка</label><textarea rows={2} value={form.passport || ''} onChange={e => setForm({...form, passport: e.target.value})} /></div>
            <div className="form-grid">
              <div className="form-group"><label>Директор</label><input value={form.director || ''} onChange={e => setForm({...form, director: e.target.value})} /></div>
              <div className="form-group"><label>ИНН</label><input value={form.inn || ''} onChange={e => setForm({...form, inn: e.target.value})} /></div>
              <div className="form-group"><label>ОГРН/П</label><input value={form.ogrn || ''} onChange={e => setForm({...form, ogrn: e.target.value})} /></div>
              <div className="form-group"><label>КПП</label><input value={form.kpp || ''} onChange={e => setForm({...form, kpp: e.target.value})} /></div>
              <div className="form-group"><label>Дата регистрации</label><input type="date" value={form.reg_date || ''} onChange={e => setForm({...form, reg_date: e.target.value})} /></div>
              <div className="form-group"><label>Окончание договора</label><input type="date" value={form.contract_end || ''} onChange={e => setForm({...form, contract_end: e.target.value})} /></div>
            </div>
            <div className="form-group"><label>Банк / Р/С / К/С</label><input value={form.bank || ''} onChange={e => setForm({...form, bank: e.target.value})} /></div>
            <div className="form-group"><label>Действует на основании</label><input value={form.basis || ''} onChange={e => setForm({...form, basis: e.target.value})} /></div>
            <div className="form-group"><label>Руспрофиль (ссылка)</label><input value={form.rusprofile || ''} onChange={e => setForm({...form, rusprofile: e.target.value})} /></div>
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
    </div>
  );
}
