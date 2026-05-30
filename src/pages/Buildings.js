import React, { useState, useEffect } from 'react';

const STATUS_COLORS = {
  'Сдано':        { bg: '#EAF3DE', color: '#3B6D11' },
  'Не сдано':     { bg: '#FCEBEB', color: '#A32D2D' },
  'Не учитывать': { bg: '#f0f0f0', color: '#999' },
  'default':      { bg: '#f4f4f8', color: '#555' },
};

function getStatusStyle(status) {
  return STATUS_COLORS[status] || STATUS_COLORS['default'];
}

export default function Buildings({ onNavigate }) {
  const [objects, setObjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterAreaMin, setFilterAreaMin] = useState('');
  const [filterAreaMax, setFilterAreaMax] = useState('');
  const [filterRentMin, setFilterRentMin] = useState('');
  const [filterRentMax, setFilterRentMax] = useState('');

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    const res = await fetch('/api/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `SELECT o.*, t.name as tenant_name 
                FROM objects o 
                LEFT JOIN object_tenants ot ON ot.object_id = o.id 
                LEFT JOIN tenants t ON t.id = ot.tenant_id 
                WHERE o.deleted_at IS NULL AND o.type IS NOT NULL
                ORDER BY o.type, o.floor NULLS LAST, o.name`,
        params: []
      })
    });
    const data = await res.json();
    setObjects(data.rows || []);
    setLoading(false);
  }

  const buildings = {};
  for (const obj of objects) {
    if (!buildings[obj.type]) buildings[obj.type] = [];
    buildings[obj.type].push(obj);
  }

  function getBuildingStats(objs) {
    const учитываемые = objs.filter(o => o.status !== 'Не учитывать');
    const сдано = учитываемые.filter(o => o.status === 'Сдано');
    const неСдано = учитываемые.filter(o => o.status === 'Не сдано');
    const площадьВсего = учитываемые.reduce((s, o) => s + (parseFloat(o.area) || 0), 0);
    const площадьСдано = сдано.reduce((s, o) => s + (parseFloat(o.area) || 0), 0);
    const аренда = сдано.reduce((s, o) => s + (parseFloat(o.rent) || 0), 0);
    const коммуналка = сдано.reduce((s, o) => s + (parseFloat(o.utility_cost) || 0), 0);
    const этажи = [...new Set(учитываемые.map(o => o.floor).filter(Boolean))];
    return {
      всего: учитываемые.length,
      сдано: сдано.length,
      неСдано: неСдано.length,
      площадьВсего,
      площадьСдано,
      аренда,
      коммуналка,
      этажей: этажи.length,
    };
  }

  function getFloors(objs) {
    const floors = {};
    for (const obj of objs) {
      const floor = obj.floor !== null ? obj.floor : 'other';
      if (!floors[floor]) floors[floor] = [];
      floors[floor].push(obj);
    }
    return floors;
  }

  // Короткое название для ячейки шахматки
  function getShortLabel(obj) {
    if (obj.office) return obj.office;
    // Берём последнюю часть названия после последнего пробела
    const parts = obj.name.trim().split(' ');
    return parts[parts.length - 1];
  }

  if (loading) return <p>Загрузка...</p>;

  const buildingNames = Object.keys(buildings).sort();

  const filteredBuildings = buildingNames.filter(name => {
    const s = getBuildingStats(buildings[name]);
    if (filterStatus === 'Сдано' && s.сдано === 0) return false;
    if (filterStatus === 'Не сдано' && s.неСдано === 0) return false;
    if (filterAreaMin && s.площадьВсего < parseFloat(filterAreaMin)) return false;
    if (filterAreaMax && s.площадьВсего > parseFloat(filterAreaMax)) return false;
    if (filterRentMin && s.аренда < parseFloat(filterRentMin)) return false;
    if (filterRentMax && s.аренда > parseFloat(filterRentMax)) return false;
    return true;
  });

  const allStats = buildingNames.reduce((acc, name) => {
    const s = getBuildingStats(buildings[name]);
    acc.всего += s.всего;
    acc.сдано += s.сдано;
    acc.неСдано += s.неСдано;
    acc.площадьВсего += s.площадьВсего;
    acc.площадьСдано += s.площадьСдано;
    acc.аренда += s.аренда;
    acc.коммуналка += s.коммуналка;
    return acc;
  }, { всего: 0, сдано: 0, неСдано: 0, площадьВсего: 0, площадьСдано: 0, аренда: 0, коммуналка: 0 });

  const selStats = selectedBuilding ? getBuildingStats(buildings[selectedBuilding]) : null;

  return (
    <div>
      {/* Метрики */}
      <div className="stats" style={{marginBottom:20}}>
        <div className="stat"><div className="stat-label">Всего помещений</div><div className="stat-val purple">{allStats.всего}</div></div>
        <div className="stat"><div className="stat-label">Сдано</div><div className="stat-val green">{allStats.сдано}</div></div>
        <div className="stat"><div className="stat-label">Свободно</div><div className="stat-val red">{allStats.неСдано}</div></div>
        <div className="stat"><div className="stat-label">Площадь сдано / всего</div><div className="stat-val" style={{fontSize:13}}>{Math.round(allStats.площадьСдано).toLocaleString('ru-RU')} / {Math.round(allStats.площадьВсего).toLocaleString('ru-RU')} м²</div></div>
        <div className="stat"><div className="stat-label">Аренда / Коммуналка</div><div className="stat-val" style={{fontSize:13}}>{allStats.аренда.toLocaleString('ru-RU')} / {allStats.коммуналка.toLocaleString('ru-RU')} ₽</div></div>
      </div>

      {/* Фильтры */}
      <div style={{display:'flex', gap:8, marginBottom:16, flexWrap:'wrap', alignItems:'center'}}>
        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setSelectedBuilding(null); }}
          style={{padding:'6px 10px', borderRadius:6, border:'1px solid #ddd', fontSize:13}}>
          <option value="">Все статусы</option>
          <option value="Сдано">Есть сданные</option>
          <option value="Не сдано">Есть свободные</option>
        </select>
        <div style={{display:'flex', alignItems:'center', gap:4, fontSize:13}}>
          <span style={{color:'#888'}}>Площадь:</span>
          <input type="number" placeholder="от" value={filterAreaMin} onChange={e => setFilterAreaMin(e.target.value)}
            style={{width:70, padding:'6px 8px', borderRadius:6, border:'1px solid #ddd', fontSize:13}} />
          <span style={{color:'#888'}}>—</span>
          <input type="number" placeholder="до" value={filterAreaMax} onChange={e => setFilterAreaMax(e.target.value)}
            style={{width:70, padding:'6px 8px', borderRadius:6, border:'1px solid #ddd', fontSize:13}} />
          <span style={{color:'#888'}}>м²</span>
        </div>
        <div style={{display:'flex', alignItems:'center', gap:4, fontSize:13}}>
          <span style={{color:'#888'}}>Аренда:</span>
          <input type="number" placeholder="от" value={filterRentMin} onChange={e => setFilterRentMin(e.target.value)}
            style={{width:90, padding:'6px 8px', borderRadius:6, border:'1px solid #ddd', fontSize:13}} />
          <span style={{color:'#888'}}>—</span>
          <input type="number" placeholder="до" value={filterRentMax} onChange={e => setFilterRentMax(e.target.value)}
            style={{width:90, padding:'6px 8px', borderRadius:6, border:'1px solid #ddd', fontSize:13}} />
          <span style={{color:'#888'}}>₽</span>
        </div>
        {(filterStatus || filterAreaMin || filterAreaMax || filterRentMin || filterRentMax) && (
          <button onClick={() => { setFilterStatus(''); setFilterAreaMin(''); setFilterAreaMax(''); setFilterRentMin(''); setFilterRentMax(''); }}
            style={{background:'#FCEBEB', color:'#A32D2D', border:'none', borderRadius:6, padding:'6px 12px', fontSize:13, cursor:'pointer'}}>
            ✕ Сбросить
          </button>
        )}
      </div>

      {/* Легенда */}
      <div style={{display:'flex', gap:16, marginBottom:16}}>
        {Object.entries(STATUS_COLORS).filter(([k]) => k !== 'default').map(([status, style]) => (
          <div key={status} style={{display:'flex', alignItems:'center', gap:6, fontSize:12}}>
            <div style={{width:12, height:12, borderRadius:3, background:style.bg, border:`1px solid ${style.color}`}} />
            {status}
          </div>
        ))}
      </div>

      {/* Основной layout: карточки слева + детальная панель справа */}
      <div style={{display:'grid', gridTemplateColumns: selectedBuilding ? '320px 1fr' : '1fr', gap:16, alignItems:'start'}}>

        {/* Список карточек зданий */}
        <div style={{display:'flex', flexDirection:'column', gap:10}}>
          {filteredBuildings.map(name => {
            const s = getBuildingStats(buildings[name]);
            const pct = s.всего > 0 ? Math.round((s.сдано / s.всего) * 100) : 0;
            const barColor = pct === 100 ? '#3B6D11' : pct > 50 ? '#534AB7' : '#f0a500';
            const isSelected = selectedBuilding === name;
            return (
              <div key={name}
                onClick={() => setSelectedBuilding(isSelected ? null : name)}
                style={{
                  background: '#fff',
                  border: isSelected ? '2px solid #534AB7' : '1px solid #e5e5e5',
                  borderRadius: 10,
                  padding: '12px 16px',
                  cursor: 'pointer',
                  boxShadow: isSelected ? '0 2px 12px rgba(83,74,183,0.15)' : '0 1px 3px rgba(0,0,0,0.05)',
                  transition: 'all 0.15s',
                }}>
                <div style={{fontWeight:600, fontSize:14, marginBottom:6, color: isSelected ? '#534AB7' : '#1a1a1a'}}>
                  {name}
                </div>
                <div style={{display:'flex', gap:10, fontSize:12, marginBottom:8}}>
                  <span style={{color:'#888'}}>Всего: <b style={{color:'#1a1a1a'}}>{s.всего}</b></span>
                  <span style={{color:'#3B6D11'}}>Сдано: <b>{s.сдано}</b></span>
                  <span style={{color: s.неСдано > 0 ? '#A32D2D' : '#888'}}>Своб: <b>{s.неСдано}</b></span>
                </div>
                <div style={{display:'flex', gap:10, fontSize:11, color:'#888', marginBottom:8}}>
                  <span>📐 {Math.round(s.площадьВсего).toLocaleString('ru-RU')} м²</span>
                  {s.аренда > 0 && <span>💰 {s.аренда.toLocaleString('ru-RU')} ₽</span>}
                  {s.коммуналка > 0 && <span>⚡ {s.коммуналка.toLocaleString('ru-RU')} ₽</span>}
                </div>
                <div style={{display:'flex', alignItems:'center', gap:8}}>
                  <div style={{flex:1, background:'#f0f0f0', borderRadius:4, height:6, overflow:'hidden'}}>
                    <div style={{background:barColor, width:`${pct}%`, height:'100%', borderRadius:4, transition:'width 0.3s'}} />
                  </div>
                  <span style={{fontSize:11, color:'#888', whiteSpace:'nowrap'}}>{pct}%</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Детальная панель справа */}
        {selectedBuilding && selStats && (
          <div style={{background:'#fff', border:'1px solid #e5e5e5', borderRadius:10, padding:20, position:'sticky', top:16}}>

            {/* Заголовок */}
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16}}>
              <div style={{fontWeight:700, fontSize:16, color:'#534AB7'}}>🏢 {selectedBuilding}</div>
              <button onClick={() => setSelectedBuilding(null)}
                style={{background:'none', border:'none', cursor:'pointer', color:'#aaa', fontSize:18}}>✕</button>
            </div>

            {/* Статистика здания */}
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:16}}>
              {[
                { label: 'Всего', val: selStats.всего, color: '#534AB7' },
                { label: 'Сдано', val: selStats.сдано, color: '#3B6D11' },
                { label: 'Свободно', val: selStats.неСдано, color: '#A32D2D' },
                { label: 'Площадь всего', val: Math.round(selStats.площадьВсего).toLocaleString('ru-RU') + ' м²', color: '#555' },
                { label: 'Площадь сдано', val: Math.round(selStats.площадьСдано).toLocaleString('ru-RU') + ' м²', color: '#3B6D11' },
                { label: 'Этажей', val: selStats.этажей || '—', color: '#555' },
                { label: 'Аренда', val: selStats.аренда.toLocaleString('ru-RU') + ' ₽', color: '#534AB7' },
                { label: 'Коммуналка', val: selStats.коммуналка.toLocaleString('ru-RU') + ' ₽', color: '#555' },
                { label: 'Итого', val: (selStats.аренда + selStats.коммуналка).toLocaleString('ru-RU') + ' ₽', color: '#3B6D11' },
              ].map(item => (
                <div key={item.label} style={{background:'#f8f8ff', borderRadius:8, padding:'8px 10px'}}>
                  <div style={{fontSize:10, color:'#aaa', marginBottom:2}}>{item.label}</div>
                  <div style={{fontWeight:600, fontSize:13, color:item.color}}>{item.val}</div>
                </div>
              ))}
            </div>

            {/* Шахматка */}
            <div style={{fontWeight:600, fontSize:13, marginBottom:12, color:'#555'}}>Поэтажная схема</div>
            {(() => {
              const objs = buildings[selectedBuilding];
              const floors = getFloors(objs);
              const floorKeys = Object.keys(floors)
                .filter(f => f !== 'other')
                .map(Number)
                .sort((a, b) => b - a);
              const otherObjs = floors['other'] || [];

              return (
                <>
                  {floorKeys.map(floor => (
                    <div key={floor} style={{marginBottom:12}}>
                      <div style={{fontSize:11, fontWeight:600, color:'#aaa', marginBottom:6, letterSpacing:1}}>
                        ЭТАЖ {floor}
                      </div>
                      <div style={{display:'flex', flexWrap:'wrap', gap:4}}>
                        {floors[floor].map(obj => {
                          const st = getStatusStyle(obj.status);
                          const label = getShortLabel(obj);
                          return (
                            <div key={obj.id}
                              onClick={() => { setSelectedBuilding(null); onNavigate('objects', obj.id); }}
                              title={`${obj.name}\n${obj.tenant_name ? 'Арендатор: ' + obj.tenant_name : 'Свободно'}\n${obj.area ? obj.area + ' м²' : ''}`}
                              style={{
                                background: st.bg,
                                color: st.color,
                                border: `1px solid ${st.color}`,
                                borderRadius: 6,
                                padding: '5px 8px',
                                fontSize: 11,
                                cursor: 'pointer',
                                minWidth: 48,
                                textAlign: 'center',
                                fontWeight: 600,
                              }}>
                              <div>{label}</div>
                              {obj.area && <div style={{fontSize:9, opacity:0.7, fontWeight:400}}>{obj.area}м²</div>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  {otherObjs.length > 0 && (
                    <div style={{marginBottom:12}}>
                      <div style={{fontSize:11, fontWeight:600, color:'#aaa', marginBottom:6, letterSpacing:1}}>
                        ОБЩИЕ / ДРУГИЕ
                      </div>
                      <div style={{display:'flex', flexWrap:'wrap', gap:4}}>
                        {otherObjs.map(obj => {
                          const st = getStatusStyle(obj.status);
                          const label = getShortLabel(obj);
                          return (
                            <div key={obj.id}
                              onClick={() => { setSelectedBuilding(null); onNavigate('objects', obj.id); }}
                              title={`${obj.name}\n${obj.tenant_name ? 'Арендатор: ' + obj.tenant_name : 'Свободно'}`}
                              style={{
                                background: st.bg,
                                color: st.color,
                                border: `1px solid ${st.color}`,
                                borderRadius: 6,
                                padding: '5px 8px',
                                fontSize: 11,
                                cursor: 'pointer',
                                minWidth: 48,
                                textAlign: 'center',
                                fontWeight: 600,
                              }}>
                              <div>{label}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
