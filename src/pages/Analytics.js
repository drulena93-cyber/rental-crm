import React, { useState, useEffect } from 'react';

export default function Analytics({ onNavigate }) {
  const [objects, setObjects] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [objectTenants, setObjectTenants] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedType, setExpandedType] = useState(null);
  const [expandedMonth, setExpandedMonth] = useState(null);
  const [showStartTooltip, setShowStartTooltip] = useState(false);
  const [monthSortField, setMonthSortField] = useState({});
  const [monthSortDir, setMonthSortDir] = useState({});

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

  const учитываемые = objects.filter(o => o.status !== 'Не учитывать');
  const сдано = учитываемые.filter(o => o.status === 'Сдано');
  const свободно = учитываемые.filter(o => o.status === 'Не сдано');
  const заполненность = учитываемые.length ? Math.round(сдано.length / учитываемые.length * 100) : 0;
  const активные = tenants.filter(t => t.status === 'Активный');
  const ип = активные.filter(t => t.type === 'ИП');
  const ооо = активные.filter(t => t.type === 'ЮРИД.ЛИЦО');
  const физ = активные.filter(t => t.type === 'ФИЗ.ЛИЦО');

  // ── Текучка ───────────────────────────────────────────────────────────────
  const months = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth() + 1, label: d.toLocaleDateString('ru-RU', { month: 'short', year: 'numeric' }) });
  }

  // Считаем кол-во арендаторов на начало каждого месяца
  function countTenantsAtStart(year, month) {
    const startDate = new Date(year, month - 1, 1);
    return tenants.filter(t => {
      if (!t.contract_start) return false;
      const start = new Date(t.contract_start);
      if (start >= startDate) return false;
      // проверяем что не выехал до начала месяца
      const tenantHistory = history.filter(h => h.tenant_id === t.id && h.date_to);
      if (tenantHistory.length > 0) {
        const lastExit = new Date(Math.max(...tenantHistory.map(h => new Date(h.date_to))));
        if (lastExit < startDate) return false;
      }
      return true;
    }).length;
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
    const наНачало = countTenantsAtStart(year, month);
    const наКонец = наНачало + въехавшие.length - выехавшие.length;
    const процент = наНачало > 0 ? Math.round((выехавшие.length / наНачало) * 100) : 0;
    return { label, year, month, въехало: въехавшие.length, выехало: выехавшие.length, въехавшие, выехавшие, наНачало, наКонец, процент };
  });

  // ── Сортировка в деталях месяца ───────────────────────────────────────────
  function handleMonthSort(monthIdx, field) {
    const cur = monthSortField[monthIdx];
    const dir = monthSortDir[monthIdx];
    if (cur === field) {
      setMonthSortDir(prev => ({ ...prev, [monthIdx]: dir === 'asc' ? 'desc' : 'asc' }));
    } else {
      setMonthSortField(prev => ({ ...prev, [monthIdx]: field }));
      setMonthSortDir(prev => ({ ...prev, [monthIdx]: 'asc' }));
    }
  }

  function monthSortIcon(monthIdx, field) {
    if (monthSortField[monthIdx] !== field) return <span style={{color:'#ccc', marginLeft:3}}>↕</span>;
    return <span style={{marginLeft:3}}>{monthSortDir[monthIdx] === 'asc' ? '↑' : '↓'}</span>;
  }

  function sortList(list, monthIdx, fields) {
    const field = monthSortField[monthIdx];
    const dir = monthSortDir[monthIdx] || 'asc';
    if (!field) return list;
    return [...list].sort((a, b) => {
      const va = fields(a, field) ?? '';
      const vb = fields(b, field) ?? '';
      return dir === 'asc'
        ? String(va).localeCompare(String(vb), 'ru')
        : String(vb).localeCompare(String(va), 'ru');
    });
  }

  const sectionTitle = (text) => (
    <div style={{fontSize:13, fontWeight:600, color:'#888', textTransform:'uppercase', letterSpacing:'0.05em', margin:'24px 0 12px'}}>
      {text}
    </div>
  );

  const thSort = { cursor:'pointer', userSelect:'none', whiteSpace:'nowrap' };

  return (
    <div>
      {/* ── Сводка ── */}
      <div className="stats" style={{marginBottom:8, gridTemplateColumns:'repeat(5, 1fr)'}}>
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

      {/* ── Текучка ── */}
      {sectionTitle('Текучка арендаторов за 12 месяцев')}
      <table>
        <thead>
          <tr>
            <th>Месяц</th>
            <th style={{textAlign:'center', position:'relative'}}>
              На начало
              <span
                style={{marginLeft:4, cursor:'pointer', color:'#534AB7', fontSize:11, border:'1px solid #534AB7', borderRadius:10, padding:'1px 6px'}}
                onClick={e => { e.stopPropagation(); setShowStartTooltip(v => !v); }}>
                ?
              </span>
              {showStartTooltip && (
                <div style={{position:'absolute', top:28, left:0, background:'#fff', border:'1px solid #ddd', borderRadius:8, padding:10, fontSize:11, color:'#555', zIndex:10, width:260, boxShadow:'0 2px 8px rgba(0,0,0,0.1)', fontWeight:400, textAlign:'left'}}>
                  Количество активных арендаторов на начало месяца — те у кого дата начала договора раньше этого месяца и кто ещё не выехал.
                  <br/><br/>
                  <b>На конец</b> = На начало + Въехало − Выехало
                </div>
              )}
            </th>
            <th style={{textAlign:'center', color:'#3B6D11'}}>Въехало</th>
            <th style={{textAlign:'center', color:'#A32D2D'}}>Выехало</th>
            <th style={{textAlign:'center'}}>На конец</th>
            <th style={{textAlign:'center'}}>Изменение</th>
            <th style={{textAlign:'center'}}>% текучки</th>
          </tr>
        </thead>
        <tbody>
          {turnoverData.map((row, i) => {
            const изменение = row.въехало - row.выехало;
            const isExp = expandedMonth === i;
            return (
              <React.Fragment key={i}>
                <tr style={{cursor:'pointer', background: isExp ? '#f0f0ff' : 'inherit'}}
                  onClick={() => setExpandedMonth(isExp ? null : i)}>
                  <td style={{fontWeight:500}}>{isExp ? '▼ ' : '▶ '}{row.label}</td>
                  <td style={{textAlign:'center', color:'#555'}}>{row.наНачало}</td>
                  <td style={{textAlign:'center', color:'#3B6D11', fontWeight: row.въехало > 0 ? 500 : 400}}>
                    {row.въехало > 0 ? `+${row.въехало}` : '—'}
                  </td>
                  <td style={{textAlign:'center', color:'#A32D2D', fontWeight: row.выехало > 0 ? 500 : 400}}>
                    {row.выехало > 0 ? `-${row.выехало}` : '—'}
                  </td>
                  <td style={{textAlign:'center', color:'#555'}}>{row.наКонец}</td>
                  <td style={{textAlign:'center', fontWeight:500,
                    color: изменение > 0 ? '#3B6D11' : изменение < 0 ? '#A32D2D' : '#888'}}>
                    {изменение > 0 ? `+${изменение}` : изменение < 0 ? изменение : '0'}
                  </td>
                  <td style={{textAlign:'center', fontSize:12, color: row.процент > 10 ? '#A32D2D' : '#888'}}>
                    {row.процент > 0 ? `${row.процент}%` : '—'}
                  </td>
                </tr>

                {isExp && (
                  <tr>
                    <td colSpan={7} style={{padding:0}}>
                      <div style={{background:'#f8f8ff', padding:'12px 16px', borderBottom:'1px solid #e5e5e5'}}>

                        {/* Въехали */}
                        {row.въехавшие.length > 0 && (
                          <div style={{marginBottom:16}}>
                            <div style={{fontSize:12, fontWeight:600, color:'#3B6D11', marginBottom:6}}>
                              ✅ Въехали ({row.въехавшие.length})
                            </div>
                            <table style={{width:'100%', fontSize:12}}>
                              <thead>
                                <tr>
                                  <th style={thSort} onClick={() => handleMonthSort(`in_${i}`, 'name')}>
                                    Арендатор{monthSortIcon(`in_${i}`, 'name')}
                                  </th>
                                  <th style={thSort} onClick={() => handleMonthSort(`in_${i}`, 'type')}>
                                    Тип{monthSortIcon(`in_${i}`, 'type')}
                                  </th>
                                  <th style={thSort} onClick={() => handleMonthSort(`in_${i}`, 'obj')}>
                                    Объект{monthSortIcon(`in_${i}`, 'obj')}
                                  </th>
                                  <th style={thSort} onClick={() => handleMonthSort(`in_${i}`, 'contract_start')}>
                                    Дата въезда{monthSortIcon(`in_${i}`, 'contract_start')}
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {sortList(row.въехавшие, `in_${i}`, (t, f) => {
                                  if (f === 'name') return t.name;
                                  if (f === 'type') return t.type;
                                  if (f === 'obj') return objectTenants.filter(ot => ot.tenant_id === t.id).map(ot => objects.find(o => o.id === ot.object_id)?.name).filter(Boolean).join(', ');
                                  if (f === 'contract_start') return t.contract_start;
                                  return '';
                                }).map(t => {
                                  const tenantOts = objectTenants.filter(ot => ot.tenant_id === t.id);
                                  return (
                                    <tr key={t.id} style={{cursor:'pointer'}} onClick={() => onNavigate('tenants', t.id)}>
                                      <td style={{color:'#534AB7'}}>{t.name}</td>
                                      <td>{t.type || '—'}</td>
                                      <td>
                                        {tenantOts.map(ot => {
                                          const obj = objects.find(o => o.id === ot.object_id);
                                          return obj ? (
                                            <span key={obj.id}
                                              style={{color:'#534AB7', cursor:'pointer', textDecoration:'underline', marginRight:6}}
                                              onClick={e => { e.stopPropagation(); onNavigate('objects', obj.id); }}>
                                              {obj.name}
                                            </span>
                                          ) : null;
                                        })}
                                      </td>
                                      <td>{t.contract_start ? new Date(t.contract_start).toLocaleDateString('ru-RU') : '—'}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {/* Выехали */}
                        {row.выехавшие.length > 0 && (
                          <div>
                            <div style={{fontSize:12, fontWeight:600, color:'#A32D2D', marginBottom:6}}>
                              ❌ Выехали ({row.выехавшие.length})
                            </div>
                            <table style={{width:'100%', fontSize:12}}>
                              <thead>
                                <tr>
                                  <th style={thSort} onClick={() => handleMonthSort(`out_${i}`, 'tenant_name')}>
                                    Арендатор{monthSortIcon(`out_${i}`, 'tenant_name')}
                                  </th>
                                  <th style={thSort} onClick={() => handleMonthSort(`out_${i}`, 'obj_name')}>
                                    Объект{monthSortIcon(`out_${i}`, 'obj_name')}
                                  </th>
                                  <th style={thSort} onClick={() => handleMonthSort(`out_${i}`, 'obj_type')}>
                                    Здание{monthSortIcon(`out_${i}`, 'obj_type')}
                                  </th>
                                  <th style={thSort} onClick={() => handleMonthSort(`out_${i}`, 'date_to')}>
                                    Дата выезда{monthSortIcon(`out_${i}`, 'date_to')}
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {sortList(row.выехавшие, `out_${i}`, (h, f) => {
                                  const obj = objects.find(o => o.id === h.object_id);
                                  if (f === 'tenant_name') return h.tenant_name;
                                  if (f === 'obj_name') return obj?.name;
                                  if (f === 'obj_type') return obj?.type;
                                  if (f === 'date_to') return h.date_to;
                                  return '';
                                }).map((h, hi) => {
                                  const obj = objects.find(o => o.id === h.object_id);
                                  return (
                                    <tr key={hi}>
                                      <td>{h.tenant_name || '—'}</td>
                                      <td>
                                        {obj ? (
                                          <span style={{color:'#534AB7', cursor:'pointer', textDecoration:'underline'}}
                                            onClick={() => onNavigate('objects', obj.id)}>
                                            {obj.name}
                                          </span>
                                        ) : '—'}
                                      </td>
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
