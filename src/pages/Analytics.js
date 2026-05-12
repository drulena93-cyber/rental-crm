import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function Analytics() {
  const [objects, setObjects] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [filterFloor, setFilterFloor] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    const { data: objs } = await supabase.from('objects').select('*');
    const { data: tens } = await supabase.from('tenants').select('*');
    setObjects(objs || []);
    setTenants(tens || []);
    setLoading(false);
  }

  const today = new Date();

  const filtered = objects.filter(o => {
    if (filterFloor && o.floor !== parseInt(filterFloor)) return false;
    if (filterStatus && o.status !== filterStatus) return false;
    return true;
  });

  const countable = filtered.filter(o => o.status !== 'Не учитывать');
  const rented = filtered.filter(o => o.status === 'Сдано');
  const free = filtered.filter(o => o.status === 'Не сдано');
  const income = rented.reduce((a, b) => a + (b.rent || 0), 0);
  const pct = countable.length ? Math.round(rented.length / countable.length * 100) : 0;

  const expiring = tenants.filter(t => {
    if (!t.contract_end) return false;
    const d = new Date(t.contract_end);
    const diff = (d - today) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 30;
  });

  const daysLeft = (date) => {
    const d = new Date(date);
    return Math.ceil((d - today) / (1000 * 60 * 60 * 24));
  };

  const fyzCount = tenants.filter(t => t.type === 'ФИЗ.ЛИЦО').length;
  const jurCount = tenants.filter(t => t.type === 'ЮРИД.ЛИЦО').length;
  const ipCount = tenants.filter(t => t.type === 'ИП').length;
  const noObj = tenants.filter(t => !t.object_id).length;

  const floors = [1, 2, 3];
  const floorData = floors.map(f => ({
    floor: f,
    income: objects.filter(o => o.floor === f && o.status === 'Сдано').reduce((a, b) => a + (b.rent || 0), 0),
    rented: objects.filter(o => o.floor === f && o.status === 'Сдано').length,
    total: objects.filter(o => o.floor === f && o.status !== 'Не учитывать').length,
  }));

  if (loading) return <p>Загрузка...</p>;

  return (
    <div>
      <div className="toolbar">
        <select value={filterFloor} onChange={e => setFilterFloor(e.target.value)}>
          <option value="">Все этажи</option>
          <option value="1">1 этаж</option>
          <option value="2">2 этаж</option>
          <option value="3">3 этаж</option>
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">Все статусы</option>
          <option>Сдано</option>
          <option>Не сдано</option>
          <option>Не учитывать</option>
        </select>
      </div>

      <div className="stats">
        <div className="stat"><div className="stat-label">Всего объектов</div><div className="stat-val purple">{filtered.length}</div></div>
        <div className="stat"><div className="stat-label">Сдано ({pct}%)</div><div className="stat-val green">{rented.length}</div></div>
        <div className="stat"><div className="stat-label">Свободно</div><div className="stat-val red">{free.length}</div></div>
        <div className="stat"><div className="stat-label">Доход/мес</div><div className="stat-val amber">{income.toLocaleString('ru-RU')} ₽</div></div>
      </div>

      {expiring.length > 0 && (
        <div className="alert">
          ⚠️ Договоры истекают в ближайшие 30 дней:
          <ul style={{marginTop: 8, paddingLeft: 16}}>
            {expiring.map(t => (
              <li key={t.id}>{t.name} — {new Date(t.contract_end).toLocaleDateString('ru-RU')} (осталось {daysLeft(t.contract_end)} дн.)</li>
            ))}
          </ul>
        </div>
      )}

      <div className="charts-row">
        <div className="chart-card">
          <div className="chart-title">Занятость по этажам</div>
          {floorData.map(f => (
            <div key={f.floor} style={{marginBottom: 12}}>
              <div style={{display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:4}}>
                <span>{f.floor} этаж</span>
                <span style={{color:'#888'}}>{f.rented} из {f.total} · {f.income.toLocaleString('ru-RU')} ₽</span>
              </div>
              <div style={{background:'#f0f0f0', borderRadius:4, height:8}}>
                <div style={{
                  width: f.total ? `${Math.round(f.rented/f.total*100)}%` : '0%',
                  background:'#534AB7', borderRadius:4, height:8, transition:'width 0.3s'
                }}/>
              </div>
            </div>
          ))}
        </div>

        <div className="chart-card">
          <div className="chart-title">Арендаторы по типу</div>
          {[
            {label: 'Физ. лица', count: fyzCount, color: '#888780'},
            {label: 'Юрид. лица', count: jurCount, color: '#854F0B'},
            {label: 'ИП', count: ipCount, color: '#185FA5'},
            {label: 'Без объекта', count: noObj, color: '#A32D2D'},
          ].map(item => (
            <div key={item.label} style={{marginBottom: 12}}>
              <div style={{display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:4}}>
                <span>{item.label}</span>
                <span style={{color:'#888'}}>{item.count} чел.</span>
              </div>
              <div style={{background:'#f0f0f0', borderRadius:4, height:8}}>
                <div style={{
                  width: tenants.length ? `${Math.round(item.count/tenants.length*100)}%` : '0%',
                  background: item.color, borderRadius:4, height:8, transition:'width 0.3s'
                }}/>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="chart-card" style={{marginBottom: 14}}>
        <div className="chart-title">Детализация по объектам</div>
        <table>
          <thead>
            <tr>
              <th>Объект</th>
              <th>Этаж</th>
              <th>Статус</th>
              <th>Площадь</th>
              <th>₽/мес</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(o => (
              <tr key={o.id}>
                <td>{o.name}</td>
                <td>{o.floor || '—'}</td>
                <td>
                  {o.status === 'Сдано' && <span className="badge badge-green">{o.status}</span>}
                  {o.status === 'Не сдано' && <span className="badge badge-red">{o.status}</span>}
                  {o.status === 'Не учитывать' && <span className="badge badge-gray">{o.status}</span>}
                </td>
                <td>{o.area ? `${o.area} м²` : '—'}</td>
                <td>{o.rent ? o.rent.toLocaleString('ru-RU') + ' ₽' : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
