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
      const [buildingNames2, setBuildingNames2] = useState({});
const [editingBuilding, setEditingBuilding] = useState(null);
const [editingValue, setEditingValue] = useState('');
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
  const bldRes = await fetch('/api/db', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: `SELECT * FROM buildings ORDER BY display_name`, params: [] })
});
const bldData = await bldRes.json();
const bldMap = {};
for (const b of bldData.rows || []) bldMap[b.type] = b;
setBuildingNames2(bldMap);
setLoading(false);
    setLoading(false);
  }
async function saveBuilding(type, displayName) {
  await fetch('/api/db', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `UPDATE buildings SET display_name = $1 WHERE type = $2`,
      params: [displayName, type]
    })
  });
  setBuildingNames2(prev => ({
    ...prev,
    [type]: { ...prev[type], display_name: displayName }
  }));
  setEditingBuilding(null);
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

  function getShortLabel(obj) {
    if (obj.office) return obj.office;
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

  return (
    <div>
      {/* Метрики */}
      <div className="stats" style={{marginBottom:16}}>
        <div className="stat"><div className="stat-label">Всего помещений</div><div className="stat-val purple">{allStats.всего}</div></div>
        <div className="stat"><div className="stat-label">Сдано</div><div className="stat-val green">{allStats.сдано}</div></div>
        <div className="stat"><div className="stat-label">Свободно</div><div className="stat-val red">{allStats.неСдано}</div></div>
        <div className="stat"><div className="stat-label">Площадь сдано / всего</div><div className="stat-val" style={{fontSize:13}}>{Math.round(allStats.площадьСдано).toLocaleString('ru-RU')} / {Math.round(allStats.площадьВсего).toLocaleString('ru-RU')} м²</div></div>
        <div className="stat"><div className="stat-label">Аренда / Коммуналка</div><div className="stat-val" style={{fontSize:12}}>{allStats.аренда.toLocaleString('ru-RU')} / {allStats.коммуналка.toLocaleString('ru-RU')} ₽</div></div>
      </div>

      {/* Фильтры */}
      <div style={{display:'flex', gap:8, marginBottom:12, flexWrap:'wrap', alignItems:'center'}}>
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
      <div style={{display:'flex', gap:16, marginBottom:12}}>
        {Object.entries(STATUS_COLORS).filter(([k]) => k !== 'default').map(([status, style]) => (
          <div key={status} style={{display:'flex', alignItems:'center', gap:6, fontSize:12}}>
            <div style={{width:12, height:12, borderRadius:3, background:style.bg, border:`1px solid ${style.color}`}} />
            {status}
          </div>
        ))}
      </div>

      {/* Основной layout */}
      <div style={{display:'grid', gridTemplateColumns: selectedBuilding ? '1fr 420px' : '1fr', gap:16, alignItems:'start'}}>

        {/* Таблица зданий */}
        <div style={{overflowX:'auto'}}>
          <table>
            <thead>
              <tr>
                <th>Здание</th>
                <th style={{textAlign:'center'}}>Этажей</th>
                <th style={{textAlign:'center'}}>Всего</th>
                <th style={{textAlign:'center'}}>Сдано</th>
                <th style={{textAlign:'center'}}>Своб.</th>
                <th style={{textAlign:'right'}}>Площадь м²</th>
                <th style={{textAlign:'right'}}>Аренда ₽</th>
                <th style={{textAlign:'right'}}>Коммун. ₽</th>
                <th style={{textAlign:'right'}}>Итого ₽</th>
                <th style={{minWidth:100}}>Заполн.</th>
              </tr>
            </thead>
            <tbody>
              {filteredBuildings.map(name => {
                const s = getBuildingStats(buildings[name]);
                const pct = s.всего > 0 ? Math.round((s.сдано / s.всего) * 100) : 0;
                const barColor = pct === 100 ? '#3B6D11' : pct > 50 ? '#534AB7' : '#f0a500';
                const isSelected = selectedBuilding === name;
                return (
                  <tr key={name}
                    onClick={() => setSelectedBuilding(isSelected ? null : name)}
                    style={{cursor:'pointer', background: isSelected ? '#f0f0ff' : 'inherit'}}>
                    <td style={{fontWeight:500}}>
  {editingBuilding === name ? (
    <div style={{display:'flex', gap:6, alignItems:'center'}}>
      <input autoFocus value={editingValue}
        onChange={e => setEditingValue(e.target.value)}
        onKeyDown={e => { if(e.key==='Enter') saveBuilding(name, editingValue); if(e.key==='Escape') setEditingBuilding(null); }}
        style={{padding:'4px 8px', borderRadius:6, border:'1px solid #534AB7', fontSize:13, width:160}} />
      <button onClick={() => saveBuilding(name, editingValue)}
        style={{background:'#534AB7', color:'#fff', border:'none', borderRadius:6, padding:'4px 10px', fontSize:12, cursor:'pointer'}}>✓</button>
      <button onClick={() => setEditingBuilding(null)}
        style={{background:'none', border:'none', color:'#aaa', cursor:'pointer', fontSize:14}}>✕</button>
    </div>
  ) : (
    <div style={{display:'flex', alignItems:'center', gap:8}}>
      <span style={{color:'#534AB7', cursor:'pointer'}}
        onClick={() => setSelectedBuilding(name === selectedBuilding ? null : name)}>
        {buildingNames2[name]?.display_name || name}
      </span>
      <button onClick={e => { e.stopPropagation(); setEditingBuilding(name); setEditingValue(buildingNames2[name]?.display_name || name); }}
        style={{background:'none', border:'none', color:'#aaa', cursor:'pointer', fontSize:12, padding:'2px 4px'}}>
        ✎
      </button>
    </div>
  )}
</td>
                    <td style={{textAlign:'center'}}>{s.этажей || '—'}</td>
                    <td style={{textAlign:'center'}}>{s.всего}</td>
                    <td style={{textAlign:'center', color:'#3B6D11', fontWeight:500}}>{s.сдано}</td>
                    <td style={{textAlign:'center', color: s.неСдано > 0 ? '#A32D2D' : '#888', fontWeight: s.неСдано > 0 ? 500 : 400}}>{s.неСдано}</td>
                    <td style={{textAlign:'right', fontSize:12}}>{Math.round(s.площадьВсего).toLocaleString('ru-RU')}</td>
                    <td style={{textAlign:'right', fontSize:12}}>{s.аренда > 0 ? s.аренда.toLocaleString('ru-RU') : '—'}</td>
                    <td style={{textAlign:'right', fontSize:12}}>{s.коммуналка > 0 ? s.коммуналка.toLocaleString('ru-RU') : '—'}</td>
                    <td style={{textAlign:'right', fontSize:12, fontWeight:500, color:'#534AB7'}}>{(s.аренда + s.коммуналка) > 0 ? (s.аренда + s.коммуналка).toLocaleString('ru-RU') : '—'}</td>
                    <td>
                      <div style={{display:'flex', alignItems:'center', gap:6}}>
                        <div style={{flex:1, background:'#f0f0f0', borderRadius:4, height:7, overflow:'hidden'}}>
                          <div style={{background:barColor, width:`${pct}%`, height:'100%', borderRadius:4}} />
                        </div>
                        <span style={{fontSize:11, color:'#888', whiteSpace:'nowrap'}}>{pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Панель шахматки справа */}
        {selectedBuilding && (
          <div style={{background:'#fff', border:'1px solid #e5e5e5', borderRadius:10, padding:16, position:'sticky', top:16, maxHeight:'80vh', overflowY:'auto'}}>
            
            {/* Заголовок */}
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12}}>
              <div style={{fontWeight:700, fontSize:14, color:'#534AB7'}}>
  🏢 {buildingNames2[selectedBuilding]?.display_name || selectedBuilding}
  <div style={{fontSize:11, color:'#aaa', fontWeight:400}}>{selectedBuilding}</div>
</div>
              <button onClick={() => setSelectedBuilding(null)}
                style={{background:'none', border:'none', cursor:'pointer', color:'#aaa', fontSize:16}}>✕</button>
            </div>

            {/* Краткая статистика в одну строку */}
            {(() => {
              const s = getBuildingStats(buildings[selectedBuilding]);
              const pct = s.всего > 0 ? Math.round((s.сдано / s.всего) * 100) : 0;
              return (
                <div style={{display:'flex', gap:8, flexWrap:'wrap', fontSize:12, marginBottom:14, padding:'8px 10px', background:'#f8f8ff', borderRadius:8}}>
                  <span>📦 <b>{s.всего}</b></span>
                  <span style={{color:'#3B6D11'}}>✅ <b>{s.сдано}</b></span>
                  <span style={{color:'#A32D2D'}}>❌ <b>{s.неСдано}</b></span>
                  <span>📐 <b>{Math.round(s.площадьВсего).toLocaleString('ru-RU')}</b> м²</span>
                  <span style={{color:'#534AB7'}}>💰 <b>{(s.аренда + s.коммуналка).toLocaleString('ru-RU')}</b> ₽</span>
                  <span style={{color:'#888'}}>📊 <b>{pct}%</b></span>
                </div>
              );
            })()}

            {/* Шахматка */}
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
                              title={`${obj.name}\n${obj.tenant_name ? obj.tenant_name : 'Свободно'}\n${obj.area ? obj.area + ' м²' : ''}`}
                              style={{
                                background: st.bg,
                                color: st.color,
                                border: `1px solid ${st.color}`,
                                borderRadius: 6,
                                padding: '5px 7px',
                                fontSize: 10,
                                cursor: 'pointer',
                                minWidth: 52,
                                maxWidth: 90,
                                textAlign: 'center',
                              }}>
                              <div style={{fontWeight:700, fontSize:11}}>{label}</div>
                              {obj.area && <div style={{opacity:0.7}}>{obj.area}м²</div>}
                              {obj.tenant_name && (
                                <div style={{opacity:0.85, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontSize:9}}>
                                  {obj.tenant_name.split(' ').slice(0,2).join(' ')}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  {otherObjs.length > 0 && (
                    <div>
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
                              title={`${obj.name}\n${obj.tenant_name ? obj.tenant_name : 'Свободно'}`}
                              style={{
                                background: st.bg,
                                color: st.color,
                                border: `1px solid ${st.color}`,
                                borderRadius: 6,
                                padding: '5px 7px',
                                fontSize: 10,
                                cursor: 'pointer',
                                minWidth: 52,
                                maxWidth: 90,
                                textAlign: 'center',
                              }}>
                              <div style={{fontWeight:700, fontSize:11}}>{label}</div>
                              {obj.tenant_name && (
                                <div style={{opacity:0.85, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontSize:9}}>
                                  {obj.tenant_name.split(' ').slice(0,2).join(' ')}
                                </div>
                              )}
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
