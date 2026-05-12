import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function Objects() {
  const [objects, setObjects] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterFloor, setFilterFloor] = useState('');
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    const { data: objs } = await supabase.from('objects').select('*').order('name');
    const { data: tens } = await supabase.from('tenants').select('*').order('name');
    setObjects(objs || []);
    setTenants(tens || []);
    setLoading(false);
  }

  const filtered = objects.filter(o => {
    if (search && !o.name?.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterStatus && o.status !== filterStatus) return false;
    if (filterFloor && o.floor !== parseInt(filterFloor)) return false;
    return true;
  });

  const rented = objects.filter(o => o.status === 'Сдано');
  const free = objects.filter(o => o.status === 'Не сдано');
  const income = rented.reduce((a, b) => a + (b.rent || 0), 0);

  function openAdd() {
    setForm({ status: 'Не сдано', shared: false });
    setShowForm(true);
  }

  function openEdit(o) {
    setForm({ ...o });
    setShowForm(true);
    setSelected(null);
  }

  async function saveForm() {
    if (!form.name) return alert('Введите название объекта');
    if (form.id) {
      await supabase.from('objects').update(form).eq('id', form.id);
    } else {
      await supabase.from('objects').insert(form);
    }
    setShowForm(false);
    fetchAll();
  }

  async function deleteObj(id) {
    if (!window.confirm('Удалить объект?')) return;
    await supabase.from('objects').delete().eq('id', id);
    setSelected(null);
    fetchAll();
  }

  function statusBadge(s) {
    if (s === 'Сдано') return <span className="badge badge-green">{s}</span>;
    if (s === 'Не сдано') return <span className="badge badge-red">{s}</span>;
    return <span className="badge badge-gray">{s}</span>;
  }

  const getTenant = (id) => tenants.find(t => t.object_id === id);

  return (
    <div>
      <div className="stats">
        <div className="stat"><div className="stat-label">Всего объектов</div><div className="stat-val purple">{objects.length}</div></div>
        <div className="stat"><div className="stat-label">Сдано</div><div className="stat-val green">{rented.length}</div></div>
        <div className="stat"><div className="stat-label">Свободно</div><div className="stat-val red">{free.length}</div></div>
        <div className="stat"><div className="stat-label">Доход/мес</div><div className="stat-val amber">{income.toLocaleString('ru-RU')} ₽</div></div>
      </div>

      <div className="toolbar">
        <input placeholder="Поиск по названию..." value={search} onChange={e => setSearch(e.target.value)} />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">Все статусы</option>
          <option>Сдано</option>
          <option>Не сдано</option>
          <option>Не учитывать</option>
        </select>
        <select value={filterFloor} onChange={e => setFilterFloor(e.target.value)}>
          <option value="">Все этажи</option>
          <option value="1">1 этаж</option>
          <option value="2">2 этаж</option>
          <option value="3">3 этаж</option>
        </select>
        <button className="btn-add" onClick={openAdd}>+ Добавить объект</button>
      </div>

      {loading ? <p>Загрузка...</p> : (
        <table>
          <thead>
            <tr>
              <th>Название</th>
              <th>Тип</th>
              <th>Статус</th>
              <th>Этаж</th>
              <th>Площадь</th>
              <th>Арендатор</th>
              <th>₽/мес</th>
              <th>Оплата</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(o => {
              const t = getTenant(o.id);
              return (
                <tr key={o.id} onClick={() => setSelected(o)}>
                  <td>{o.name}</td>
                  <td>{o.type}</td>
                  <td>{statusBadge(o.status)}</td>
                  <td>{o.floor || '—'}</td>
                  <td>{o.area ? `${o.area} м²` : '—'}</td>
                  <td>{t ? t.name : <span style={{color:'#aaa'}}>—</span>}</td>
                  <td>{o.rent ? o.rent.toLocaleString('ru-RU') + ' ₽' : '—'}</td>
                  <td>{o.payment || '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <div className="page-info">Показано {filtered.length} из {objects.length}</div>

      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">
              {selected.name}
              <button className="modal-close" onClick={() => setSelected(null)}>✕ Закрыть</button>
            </div>
            <div className="detail-row"><div className="detail-key">Статус</div><div className="detail-val">{statusBadge(selected.status)}</div></div>
            <div className="detail-row"><div className="detail-key">Тип</div><div className="detail-val">{selected.type || '—'}</div></div>
            <div className="detail-row"><div className="detail-key">Этаж / офис</div><div className="detail-val">{selected.floor ? `${selected.floor} / ${selected.office || ''}` : '—'}</div></div>
            <div className="detail-row"><div className="detail-key">Площадь</div><div className="detail-val">{selected.area ? `${selected.area} м²` : '—'}</div></div>
            <div className="detail-row"><div className="detail-key">Стоимость/мес</div><div className="detail-val">{selected.rent ? selected.rent.toLocaleString('ru-RU') + ' ₽' : '—'}</div></div>
            <div className="detail-row"><div className="detail-key">Страховой взнос</div><div className="detail-val">{selected.insurance ? selected.insurance.toLocaleString('ru-RU') + ' ₽' : '—'}</div></div>
            <div className="detail-row"><div className="detail-key">Оплата помещения</div><div className="detail-val">{selected.payment || '—'}</div></div>
            <div className="detail-row"><div className="detail-key">Совместное пользование</div><div className="detail-val">{selected.shared ? 'Да' : 'Нет'}</div></div>
            <div className="detail-row"><div className="detail-key">Яндекс Диск</div><div className="detail-val">{selected.yandex_link ? <a href={selected.yandex_link} target="_blank" rel="noreferrer">Открыть папку</a> : '—'}</div></div>
            <div className="detail-row"><div className="detail-key">Описание</div><div className="detail-val">{selected.description || '—'}</div></div>
            <div className="detail-row"><div className="detail-key">Комментарии</div><div className="detail-val">{selected.comments || '—'}</div></div>
            {getTenant(selected.id) && (
              <div className="linked-section">
                <div className="linked-title">Арендатор</div>
                <div className="linked-item">{getTenant(selected.id).name}</div>
              </div>
            )}
            <div className="form-actions">
              <button className="btn-cancel" onClick={() => deleteObj(selected.id)}>Удалить</button>
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
            <div className="form-group"><label>Название *</label><input value={form.name || ''} onChange={e => setForm({...form, name: e.target.value})} /></div>
            <div className="form-grid">
              <div className="form-group"><label>Тип</label><input value={form.type || ''} onChange={e => setForm({...form, type: e.target.value})} /></div>
              <div className="form-group"><label>Статус</label>
                <select value={form.status || ''} onChange={e => setForm({...form, status: e.target.value})}>
                  <option>Сдано</option><option>Не сдано</option><option>Не учитывать</option>
                </select>
              </div>
              <div className="form-group"><label>Этаж</label><input type="number" value={form.floor || ''} onChange={e => setForm({...form, floor: parseInt(e.target.value)})} /></div>
              <div className="form-group"><label>Номер офиса</label><input value={form.office || ''} onChange={e => setForm({...form, office: e.target.value})} /></div>
              <div className="form-group"><label>Площадь (м²)</label><input type="number" value={form.area || ''} onChange={e => setForm({...form, area: parseFloat(e.target.value)})} /></div>
              <div className="form-group"><label>Стоимость/мес (₽)</label><input type="number" value={form.rent || ''} onChange={e => setForm({...form, rent: parseFloat(e.target.value)})} /></div>
              <div className="form-group"><label>Страховой взнос (₽)</label><input type="number" value={form.insurance || ''} onChange={e => setForm({...form, insurance: parseFloat(e.target.value)})} /></div>
              <div className="form-group"><label>Оплата помещения</label>
                <select value={form.payment || ''} onChange={e => setForm({...form, payment: e.target.value})}>
                  <option value="">Не указана</option>
                  <option>с 25 по 05</option><option>с 1 по 10</option><option>с 5 по 15</option>
                </select>
              </div>
            </div>
            <div className="form-group"><label>Арендатор</label>
              <select value={form.tenant_id || ''} onChange={e => setForm({...form, tenant_id: e.target.value})}>
                <option value="">— Не назначен —</option>
                {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Ссылка на Яндекс Диск</label><input value={form.yandex_link || ''} onChange={e => setForm({...form, yandex_link: e.target.value})} placeholder="https://disk.yandex.ru/..." /></div>
            <div className="form-group"><label>Описание</label><textarea rows={2} value={form.description || ''} onChange={e => setForm({...form, description: e.target.value})} /></div>
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
