import React, { useState, useEffect } from 'react';

export default function Analytics({ onNavigate }) {
  const [objects, setObjects] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [objectTenants, setObjectTenants] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedBuilding, setExpandedBuilding] = useState(null);
  const [expandedType, setExpandedType] = useState(null);
  const [expandedMonth, setExpandedMonth] = useState(null);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    try {
      const [objRes, tenRes, otRes, histRes] = await Promise.all([
        fetch('/api/db', { method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ query: `SELECT * FROM objects WHERE deleted_at IS NULL`, params:[] }) }),
        fetch('/api/db', { method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ query: `SELECT * FROM tenants WHERE deleted_at IS NULL`, params:[] }) }),
        fetch('/api/db', { method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ query: `SELECT ot.*, o.type as object_type FROM object_tenants ot JOIN objects o ON o.id = ot.object_id WHERE o.deleted_at IS NULL`, params:[] }) }),
        fetch('/api/db', { method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ query: `SELECT * FROM object_history ORDER BY date_to DESC`, params:[] }) }),
      ]);
      const [objData, tenData, otData, histData] = await Promise.all([
        objRes.json(), tenRes.json(), otRes.json(), histRes.json()
      ]);
      setObjects(objData.rows || []);
      setTenants(tenData.rows || []);
      setObjectTenants(otData.rows || []);
      setHistory(histData.rows || []);
    } catch(e) { console.error(e); }
    setLoading(false);
  }

  if (loading) return <p>Загрузка...</p>;

  // ── Общая сводка ──────────────────────────────────────────────────────────
  const учитываемые = objects.filter(o => o.status !== 'Не учитывать');
  const сдано = учитываемые.filter(o => o.status === 'Сдано');
  const свободно = учитываемые.filter(o => o.status === 'Не сдано');
  const заполненность = учитываемые.length ? Math.round(сдано.length / учитываемые.length * 100) : 0;
  const общаяАренда = сдано.reduce((s, o) => s + (parseFloat(o.rent) || 0) + (parseFloat(o.utility_cost) || 0), 0);

  const активные = tenants.filter(t => t.status === 'Активный');
  const ип = активные.filter(t => t.type === 'ИП');
  const ооо = активные.filter(t => t.type === 'ЮРИД.ЛИЦО');
  const физ = активные.filter(t => t.type === 'ФИЗ.ЛИЦО');

  // ── По зданиям ────────────────────────────────────────────────────────────
  const buildingMap = {};
  for (const obj of objects) {
    if (!obj.type) continue;
    if (!buildingMap[obj.type]) buildingMap[obj.type] = [];
    buildingMap[obj.type].push(obj);
  }
  const buildingNames = Object.keys(buildingMap).sort();

  function getBuildingStats(objs) {
    const у = objs.filter(o => o.status !== 'Не учитывать');
    const с = у.filter(o => o.status === 'Сдано');
    const св = у.filter(o => o.status === 'Не сдано');
    const аренда = с.reduce((s, o) => s + (parseFloat(o.rent)||0) + (parseFloat(o.utility_cost)||0), 0);
    // типы арендаторов в этом здании
    const tenantIds = objectTenants.filter(ot => objs.find(o => o.id === ot.object_id)).map(ot => ot.tenant_id);
    const buildingTenants = tenants.filter(t => tenantIds.includes(t.id) && t.status === 'Активный');
    return {
      всего: у.length, сдано: с.length, свободно: св.length, аренда,
      ип: buildingTenants.filter(t => t.type === 'ИП').length,
      ооо: buildingTenants.filter(t => t.type === 'ЮРИД.ЛИЦО').length,
      физ: buildingTenants.filter(t => t.type === 'ФИЗ.ЛИЦО').length,
    };
  }

  // ── Текучка по месяцам ────────────────────────────────────────────────────
  const months = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth() + 1, label: d.toLocaleDateString('ru-RU', { month: 'short', year: 'numeric' }) });
  }

  const turnoverData = months.map(({ year, month, label }) => {
  const въехавшие = tenants.filter(t => {
    if (!t.contract_start) return false;
    const d = new Date(t.contract_start);
    return d.getFullYear() === year && d.getMonth() + 1 === month;
  });
  const выехавшие = history.filter(h => {
    if (!h.date_to) return false;
    const d = new Date(h.date_to);
    return d.getFullYear() === year && d.getMonth() + 1 === month;
  });
  const процент = активные.length > 0 ? Math.round((выехавшие.length / активные.length) * 100) : 0;
  return { label, year, month, въехало: въехавшие.length, выехало: выехавшие.length, въехавшие, выехавшие, процент };
});

  const sectionTitle = (text) => (
    <div style={{fontSize:13, fontWeight:600, color:'#888', textTransform:'uppercase', letterSpacing:'0.05em', margin:'24px 0 12px'}}>
      {text}
    </div>
  );

  return (
    <div>
      {/* ── Сводка ── */}
      <div className="stats" style={{marginBottom:8}}>
  <div className="stat"><div className="stat-label">Всего объектов</div><div className="stat-val purple">{учитываемые.length}</div></div>
  <div className="stat"><div className="stat-label">Сдано</div><div className="stat-val green">{сдано.length}</div></div>
  <div className="stat"><div className="stat-label">Свободно</div><div className="stat-val red">{свободно.length}</div></div>
  <div className="stat"><div className="stat-label">Заполненность</div><div className="stat-val blue">{заполненность}%</div></div>
  <div className="stat"><div className="stat-label">Активных арендаторов</div><div className="stat-val">{активные.length}</div></div>
</div>

      {/* ── Типы арендаторов ── */}
      {sectionTitle('Типы арендаторов')}
      <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:8}}>
        {[
          { label: 'ИП', list: ип, color: '#185FA5', bg: '#E6F1FB' },
          { label: 'ООО / Юр. лица', list: ооо, color: '#854F0B', bg: '#FAEEDA' },
          { label: 'Физ. лица', list: физ, color: '#3B6D11', bg: '#EAF3DE' },
        ].map(item => (
          <div key={item.label}
            onClick={() => setExpandedType(expandedType === item.label ? null : item.label)}
            style={{background:'#fff', border:`1px solid ${item.color}`, borderRadius:10, padding:16, cursor:'pointer'}}>
            <div style={{fontSize:13, color:item.color, fontWeight:600, marginBottom:4}}>{item.label}</div>
            <div style={{fontSize:28, fontWeight:700, color:item.color}}>{item.list.length}</div>
            <div style={{fontSize:11, color:'#aaa', marginTop:4}}>
              {активные.length ? Math.round(item.list.length / активные.length * 100) : 0}% от активных
            </div>
            <div style={{fontSize:11, color:item.color, marginTop:6}}>{expandedType === item.label ? '▲ Скрыть' : '▼ Показать список'}</div>
          </div>
        ))}
      </div>

      {/* Детализация по типу */}
      {expandedType && (
        <div style={{background:'#fff', border:'1px solid #e5e5e5', borderRadius:10, padding:16, marginBottom:8}}>
          <div style={{fontWeight:500, fontSize:13, marginBottom:10}}>{expandedType} — список арендаторов</div>
          <table>
            <thead><tr><th>Арендатор</th><th>Статус</th><th>Объект</th><th>Окончание договора</th></tr></thead>
            <tbody>
              {(expandedType === 'ИП' ? ип : expandedType === 'ООО / Юр. лица' ? ооо : физ).map(t => {
                const tenantObjs = objectTenants.filter(ot => ot.tenant_id === t.id).map(ot => objects.find(o => o.id === ot.object_id)?.name).filter(Boolean);
                return (
                  <tr key={t.id} style={{cursor:'pointer'}} onClick={() => onNavigate('tenants', t.id)}>
                    <td style={{color:'#534AB7'}}>{t.name}</td>
                    <td><span className={`badge ${t.status === 'Активный' ? 'badge-green' : 'badge-gray'}`}>{t.status}</span></td>
                    <td style={{fontSize:12}}>{tenantObjs.join(', ') || '—'}</td>
                    <td style={{fontSize:12}}>{t.contract_end ? new Date(t.contract_end).toLocaleDateString('ru-RU') : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── По зданиям ── */}
      {sectionTitle('По зданиям')}
      <table>
        <thead>
          <tr>
            <th>Здание</th>
            <th style={{textAlign:'center'}}>Всего</th>
            <th style={{textAlign:'center'}}>Сдано</th>
            <th style={{textAlign:'center'}}>Свободно</th>
            <th style={{textAlign:'center'}}>ИП</th>
            <th style={{textAlign:'center'}}>ООО</th>
            <th style={{textAlign:'center'}}>Физ.</th>
            <th style={{textAlign:'right'}}>Аренда ₽</th>
            <th style={{minWidth:100}}>Заполн.</th>
          </tr>
        </thead>
        <tbody>
          {buildingNames.map(name => {
            const s = getBuildingStats(buildingMap[name]);
            const pct = s.всего ? Math.round(s.сдано / s.всего * 100) : 0;
            const barColor = pct === 100 ? '#3B6D11' : pct > 50 ? '#534AB7' : '#f0a500';
            const isExp = expandedBuilding === name;
            return (
              <>
                <tr key={name} style={{cursor:'pointer', background: isExp ? '#f0f0ff' : 'inherit'}}
                  onClick={() => setExpandedBuilding(isExp ? null : name)}>
                  <td style={{fontWeight:500, color:'#534AB7'}}>
                    {isExp ? '▼ ' : '▶ '}{name}
                  </td>
                  <td style={{textAlign:'center'}}>{s.всего}</td>
                  <td style={{textAlign:'center', color:'#3B6D11', fontWeight:500}}>{s.сдано}</td>
                  <td style={{textAlign:'center', color: s.свободно > 0 ? '#A32D2D' : '#888'}}>{s.свободно}</td>
                  <td style={{textAlign:'center', fontSize:12}}>{s.ип}</td>
                  <td style={{textAlign:'center', fontSize:12}}>{s.ооо}</td>
                  <td style={{textAlign:'center', fontSize:12}}>{s.физ}</td>
                  <td style={{textAlign:'right', fontSize:12}}>{s.аренда > 0 ? s.аренда.toLocaleString('ru-RU') + ' ₽' : '—'}</td>
                  <td>
                    <div style={{display:'flex', alignItems:'center', gap:6}}>
                      <div style={{flex:1, background:'#f0f0f0', borderRadius:4, height:7, overflow:'hidden'}}>
                        <div style={{background:barColor, width:`${pct}%`, height:'100%', borderRadius:4}} />
                      </div>
                      <span style={{fontSize:11, color:'#888'}}>{pct}%</span>
                    </div>
                  </td>
                </tr>
                {isExp && buildingMap[name].filter(o => o.status !== 'Не учитывать').map(obj => {
                  const ots = objectTenants.filter(ot => ot.object_id === obj.id);
                  const objTenants = tenants.filter(t => ots.find(ot => ot.tenant_id === t.id));
                  return (
                    <tr key={obj.id} style={{background:'#f8f8ff', fontSize:12}}>
                      <td style={{paddingLeft:24, color:'#534AB7', cursor:'pointer'}}
                        onClick={e => { e.stopPropagation(); onNavigate('objects', obj.id); }}>
                        → {obj.name}
                      </td>
                      <td colSpan={2} style={{textAlign:'center'}}>
                        <span className={`badge ${obj.status === 'Сдано' ? 'badge-green' : 'badge-red'}`}>{obj.status}</span>
                      </td>
                      <td style={{textAlign:'center'}}>{obj.area ? obj.area + ' м²' : '—'}</td>
                      <td colSpan={3} style={{fontSize:11, color:'#555'}}>
                        {objTenants.map(t => t.name).join(', ') || '—'}
                      </td>
                      <td style={{textAlign:'right'}}>{obj.rent ? parseFloat(obj.rent).toLocaleString('ru-RU') + ' ₽' : '—'}</td>
                      <td></td>
                    </tr>
                  );
                })}
              </>
            );
          })}
        </tbody>
      </table>

      {/* ── Текучка по месяцам ── */}
      {sectionTitle('Текучка арендаторов за 12 месяцев')}
<table>
  <thead>
    <tr>
      <th>Месяц</th>
      <th style={{textAlign:'center', color:'#3B6D11'}}>Въехало</th>
      <th style={{textAlign:'center', color:'#A32D2D'}}>Выехало</th>
      <th style={{textAlign:'center'}}>Баланс</th>
      <th style={{textAlign:'center'}}>% текучки</th>
    </tr>
  </thead>
  <tbody>
    {turnoverData.map((row, i) => {
      const баланс = row.въехало - row.выехало;
      const isExp = expandedMonth === i;
      return (
        <React.Fragment key={i}>
          <tr style={{cursor:'pointer', background: isExp ? '#f0f0ff' : 'inherit'}}
            onClick={() => setExpandedMonth(isExp ? null : i)}>
            <td style={{fontWeight:500}}>
              {isExp ? '▼ ' : '▶ '}{row.label}
            </td>
            <td style={{textAlign:'center', color:'#3B6D11', fontWeight: row.въехало > 0 ? 500 : 400}}>
              {row.въехало > 0 ? `+${row.въехало}` : '—'}
            </td>
            <td style={{textAlign:'center', color:'#A32D2D', fontWeight: row.выехало > 0 ? 500 : 400}}>
              {row.выехало > 0 ? `-${row.выехало}` : '—'}
            </td>
            <td style={{textAlign:'center', fontWeight:500,
              color: баланс > 0 ? '#3B6D11' : баланс < 0 ? '#A32D2D' : '#888'}}>
              {баланс > 0 ? `+${баланс}` : баланс < 0 ? баланс : '0'}
            </td>
            <td style={{textAlign:'center', fontSize:12, color: row.процент > 10 ? '#A32D2D' : '#888'}}>
              {row.процент > 0 ? `${row.процент}%` : '—'}
            </td>
          </tr>
          {isExp && (
            <tr>
              <td colSpan={5} style={{padding:0}}>
                <div style={{background:'#f8f8ff', padding:'12px 16px', borderBottom:'1px solid #e5e5e5'}}>
                  {row.въехавшие.length > 0 && (
                    <div style={{marginBottom:12}}>
                      <div style={{fontSize:12, fontWeight:600, color:'#3B6D11', marginBottom:6}}>
                        ✅ Въехали ({row.въехавшие.length})
                      </div>
                      <table style={{width:'100%', fontSize:12}}>
                        <thead>
                          <tr>
                            <th style={{textAlign:'left'}}>Арендатор</th>
                            <th style={{textAlign:'left'}}>Тип</th>
                            <th style={{textAlign:'left'}}>Объект</th>
                            <th style={{textAlign:'left'}}>Дата въезда</th>
                          </tr>
                        </thead>
                        <tbody>
                          {row.въехавшие.map(t => {
                            const tenantObjs = objectTenants.filter(ot => ot.tenant_id === t.id).map(ot => objects.find(o => o.id === ot.object_id)?.name).filter(Boolean);
                            return (
                              <tr key={t.id} style={{cursor:'pointer'}} onClick={() => onNavigate('tenants', t.id)}>
                                <td style={{color:'#534AB7'}}>{t.name}</td>
                                <td>{t.type || '—'}</td>
                                <td>{tenantObjs.join(', ') || '—'}</td>
                                <td>{t.contract_start ? new Date(t.contract_start).toLocaleDateString('ru-RU') : '—'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {row.выехавшие.length > 0 && (
                    <div>
                      <div style={{fontSize:12, fontWeight:600, color:'#A32D2D', marginBottom:6}}>
                        ❌ Выехали ({row.выехавшие.length})
                      </div>
                      <table style={{width:'100%', fontSize:12}}>
                        <thead>
                          <tr>
                            <th style={{textAlign:'left'}}>Арендатор</th>
                            <th style={{textAlign:'left'}}>Объект</th>
                            <th style={{textAlign:'left'}}>Здание</th>
                            <th style={{textAlign:'left'}}>Дата выезда</th>
                          </tr>
                        </thead>
                        <tbody>
                          {row.выехавшие.map((h, hi) => {
                            const obj = objects.find(o => o.id === h.object_id);
                            return (
                              <tr key={hi}>
                                <td>{h.tenant_name || '—'}</td>
                                <td>{obj?.name || '—'}</td>
                                <td style={{fontSize:11, color:'#888'}}>{obj?.type || '—'}</td>
                                <td>{h.date_to ? new Date(h.date_to).toLocaleDateString('ru-RU') : '—'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {row.въехавшие.length === 0 && row.выехавшие.length === 0 && (
                    <div style={{color:'#aaa', fontSize:12, textAlign:'center', padding:8}}>Нет движения в этом месяце</div>
                  )}
                </div>
              </td>
            </tr>
          )}
        </React.Fragment>
      );
    })}
  </tbody>
</table>
    </div>
  );
}
