import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function Objects({ onNavigate, highlightId }) {
  const [objects, setObjects] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterFloor, setFilterFloor] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterShared, setFilterShared] = useState('');
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [editingStatus, setEditingStatus] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [editingValue, setEditingValue] = useState('');
const [note, setNote] = useState('');
const [editingNote, setEditingNote] = useState(false);
const [noteValue, setNoteValue] = useState('');
  useEffect(() => { fetchAll(); }, []);

  useEffect(() => {
    if (highlightId && objects.length > 0) {
      const o = objects.find(o => o.id === highlightId);
      if (o) { setSelected(o); window.scrollTo(0, 0); }
    }
  }, [highlightId, objects]);

  async function fetchAll() {
    setLoading(true);
    const { data: objs } = await supabase.from('objects').select('*').is('deleted_at', null).order('name');
   const { data: tens } = await supabase.from('tenants').select('*').is('deleted_at', null).order('name');
    const { data: noteData } = await supabase.from('settings').select('value').eq('id', 'objects_note').single();
    setObjects(objs || []);
    setTenants(tens || []);
    setNote(noteData?.value || '');
    setLoading(false);
  }

  const types = [...new Set(objects.map(o => o.type).filter(Boolean))];
  const floors = [...new Set(objects.map(o => o.floor).filter(Boolean))].sort((a,b)=>a-b);

  const filtered = objects.filter(o => {
    if (search && !o.name?.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterStatus && o.status !== filterStatus) return false;
    if (filterFloor && o.floor !== parseInt(filterFloor)) return false;
    if (filterType && o.type !== filterType) return false;
    if (filterShared && (filterShared === 'да' ? !o.shared : o.shared)) return false;
    return true;
  });

  const rented = objects.filter(o => o.status === 'Сдано');
  const free = objects.filter(o => o.status === 'Не сдано');

  async function quickUpdate(id, field, value) {
    await supabase.from('objects').update({ [field]: value }).eq('id', id);
    setObjects(objects.map(o => o.id === id ? { ...o, [field]: value } : o));
    setEditingField(null);
  }

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
    if (!window.confirm('Переместить объект в корзину?')) return;
    await supabase.from('objects').update({ deleted_at: new Date().toISOString() }).eq('id', id);
    setSelected(null);
    fetchAll();
  }

  function statusBadge(o) {
    const s = o.status;
    const cls = s === 'Сдано' ? 'badge-green' : s === 'Не сдано' ? 'badge-red' : s === 'Освобождается с 1 числа' ? 'badge-amber' : 'badge-gray';
    return (
      <span className={`badge ${cls}`} style={{cursor:'pointer'}} onClick={e => { e.stopPropagation(); setEditingStatus(o.id); }}>
        {s} ▾
      </span>
    );
  }

  const getTenant = (id) => tenants.find(t => t.object_id === id);

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
          <option>Сдано</option>
          <option>Не сдано</option>
          <option>Освобождается с 1 числа</option>
          <option>Не учитывать</option>
          <option>Не указано</option>
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">Все типы</option>
          {types.map(t => <option key={t}>{t}</option>)}
        </select>
        <select value={filterFloor} onChange={e => setFilterFloor(e.target.value)}>
          <option value="">Все этажи</option>
          {floors.map(f => <option key={f} value={f}>{f} этаж</option>)}
        </select>
        <select value={filterShared} onChange={e => setFilterShared(e.target.value)}>
          <option value="">Совместное: все</option>
          <option value="да">Да</option>
          <option value="нет">Нет</option>
        </select>
        <button className="btn-add" onClick={openAdd}>+ Добавить объект</button>
      </div>

      {loading ? <p>Загрузка...</p> : (
        <div style={{overflowX:'auto'}}>
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
              <th>Коммуналка ₽</th>
              <th>Вид коммуналки</th>
              <th>Совместное</th>
              <th>Комментарии</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(o => {
              const t = getTenant(o.id);
              return (
                <tr key={o.id} onClick={() => setSelected(o)}>
                  <td>{o.name}</td>
                  <td>{o.type}</td>
                  <td onClick={e => e.stopPropagation()}>
                    {editingStatus === o.id ? (
                      <select autoFocus value={o.status||''} onChange={e => { quickUpdate(o.id, 'status', e.target.value); setEditingStatus(null); }} onBlur={() => setEditingStatus(null)}>
                        <option>Сдано</option>
                        <option>Не сдано</option>
                        <option>Освобождается с 1 числа</option>
                        <option>Не учитывать</option>
                        <option>Не указано</option>
                      </select>
                    ) : statusBadge(o)}
                  </td>
                  <td>{o.floor || '—'}</td>
                  <td>{o.area ? `${o.area} м²` : '—'}</td>
                  <td onClick={e => { e.stopPropagation(); if(t) onNavigate('tenants', t.id); }}>
                    {t ? <span style={{color:'#534AB7', cursor:'pointer', textDecoration:'underline'}}>{t.name}</span> : <span style={{color:'#aaa'}}>—</span>}
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    {editingField === o.id+'_rent' ? (
                      <input autoFocus type="number" value={editingValue}
                        onChange={e => setEditingValue(e.target.value)}
                        onBlur={() => quickUpdate(o.id, 'rent', parseFloat(editingValue))}
                        onKeyDown={e => { if(e.key==='Enter') quickUpdate(o.id, 'rent', parseFloat(editingValue)); if(e.key==='Escape') setEditingField(null); }}
                        style={{width:90}} />
                    ) : (
                      <span style={{cursor:'pointer'}} onClick={() => { setEditingField(o.id+'_rent'); setEditingValue(o.rent||''); }}>
                        {o.rent ? o.rent.toLocaleString('ru-RU')+' ₽' : '— ✎'}
                      </span>
                    )}
                  </td>
                  <td>{o.payment || '—'}</td>
                  <td onClick={e => e.stopPropagation()}>
                    {editingField === o.id+'_utility' ? (
                      <input autoFocus type="number" value={editingValue}
                        onChange={e => setEditingValue(e.target.value)}
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
                      <option>Фиксированная</option>
                      <option>По счётчику</option>
                    </select>
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={o.shared||false}
                      onChange={e => quickUpdate(o.id, 'shared', e.target.checked)} />
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    {editingField === o.id+'_comments' ? (
                      <input autoFocus value={editingValue}
                        onChange={e => setEditingValue(e.target.value)}
                        onBlur={() => quickUpdate(o.id, 'comments', editingValue)}
                        onKeyDown={e => { if(e.key==='Enter') quickUpdate(o.id, 'comments', editingValue); if(e.key==='Escape') setEditingField(null); }}
                        style={{width:120}} />
                    ) : (
                      <span style={{cursor:'pointer', maxWidth:120, display:'block', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}
                        title={o.comments}
                        onClick={() => { setEditingField(o.id+'_comments'); setEditingValue(o.comments||''); }}>
                        {o.comments || '— ✎'}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      )}
      <div className="page-info">Показано {filtered.length} из {objects.length}</div>

      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">
              {selected.name}
              <button className="modal-close" onClick={() => setSelected(null)}>✕ Закрыть</button>
            </div>
            <div className="detail-row"><div className="detail-key">Статус</div><div className="detail-val">{selected.status}</div></div>
            <div className="detail-row"><div className="detail-key">Тип</div><div className="detail-val">{selected.type||'—'}</div></div>
            <div className="detail-row"><div className="detail-key">Этаж</div><div className="detail-val">{selected.floor||'—'}</div></div>
            <div className="detail-row"><div className="detail-key">Площадь</div><div className="detail-val">{selected.area ? `${selected.area} м²` : '—'}</div></div>
            <div className="detail-row"><div className="detail-key">Стоимость/мес</div><div className="detail-val">{selected.rent ? selected.rent.toLocaleString('ru-RU')+' ₽' : '—'}</div></div>
            <div className="detail-row"><div className="detail-key">Оплата помещения</div><div className="detail-val">{selected.payment||'—'}</div></div>
            <div className="detail-row"><div className="detail-key">Стоимость коммуналки</div><div className="detail-val">{selected.utility_cost ? selected.utility_cost.toLocaleString('ru-RU')+' ₽' : '—'}</div></div>
            <div className="detail-row"><div className="detail-key">Вид коммуналки</div><div className="detail-val">{selected.utility_type||'—'}</div></div>
            <div className="detail-row"><div className="detail-key">Совместное пользование</div><div className="detail-val">{selected.shared ? 'Да' : 'Нет'}</div></div>
            <div className="detail-row"><div className="detail-key">Яндекс Диск</div><div className="detail-val">{selected.yandex_link ? <a href={selected.yandex_link} target="_blank" rel="noreferrer">Открыть папку</a> : '—'}</div></div>
            <div className="detail-row"><div className="detail-key">Комментарии</div><div className="detail-val">{selected.comments||'—'}</div></div>
            {getTenant(selected.id) && (
              <div className="linked-section">
                <div className="linked-title">Арендатор</div>
                <div className="linked-item" style={{cursor:'pointer', color:'#534AB7'}}
                  onClick={() => { setSelected(null); onNavigate('tenants', getTenant(selected.id).id); }}>
                  → {getTenant(selected.id).name}
                </div>
              </div>
            )}
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
                  <option>Сдано</option>
                  <option>Не сдано</option>
                  <option>Освобождается с 1 числа</option>
                  <option>Не учитывать</option>
                  <option>Не указано</option>
                </select>
              </div>
              <div className="form-group"><label>Этаж</label><input type="number" value={form.floor||''} onChange={e => setForm({...form, floor: parseInt(e.target.value)})} /></div>
              <div className="form-group"><label>Номер офиса</label><input value={form.office||''} onChange={e => setForm({...form, office: e.target.value})} /></div>
              <div className="form-group"><label>Площадь (м²)</label><input type="number" value={form.area||''} onChange={e => setForm({...form, area: parseFloat(e.target.value)})} /></div>
              <div className="form-group"><label>Стоимость/мес (₽)</label><input type="number" value={form.rent||''} onChange={e => setForm({...form, rent: parseFloat(e.target.value)})} /></div>
              <div className="form-group"><label>Страховой взнос (₽)</label><input type="number" value={form.insurance||''} onChange={e => setForm({...form, insurance: parseFloat(e.target.value)})} /></div>
              <div className="form-group"><label>Оплата помещения</label>
                <select value={form.payment||''} onChange={e => setForm({...form, payment: e.target.value})}>
                  <option value="">Не указана</option>
                  <option>с 25 по 05</option><option>с 1 по 10</option><option>с 5 по 15</option>
                </select>
              </div>
              <div className="form-group"><label>Стоимость коммуналки (₽)</label><input type="number" value={form.utility_cost||''} onChange={e => setForm({...form, utility_cost: parseFloat(e.target.value)})} /></div>
              <div className="form-group"><label>Вид коммуналки</label>
                <select value={form.utility_type||''} onChange={e => setForm({...form, utility_type: e.target.value})}>
                  <option value="">Не указано</option>
                  <option>Фиксированная</option>
                  <option>По счётчику</option>
                </select>
              </div>
            </div>
            <div className="form-group"><label>Арендатор</label>
              <select value={form.tenant_id||''} onChange={e => setForm({...form, tenant_id: e.target.value})}>
                <option value="">— Не назначен —</option>
                {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
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
    </div>
  );
}
