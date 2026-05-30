import React, { useState, useEffect } from 'react';

const STATUS_COLORS = {
  'Сдано':         { bg: '#EAF3DE', color: '#3B6D11', label: 'Сдано' },
  'Не сдано':      { bg: '#FCEBEB', color: '#A32D2D', label: 'Не сдано' },
  'Не учитывать':  { bg: '#f0f0f0', color: '#999',    label: 'Не учит.' },
  'default':       { bg: '#f4f4f8', color: '#555',    label: '—' },
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

  // Группируем по зданию (type)
  const buildings = {};
  for (const obj of objects) {
    if (!buildings[obj.type]) buildings[obj.type] = [];
    buildings[obj.type].push(obj);
  }

  // Статистика по зданию
  function getBuildingStats(objs) {
    const учитываемые = objs.filter(o => o.status !== 'Не учитывать');
    const сдано = учитываемые.filter(o => o.status === 'Сдано').length;
    const неСдано = учитываемые.filter(o => o.status === 'Не сдано').length;
    const всего = учитываемые.length;
    const площадь = учитываемые.reduce((s, o) => s + (parseFloat(o.area) || 0), 0);
    const аренда = учитываемые.reduce((s, o) => s + (parseFloat(o.rent) || 0) + (parseFloat(o.utility_cost) || 0), 0);
    return { сдано, неСдано, всего, площадь, аренда };
  }

  // Группируем по этажам внутри здания
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

  return (
    <div>
      <div style={{fontWeight:600, fontSize:18, marginBottom:16}}>🏢 Здания</div>

      {/* Легенда */}
      <div style={{display:'flex', gap:12, marginBottom:20, flexWrap:'wrap'}}>
        {Object.entries(STATUS_COLORS).filter(([k]) => k !== 'default').map(([status, style]) => (
          <div key={status} style={{display:'flex', alignItems:'center', gap:6, fontSize:12}}>
            <div style={{width:14, height:14, borderRadius:3, background:style.bg, border:`1px solid ${style.color}`}} />
            {status}
          </div>
        ))}
      </div>

      {/* Карточки зданий */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:16, marginBottom:32}}>
        {buildingNames.map(name => {
          const objs = buildings[name];
          const stats = getBuildingStats(objs);
          const pct = stats.всего > 0 ? Math.round((stats.сдано / stats.всего) * 100) : 0;
          const isSelected = selectedBuilding === name;
          return (
            <div key={name}
              onClick={() => setSelectedBuilding(isSelected ? null : name)}
              style={{
                background: '#fff',
                border: isSelected ? '2px solid #534AB7' : '1px solid #e5e5e5',
                borderRadius: 10,
                padding: 16,
                cursor: 'pointer',
                transition: 'box-shadow 0.15s',
                boxShadow: isSelected ? '0 2px 12px rgba(83,74,183,0.15)' : '0 1px 4px rgba(0,0,0,0.05)',
              }}>
              <div style={{fontWeight:600, fontSize:14, marginBottom:8}}>{name}</div>
              <div style={{display:'flex', gap:12, fontSize:12, color:'#555', marginBottom:10}}>
                <span>📦 Всего: <b>{stats.всего}</b></span>
                <span style={{color:'#3B6D11'}}>✅ Сдано: <b>{stats.сдано}</b></span>
                <span style={{color:'#A32D2D'}}>❌ Свободно: <b>{stats.неСдано}</b></span>
              </div>
              {stats.площадь > 0 && (
                <div style={{fontSize:12, color:'#888', marginBottom:6}}>
                  📐 {stats.площадь.toLocaleString('ru-RU')} м² 
                  {stats.аренда > 0 && <span style={{marginLeft:8}}>💰 {stats.аренда.toLocaleString('ru-RU')} ₽/мес</span>}
                </div>
              )}
              {/* Прогресс-бар */}
              <div style={{background:'#f0f0f0', borderRadius:4, height:8, overflow:'hidden'}}>
                <div style={{
                  background: pct === 100 ? '#3B6D11' : pct > 50 ? '#534AB7' : '#f0a500',
                  width: `${pct}%`, height:'100%', borderRadius:4, transition:'width 0.3s'
                }} />
              </div>
              <div style={{fontSize:11, color:'#888', marginTop:4, textAlign:'right'}}>{pct}% заполнено</div>
            </div>
          );
        })}
      </div>

      {/* Шахматка выбранного здания */}
      {selectedBuilding && (
        <div style={{background:'#fff', border:'1px solid #e5e5e5', borderRadius:10, padding:20}}>
          <div style={{fontWeight:600, fontSize:15, marginBottom:16}}>
            🏢 {selectedBuilding} — поэтажная схема
          </div>
          {(() => {
            const objs = buildings[selectedBuilding];
            const floors = getFloors(objs);
            const floorKeys = Object.keys(floors)
              .filter(f => f !== 'other')
              .map(Number)
              .sort((a, b) => b - a); // сверху вниз — высокие этажи первыми
            const otherObjs = floors['other'] || [];

            return (
              <>
                {floorKeys.map(floor => (
                  <div key={floor} style={{marginBottom:16}}>
                    <div style={{fontSize:12, fontWeight:600, color:'#888', marginBottom:8}}>
                      ЭТАЖ {floor}
                    </div>
                    <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
                      {floors[floor].map(obj => {
                        const st = getStatusStyle(obj.status);
                        return (
                          <div key={obj.id}
                            onClick={e => { e.stopPropagation(); onNavigate('objects', obj.id); }}
                            title={`${obj.name}\n${obj.tenant_name ? 'Арендатор: ' + obj.tenant_name : 'Свободно'}\n${obj.area ? obj.area + ' м²' : ''}`}
                            style={{
                              background: st.bg,
                              color: st.color,
                              border: `1px solid ${st.color}`,
                              borderRadius: 6,
                              padding: '6px 10px',
                              fontSize: 11,
                              cursor: 'pointer',
                              minWidth: 80,
                              maxWidth: 160,
                              textAlign: 'center',
                            }}>
                            <div style={{fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                              {obj.name}
                            </div>
                            {obj.tenant_name && (
                              <div style={{fontSize:10, opacity:0.8, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
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
                    <div style={{fontSize:12, fontWeight:600, color:'#888', marginBottom:8}}>
                      ОБЩИЕ / ДРУГИЕ
                    </div>
                    <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
                      {otherObjs.map(obj => {
                        const st = getStatusStyle(obj.status);
                        return (
                          <div key={obj.id}
                            onClick={e => { e.stopPropagation(); onNavigate('objects', obj.id); }}
                            title={`${obj.name}\n${obj.tenant_name ? 'Арендатор: ' + obj.tenant_name : 'Свободно'}`}
                            style={{
                              background: st.bg,
                              color: st.color,
                              border: `1px solid ${st.color}`,
                              borderRadius: 6,
                              padding: '6px 10px',
                              fontSize: 11,
                              cursor: 'pointer',
                              minWidth: 80,
                              maxWidth: 160,
                              textAlign: 'center',
                            }}>
                            <div style={{fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                              {obj.name}
                            </div>
                            {obj.tenant_name && (
                              <div style={{fontSize:10, opacity:0.8, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
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
      )}
    </div>
  );
}
