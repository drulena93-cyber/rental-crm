import React, { useState, useEffect } from 'react';

export default function Analytics({ onNavigate }) {
  const CACHE_KEY = 'analytics_cache';
  const CACHE_TIME_KEY = 'analytics_cache_time';
  const CACHE_TTL = 60 * 1000;

  const [objects, setObjects] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [objectTenants, setObjectTenants] = useState([]);
  const [history, setHistory] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [expandedType, setExpandedType] = useState(null);
  const [expandedMonth, setExpandedMonth] = useState(null);
  const [showStartTooltip, setShowStartTooltip] = useState(false);
  const [monthSortField, setMonthSortField] = useState({});
  const [monthSortDir, setMonthSortDir] = useState({});

  useEffect(() => { fetchAll(false); }, []);

  async function fetchAll(forceRefresh = false) {
    if (!forceRefresh) {
      const cached = localStorage.getItem(CACHE_KEY);
      const cachedTime = localStorage.getItem(CACHE_TIME_KEY);
      if (cached && cachedTime && Date.now() - parseInt(cachedTime) < CACHE_TTL) {
        try {
          const { objs, tens, ot, hist, cons, docs } = JSON.parse(cached);
          setObjects(objs || []);
          setTenants(tens || []);
          setObjectTenants(ot || []);
          setHistory(hist || []);
          setContacts(cons || []);
          setDocuments(docs || []);
          setLastUpdated(new Date(parseInt(cachedTime)));
          setLoading(false);
          return;
        } catch (e) {}
      }
    }
    forceRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const [objRes, tenRes, otRes, histRes, conRes, docRes] = await Promise.all([
        fetch('/api/db', { method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ query: `SELECT * FROM objects WHERE deleted_at IS NULL`, params:[] }) }),
        fetch('/api/db', { method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ query: `SELECT * FROM tenants WHERE deleted_at IS NULL`, params:[] }) }),
        fetch('/api/db', { method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ query: `SELECT ot.*, o.type as object_type FROM object_tenants ot JOIN objects o ON o.id = ot.object_id WHERE o.deleted_at IS NULL`, params:[] }) }),
        fetch('/api/db', { method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ query: `SELECT * FROM object_history ORDER BY date_to DESC`, params:[] }) }),
        fetch('/api/db', { method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ query: `SELECT id, contact_type FROM contacts WHERE deleted_at IS NULL`, params:[] }) }),
        fetch('/api/db', { method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ query: `SELECT id, type FROM documents`, params:[] }) }),
      ]);
      const [objData, tenData, otData, histData, conData, docData] = await Promise.all([
        objRes.json(), tenRes.json(), otRes.json(), histRes.json(), conRes.json(), docRes.json()
      ]);
      const now = Date.now();
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        objs: objData.rows || [], tens: tenData.rows || [], ot: otData.rows || [], hist: histData.rows || [],
        cons: conData.rows || [], docs: docData.rows || []
      }));
      localStorage.setItem(CACHE_TIME_KEY, String(now));
      setObjects(objData.rows || []);
      setTenants(tenData.rows || []);
      setObjectTenants(otData.rows || []);
      setHistory(histData.rows || []);
      setContacts(conData.rows || []);
      setDocuments(docData.rows || []);
      setLastUpdated(new Date(now));
    } catch(e) { console.error(e); }
    setLoading(false);
    setRefreshing(false);
  }

  if (loading) return <p>Загрузка...</p>;

  const учитываемые = objects.filter(o => o.status !== 'Не учитывать');
  const сдано = учитываемые.filter(o => o.status === 'Сдано');
  const свободно = учитываемые.filter(o => o.status === 'Не сдано');
  const заполненность = учитываемые.length ? Math.round(сдано.length / учитываемые.length * 100) : 0;
  const активные = tenants.filter(t => t.status === 'Активный');
  const безОбъекта = tenants.filter(t => !objectTenants.some(ot => ot.tenant_id === t.id));
  const isRenter = (c) => !c.contact_type || c.contact_type === 'Арендатор';
  const контактыАрендаторы = contacts.filter(c => isRenter(c));
  const контактыПодрядчики = contacts.filter(c => !isRenter(c));
  const документыДоговоры = documents.filter(d => d.type === 'Договор');
  const документыАкты = documents.filter(d => d.type === 'Акт');
  const документыСчета = documents.filter(d => d.type === 'Счёт');
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
      <div style={{display:'flex', justifyContent:'flex-end', marginBottom:4}}>
        <button onClick={() => fetchAll(true)} disabled={refreshing}
          style={{background:'#f4f4f8', border:'1px solid #ddd', borderRadius:6, padding:'7px 12px', fontSize:13, cursor:'pointer', whiteSpace:'nowrap'}}>
          {refreshing ? '⏳ Обновление...' : '🔄 Обновить'}
        </button>
      </div>
      {lastUpdated && (
        <div style={{fontSize:11, color:'#aaa', marginBottom:8}}>
          Данные загружены: {lastUpdated.toLocaleTimeString('ru-RU')}
        </div>
      )}

      <table style={{width:'100%', marginBottom:8}}>
        <thead>
          <tr>
            <th style={{width:160}}>Раздел</th>
            <th>Показатели</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{color:'#888'}}>Здания и объекты</td>
            <td>
              <span style={{marginRight:20}}>Всего <b style={{color:'#534AB7'}}>{учитываемые.length}</b></span>
              <span style={{marginRight:20}}>Сдано <b style={{color:'#3B6D11'}}>{сдано.length}</b></span>
              <span style={{marginRight:20}}>Свободно <b style={{color:'#A32D2D'}}>{свободно.length}</b></span>
              <span>Заполненность <b>{заполненность}%</b></span>
            </td>
          </tr>
          <tr>
            <td style={{color:'#888'}}>Арендаторы</td>
            <td>
              <span style={{marginRight:20}}>Всего <b style={{color:'#534AB7'}}>{tenants.length}</b></span>
              <span style={{marginRight:20}}>Активных <b style={{color:'#3B6D11'}}>{активные.length}</b></span>
              <span>Без объекта <b style={{color:'#A32D2D'}}>{безОбъекта.length}</b></span>
            </td>
          </tr>
          <tr>
            <td style={{color:'#888'}}>Контакты</td>
            <td>
              <span style={{marginRight:20}}>Всего <b style={{color:'#534AB7'}}>{contacts.length}</b></span>
              <span style={{marginRight:20}}>Арендаторов <b style={{color:'#3B6D11'}}>{контактыАрендаторы.length}</b></span>
              <span>Подрядчиков <b style={{color:'#8A5A0B'}}>{контактыПодрядчики.length}</b></span>
            </td>
          </tr>
          <tr>
            <td style={{color:'#888'}}>Документы</td>
            <td>
              <span style={{marginRight:20}}>Всего <b style={{color:'#534AB7'}}>{documents.length}</b></span>
              <span style={{marginRight:20}}>Договоров <b style={{color:'#185FA5'}}>{документыДоговоры.length}</b></span>
              <span style={{marginRight:20}}>Актов <b style={{color:'#3B6D11'}}>{документыАкты.length}</b></span>
              <span>Счетов <b style={{color:'#8A5A0B'}}>{документыСчета.length}</b></span>
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── Типы арендаторов ── */}
      {sectionTitle('Типы арендаторов')}
      <div style={{display:'flex', flexWrap:'wrap', gap:10, marginBottom:8}}>
        {[
          { label: 'ИП', list: ип, color: '#185FA5', bg: '#E6F1FB' },
          { label: 'ООО / Юр. лица', list: ооо, color: '#854F0B', bg: '#FAEEDA' },
          { label: 'Физ. лица', list: физ, color: '#3B6D11', bg: '#EAF3DE' },
        ].map(item => (
          <div key={item.label}
            onClick={() => setExpandedType(expandedType === item.label ? null : item.label)}
            style={{background:'#fff', border:`1px solid ${item.color}`, borderRadius:8, padding:'10px 14px', cursor:'pointer', display:'flex', alignItems:'center', gap:10, minWidth:180}}>
            <div style={{fontSize:22, fontWeight:700, color:item.color}}>{item.list.length}</div>
            <div>
              <div style={{fontSize:12, color:item.color, fontWeight:600}}>{item.label}</div>
              <div style={{fontSize:10, color:'#aaa'}}>
                {активные.length ? Math.round(item.list.length / активные.length * 100) : 0}% от активных · {expandedType === item.label ? 'скрыть' : 'список'}
              </div>
            </div>
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
                            <table style={{width:'100%', fontSize:12, tableLayout:'fixed'}}>
                              <thead>
                                <tr>
                                  <th style={{...thSort, width:'22%'}} onClick={() => handleMonthSort(`in_${i}`, 'name')}>
                                    Арендатор{monthSortIcon(`in_${i}`, 'name')}
                                  </th>
                                  <th style={{...thSort, width:'12%'}} onClick={() => handleMonthSort(`in_${i}`, 'type')}>
                                    Тип{monthSortIcon(`in_${i}`, 'type')}
                                  </th>
                                  <th style={{...thSort, width:'28%'}} onClick={() => handleMonthSort(`in_${i}`, 'obj')}>
                                    Объект{monthSortIcon(`in_${i}`, 'obj')}
                                  </th>
                                  <th style={{...thSort, width:'16%'}} onClick={() => handleMonthSort(`in_${i}`, 'building')}>
                                    Здание{monthSortIcon(`in_${i}`, 'building')}
                                  </th>
                                  <th style={{...thSort, width:'22%'}} onClick={() => handleMonthSort(`in_${i}`, 'contract_start')}>
                                    Дата въезда{monthSortIcon(`in_${i}`, 'contract_start')}
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {sortList(row.въехавшие, `in_${i}`, (t, f) => {
                                  if (f === 'name') return t.name;
                                  if (f === 'type') return t.type;
                                  if (f === 'obj') return objectTenants.filter(ot => ot.tenant_id === t.id).map(ot => objects.find(o => o.id === ot.object_id)?.name).filter(Boolean).join(', ');
                                  if (f === 'building') return objectTenants.filter(ot => ot.tenant_id === t.id).map(ot => objects.find(o => o.id === ot.object_id)?.type).filter(Boolean).join(', ');
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
                                      <td style={{fontSize:11, color:'#888'}}>
                                        {[...new Set(tenantOts.map(ot => objects.find(o => o.id === ot.object_id)?.type).filter(Boolean))].join(', ') || '—'}
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
                            <table style={{width:'100%', fontSize:12, tableLayout:'fixed'}}>
                              <thead>
                                <tr>
                                  <th style={{...thSort, width:'22%'}} onClick={() => handleMonthSort(`out_${i}`, 'tenant_name')}>
                                    Арендатор{monthSortIcon(`out_${i}`, 'tenant_name')}
                                  </th>
                                  <th style={{...thSort, width:'12%'}} onClick={() => handleMonthSort(`out_${i}`, 'tenant_type')}>
                                    Тип{monthSortIcon(`out_${i}`, 'tenant_type')}
                                  </th>
                                  <th style={{...thSort, width:'28%'}} onClick={() => handleMonthSort(`out_${i}`, 'obj_name')}>
                                    Объект{monthSortIcon(`out_${i}`, 'obj_name')}
                                  </th>
                                  <th style={{...thSort, width:'16%'}} onClick={() => handleMonthSort(`out_${i}`, 'obj_type')}>
                                    Здание{monthSortIcon(`out_${i}`, 'obj_type')}
                                  </th>
                                  <th style={{...thSort, width:'22%'}} onClick={() => handleMonthSort(`out_${i}`, 'date_to')}>
                                    Дата выезда{monthSortIcon(`out_${i}`, 'date_to')}
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {sortList(row.выехавшие, `out_${i}`, (h, f) => {
                                  const obj = objects.find(o => o.id === h.object_id);
                                  if (f === 'tenant_name') return h.tenant_name;
                                  if (f === 'tenant_type') return tenants.find(t => t.id === h.tenant_id)?.type;
                                  if (f === 'obj_name') return obj?.name;
                                  if (f === 'obj_type') return obj?.type;
                                  if (f === 'date_to') return h.date_to;
                                  return '';
                                }).map((h, hi) => {
                                  const obj = objects.find(o => o.id === h.object_id);
                                  const tenantType = tenants.find(t => t.id === h.tenant_id)?.type;
                                  return (
                                    <tr key={hi}>
                                      <td>{h.tenant_name || '—'}</td>
                                      <td>{tenantType || '—'}</td>
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
