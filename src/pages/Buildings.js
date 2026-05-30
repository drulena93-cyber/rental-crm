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
    const аренда = учитываемые.reduce((s, o) => s + (parseFloat(o.rent) || 0) + (parseFloat(o.utility_cost) || 0), 0);
    const этажи = [...new Set(учитываемые.map(o => o.floor).filter(Boolean))];
    return {
      всего: учитываемые.length,
      сдано: сдано.length,
      неСдано: неСдано.length,
      площадьВсего,
      площадьСдано,
      аренда,
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

  if (loading) return <p>Загрузка...</p>;

  const buildingNames = Object.keys(buildings).sort();

  // Общая статистика по всем зданиям
  const allStats = buildingNames.reduce((acc, name) => {
    const s = getBuildingStats(buildings[name]);
    acc.всего += s.всего;
    acc.сдано += s.сдано;
    acc.неСдано += s.неСдано;
    acc.площадьВсего += s.площадьВсего;
    acc.площадьСдано += s.площадьСдано;
    acc.аренда += s.аренда;
    return acc;
  }, { всего: 0, сдано: 0, неСдано: 0, площадьВсего: 0, площадьСдано: 0, аренда: 0 });

  return (
    <div>
      {/* Общая статистика */}
      <div className="stats" style={{marginBottom: 20}}>
        <div className="stat"><div className="stat-label">Всего помещений</div><div className="stat-val purple">{allStats.всего}</div></div>
        <div className="stat"><div className="stat-label">Сдано</div><div className="stat-val green">{allStats.сдано}</div></div>
        <div className="stat"><div className="stat-label">Свободно</div><div className="stat-val red">{allStats.неСдано}</div></div>
        <div className="stat"><div className="stat-label">Площадь сдано / всего</div><div className="stat-val" style={{fontSize:13}}>{Math.round(allStats.площадьСдано).toLocaleString('ru-RU')} / {Math.round(allStats.площадьВсего).toLocaleString('ru-RU')} м²</div></div>
        <div className="stat"><div className="stat-label">Аренда в месяц</div><div className="stat-val">{allStats.аренда.toLocaleString('ru-RU')} ₽</div></div>
      </div>

      {/* Легенда */}
      <div style={{display:'flex', gap:16, marginBottom:16, flexWrap:'wrap'}}>
        {Object.entries(STATUS_COLORS).filter(([k]) => k !== 'default').map(([status, style]) => (
          <div key={status} style={{display:'flex', alignItems:'center', gap:6, fontSize:12}}>
            <div style={{width:12, height:12, borderRadius:3, background:style.bg, border:`1px solid ${style.color}`}} />
            {status}
          </div>
        ))}
      </div>

      {/* Таблица зданий */}
      <table>
        <thead>
          <tr>
            <th>Здание</th>
            <th style={{textAlign:'center'}}>Этажей</th>
            <th style={{textAlign:'center'}}>Всего</th>
            <th style={{textAlign:'center'}}>Сдано</th>
            <th style={{textAlign:'center'}}>Свободно</th>
            <th style={{textAlign:'right'}}>Площадь сдано / всего</th>
            <th style={{textAlign:'right'}}>Аренда ₽/мес</th>
            <th style={{minWidth:120}}>Заполненность</th>
          </tr>
        </thead>
        <tbody>
          {buildingNames.map(name => {
            const s = getBuildingStats(buildings[name]);
            const pct = s.всего > 0 ? Math.round((s.сдано / s.всего) * 100) : 0;
            const barColor = pct === 100 ? '#3B6D11' : pct > 50 ? '#534AB7' : '#f0a500';
            return (
              <tr key={name} style={{cursor:'pointer'}}
                onClick={() => setSelectedBuilding(name === selectedBuilding ? null : name)}>
                <td style={{fontWeight:500, color:'#534AB7'}}>{name}</td>
                <td style={{textAlign:'center'}}>{s.этажей || '—'}</td>
                <td style={{textAlign:'center'}}>{s.всего}</td>
                <td style={{textAlign:'center', color:'#3B6D11', fontWeight:500}}>{s.сдано}</td>
                <td style={{textAlign:'center', color: s.неСдано > 0 ? '#A32D2D' : '#888', fontWeight: s.неСдано > 0 ? 500 : 400}}>{s.неСдано}</td>
                <td style={{textAlign:'right', fontSize:12}}>
                  {Math.round(s.площадьСдано).toLocaleString('ru-RU')} / {Math.round(s.площадьВсего).toLocaleString('ru-RU')} м²
                </td>
                <td style={{textAlign:'right', fontSize:12}}>{s.аренда > 0 ? s.аренда.toLocaleString('ru-RU') + ' ₽' : '—'}</td>
                <td>
                  <div style={{display:'flex', alignItems:'center', gap:6}}>
                    <div style={{flex:1, background:'#f0f0f0', borderRadius:4, height:8, overflow:'hidden'}}>
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

      {/* Модальное окно с шахматкой */}
      {selectedBuilding && (
        <div className="modal-overlay" onClick={() => setSelectedBuilding(null)}>
          <div className="modal" style={{width:800, maxHeight:'80vh', overflowY:'auto'}}
            onClick={e => e.stopPropagation()}>
            <div className="modal-title">
              🏢 {selectedBuilding} — поэтажная схема
              <button className="modal-close" onClick={() => setSelectedBuilding(null)}>✕ Закрыть</button>
            </div>

            {/* Статистика здания */}
            {(() => {
              const s = getBuildingStats(buildings[selectedBuilding]);
              const pct = s.всего > 0 ? Math.round((s.сдано / s.всего) * 100) : 0;
              return (
                <div style={{display:'flex', gap:16, marginBottom:16, flexWrap:'wrap', fontSize:13}}>
                  <span>📦 Всего: <b>{s.всего}</b></span>
                  <span style={{color:'#3B6D11'}}>✅ Сдано: <b>{s.сдано}</b></span>
                  <span style={{color:'#A32D2D'}}>❌ Свободно: <b>{s.неСдано}</b></span>
                  <span>📐 <b>{Math.round(s.площадьВсего).toLocaleString('ru-RU')}</b> м²</span>
                  <span>💰 <b>{s.аренда.toLocaleString('ru-RU')}</b> ₽/мес</span>
                  <span style={{color:'#534AB7'}}>📊 Заполнено: <b>{pct}%</b></span>
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
                    <div key={floor} style={{marginBottom:16}}>
                      <div style={{fontSize:12, fontWeight:600, color:'#888', marginBottom:8, borderBottom:'1px solid #f0f0f0', paddingBottom:4}}>
                        ЭТАЖ {floor}
                      </div>
                      <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
                        {floors[floor].map(obj => {
                          const st = getStatusStyle(obj.status);
                          return (
                            <div key={obj.id}
                              onClick={() => { setSelectedBuilding(null); onNavigate('objects', obj.id); }}
                              style={{
                                background: st.bg,
                                color: st.color,
                                border: `1px solid ${st.color}`,
                                borderRadius: 6,
                                padding: '6px 10px',
                                fontSize: 11,
                                cursor: 'pointer',
                                minWidth: 90,
                                maxWidth: 170,
                                textAlign: 'center',
                              }}>
                              <div style={{fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                                {obj.name}
                              </div>
                              {obj.tenant_name && (
                                <div style={{fontSize:10, opacity:0.85, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                                  {obj.tenant_name}
                                </div>
                              )}
                              {obj.area && (
                                <div style={{fontSize:10, opacity:0.7}}>{obj.area} м²</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  {otherObjs.length > 0 && (
                    <div style={{marginBottom:16}}>
                      <div style={{fontSize:12, fontWeight:600, color:'#888', marginBottom:8, borderBottom:'1px solid #f0f0f0', paddingBottom:4}}>
                        ОБЩИЕ / ДРУГИЕ
                      </div>
                      <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
                        {otherObjs.map(obj => {
                          const st = getStatusStyle(obj.status);
                          return (
                            <div key={obj.id}
                              onClick={() => { setSelectedBuilding(null); onNavigate('objects', obj.id); }}
                              style={{
                                background: st.bg,
                                color: st.color,
                                border: `1px solid ${st.color}`,
                                borderRadius: 6,
                                padding: '6px 10px',
                                fontSize: 11,
                                cursor: 'pointer',
                                minWidth: 90,
                                maxWidth: 170,
                                textAlign: 'center',
                              }}>
                              <div style={{fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                                {obj.name}
                              </div>
                              {obj.tenant_name && (
                                <div style={{fontSize:10, opacity:0.85, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                                  {obj.tenant_name}
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
        </div>
      )}
    </div>
  );
}
