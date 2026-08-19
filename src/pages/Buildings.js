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

// ── Компонент ключей здания ───────────────────────────────────────────────
function BuildingKeysSection({ buildingType }) {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingKey, setEditingKey] = useState(null);
  const [form, setForm] = useState({ key_number: '', status: 'В картотеке', issued_to: '', issued_date: '', comment: '' });

  useEffect(() => { fetchKeys(); }, [buildingType]);

  async function fetchKeys() {
    setLoading(true);
    const res = await fetch('/api/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `SELECT * FROM object_keys WHERE building_type = $1 AND object_id IS NULL ORDER BY key_number::integer NULLS LAST, created_at`,
        params: [buildingType]
      })
    });
    const data = await res.json();
    setKeys(data.rows || []);
    setLoading(false);
  }

  async function saveKey() {
    if (!form.key_number) return alert('Введите номер ключа');
    if (editingKey) {
      await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `UPDATE object_keys SET key_number=$1, status=$2, issued_to=$3, issued_date=$4, comment=$5 WHERE id=$6`,
          params: [form.key_number, form.status, form.issued_to || null, form.issued_date || null, form.comment || null, editingKey]
        })
      });
    } else {
      await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `INSERT INTO object_keys (building_type, key_number, status, issued_to, issued_date, comment) VALUES ($1,$2,$3,$4,$5,$6)`,
          params: [buildingType, form.key_number, form.status, form.issued_to || null, form.issued_date || null, form.comment || null]
        })
      });
    }
    setShowForm(false);
    setEditingKey(null);
    setForm({ key_number: '', status: 'В картотеке', issued_to: '', issued_date: '', comment: '' });
    fetchKeys();
  }

  async function deleteKey(id) {
    if (!window.confirm('Удалить ключ?')) return;
    await fetch('/api/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `DELETE FROM object_keys WHERE id=$1`, params: [id] })
    });
    fetchKeys();
  }

  function openEdit(k) {
    setForm({ key_number: k.key_number || '', status: k.status || 'В картотеке', issued_to: k.issued_to || '', issued_date: k.issued_date || '', comment: k.comment || '' });
    setEditingKey(k.id);
    setShowForm(true);
  }

  function openAdd() {
    const nextNum = String((keys.length > 0 ? Math.max(...keys.map(k => parseInt(k.key_number) || 0)) : 0) + 1);
    setForm({ key_number: nextNum, status: 'В картотеке', issued_to: '', issued_date: '', comment: '' });
    setEditingKey(null);
    setShowForm(true);
  }

  const statusColor = (s) => {
    if (s === 'У арендатора') return { bg: '#E6F1FB', color: '#185FA5' };
    if (s === 'В картотеке') return { bg: '#EAF3DE', color: '#3B6D11' };
    if (s === 'Другое') return { bg: '#FAEEDA', color: '#854F0B' };
    return { bg: '#f4f4f8', color: '#555' };
  };

  const уАрендатора = keys.filter(k => k.status === 'У арендатора').length;
  const вКартотеке = keys.filter(k => k.status === 'В картотеке').length;
  const другое = keys.filter(k => k.status === 'Другое').length;

  return (
    <div style={{marginTop:16, borderTop:'1px solid #e5e5e5', paddingTop:12}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8}}>
        <div style={{fontSize:12, fontWeight:600, color:'#534AB7'}}>🔑 Ключи здания</div>
        <button onClick={openAdd}
          style={{background:'#534AB7', color:'#fff', border:'none', borderRadius:6, padding:'3px 10px', fontSize:11, cursor:'pointer'}}>
          + Добавить
        </button>
      </div>

      {/* Сводка */}
      {keys.length > 0 && (
        <div style={{display:'flex', gap:10, fontSize:11, marginBottom:8, flexWrap:'wrap'}}>
          <span>🔑 Всего: <b>{keys.length}</b></span>
          <span style={{color:'#185FA5'}}>👤 У арендатора: <b>{уАрендатора}</b></span>
          <span style={{color:'#3B6D11'}}>🗄 В картотеке: <b>{вКартотеке}</b></span>
          {другое > 0 && <span style={{color:'#854F0B'}}>📌 Другое: <b>{другое}</b></span>}
        </div>
      )}

      {loading ? <div style={{fontSize:11, color:'#aaa'}}>Загрузка...</div> :
       keys.length === 0 ? <div style={{fontSize:11, color:'#aaa', marginBottom:8}}>Ключи не добавлены</div> : (
        <table style={{fontSize:11, width:'100%', marginBottom:8}}>
          <thead>
            <tr>
              <th style={{textAlign:'center', width:30}}>№</th>
              <th>Статус</th>
              <th>Выдан кому</th>
              <th>Дата</th>
              <th>Комментарий</th>
              <th style={{width:50}}></th>
            </tr>
          </thead>
          <tbody>
            {keys.map(k => {
              const st = statusColor(k.status);
              return (
                <tr key={k.id}>
                  <td style={{textAlign:'center', fontWeight:600}}>{k.key_number}</td>
                  <td>
                    <span style={{background:st.bg, color:st.color, borderRadius:4, padding:'1px 6px', fontSize:10, fontWeight:500}}>
                      {k.status}
                    </span>
                  </td>
                  <td>{k.issued_to || '—'}</td>
                  <td>{k.issued_date ? new Date(k.issued_date).toLocaleDateString('ru-RU') : '—'}</td>
                  <td style={{color:'#888'}}>{k.comment || '—'}</td>
                  <td>
                    <button onClick={() => openEdit(k)}
                      style={{background:'none', border:'none', color:'#534AB7', cursor:'pointer', marginRight:4, fontSize:11}}>✎</button>
                    <button onClick={() => deleteKey(k.id)}
                      style={{background:'none', border:'none', color:'#A32D2D', cursor:'pointer', fontSize:11}}>✕</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {showForm && (
        <div style={{background:'#f0f0ff', borderRadius:8, padding:10, marginTop:8}}>
          <div style={{fontSize:12, fontWeight:500, marginBottom:8}}>
            {editingKey ? 'Редактировать ключ' : 'Новый ключ'}
          </div>
          <div style={{display:'grid', gridTemplateColumns:'60px 1fr 1fr', gap:6, marginBottom:6}}>
            <div>
              <div style={{fontSize:10, color:'#888', marginBottom:2}}>№ ключа</div>
              <input value={form.key_number} onChange={e => setForm({...form, key_number: e.target.value})}
                style={{width:'100%', padding:'4px 6px', borderRadius:6, border:'1px solid #ddd', fontSize:12}} />
            </div>
            <div>
              <div style={{fontSize:10, color:'#888', marginBottom:2}}>Статус</div>
              <select value={form.status} onChange={e => setForm({...form, status: e.target.value})}
                style={{width:'100%', padding:'4px 6px', borderRadius:6, border:'1px solid #ddd', fontSize:12}}>
                <option>У арендатора</option>
                <option>В картотеке</option>
                <option>Другое</option>
              </select>
            </div>
            <div>
              <div style={{fontSize:10, color:'#888', marginBottom:2}}>Дата выдачи</div>
              <input type="date" value={form.issued_date} onChange={e => setForm({...form, issued_date: e.target.value})}
                style={{width:'100%', padding:'4px 6px', borderRadius:6, border:'1px solid #ddd', fontSize:12}} />
            </div>
          </div>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:8}}>
            <div>
              <div style={{fontSize:10, color:'#888', marginBottom:2}}>Выдан кому</div>
              <input value={form.issued_to} onChange={e => setForm({...form, issued_to: e.target.value})}
                placeholder="ФИО или организация"
                style={{width:'100%', padding:'4px 6px', borderRadius:6, border:'1px solid #ddd', fontSize:12}} />
            </div>
            <div>
              <div style={{fontSize:10, color:'#888', marginBottom:2}}>Комментарий</div>
              <input value={form.comment} onChange={e => setForm({...form, comment: e.target.value})}
                placeholder="Необязательно..."
                style={{width:'100%', padding:'4px 6px', borderRadius:6, border:'1px solid #ddd', fontSize:12}} />
            </div>
          </div>
          <div style={{display:'flex', gap:6}}>
            <button className="btn-save" onClick={saveKey} style={{fontSize:12, padding:'5px 12px'}}>Сохранить</button>
            <button className="btn-cancel" onClick={() => { setShowForm(false); setEditingKey(null); }} style={{fontSize:12, padding:'5px 12px'}}>Отмена</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Buildings({ onNavigate }) {
  const CACHE_KEY = 'buildings_cache';
  const CACHE_TIME_KEY = 'buildings_cache_time';
  const CACHE_TTL = 60 * 1000;

  const [objects, setObjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterAreaMin, setFilterAreaMin] = useState('');
  const [filterAreaMax, setFilterAreaMax] = useState('');
  const [filterRentMin, setFilterRentMin] = useState('');
  const [filterRentMax, setFilterRentMax] = useState('');
  const [buildingNames2, setBuildingNames2] = useState({});
  const [editingBuilding, setEditingBuilding] = useState(null);
  const [editingValue, setEditingValue] = useState('');

  useEffect(() => { fetchAll(false); }, []);

  async function fetchAll(forceRefresh = false) {
    if (!forceRefresh) {
      const cached = localStorage.getItem(CACHE_KEY);
      const cachedTime = localStorage.getItem(CACHE_TIME_KEY);
      if (cached && cachedTime && Date.now() - parseInt(cachedTime) < CACHE_TTL) {
        try {
          const { objs, bldMap } = JSON.parse(cached);
          setObjects(objs || []);
          setBuildingNames2(bldMap || {});
          setLastUpdated(new Date(parseInt(cachedTime)));
          setLoading(false);
          return;
        } catch (e) {}
      }
    }
    forceRefresh ? setRefreshing(true) : setLoading(true);
    const [res, bldRes] = await Promise.all([
      fetch('/api/db', {
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
      }),
      fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: `SELECT * FROM buildings ORDER BY display_name`, params: [] })
      })
    ]);
    const data = await res.json();
    const bldData = await bldRes.json();
    const bldMap = {};
    for (const b of bldData.rows || []) bldMap[b.type] = b;

    const now = Date.now();
    localStorage.setItem(CACHE_KEY, JSON.stringify({ objs: data.rows || [], bldMap }));
    localStorage.setItem(CACHE_TIME_KEY, String(now));
    setObjects(data.rows || []);
    setBuildingNames2(bldMap);
    setLastUpdated(new Date(now));
    setLoading(false);
    setRefreshing(false);
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
    setBuildingNames2(prev => {
      const updated = { ...prev, [type]: { ...prev[type], display_name: displayName } };
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const d = JSON.parse(cached);
          d.bldMap = updated;
          localStorage.setItem(CACHE_KEY, JSON.stringify(d));
        }
      } catch (e) {}
      return updated;
    });
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

  const filteredTotals = filteredBuildings.reduce((acc, name) => {
    const s = getBuildingStats(buildings[name]);
    acc.всего += s.всего;
    acc.сдано += s.сдано;
    acc.неСдано += s.неСдано;
    acc.площадьВсего += s.площадьВсего;
    acc.аренда += s.аренда;
    acc.коммуналка += s.коммуналка;
    return acc;
  }, { всего: 0, сдано: 0, неСдано: 0, площадьВсего: 0, аренда: 0, коммуналка: 0 });

  const PILL = {
    purple: { bg:'#EDEAFB', border:'#C9BFF2', text:'#534AB7' },
    green:  { bg:'#E1F3D8', border:'#B7DDA0', text:'#2F6B0C' },
    red:    { bg:'#FBE1E1', border:'#EFB3B3', text:'#A32D2D' },
    blue:   { bg:'#DCEBFA', border:'#A8CDEF', text:'#185FA5' },
    gray:   { bg:'#EDEDF2', border:'#D2D2DC', text:'#4a4a55' },
  };
  const statPill = (tone = 'gray') => {
    const c = PILL[tone] || PILL.gray;
    return { background:c.bg, border:`1px solid ${c.border}`, borderRadius:8, padding:'6px 12px', fontSize:12, display:'flex', alignItems:'center', gap:5, whiteSpace:'nowrap' };
  };
  const pillValue = (tone = 'gray') => ({ fontWeight:700, color:(PILL[tone] || PILL.gray).text });
  const tagStyle = (active) => ({
    background: active ? '#534AB7' : PILL.gray.bg,
    color: active ? '#fff' : '#3f3f4a',
    border: active ? '1px solid #534AB7' : `1px solid ${PILL.gray.border}`,
    borderRadius: 16, padding: '5px 12px', fontSize: 12, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap',
    boxShadow: active ? '0 1px 3px rgba(83,74,183,0.35)' : 'none'
  });

  return (
    <div>
      <div className="toolbar" style={{flexWrap:'wrap', alignItems:'center', gap:8, marginBottom:12}}>
        <div style={statPill('purple')}>
          <span style={{color:'#6b6b75'}}>Всего:</span><span style={pillValue('purple')}>{allStats.всего}</span>
          <span title="Всего помещений" style={{cursor:'help', marginLeft:2, color:'#534AB7', fontWeight:700, fontSize:10, border:'1px solid #534AB7', borderRadius:'50%', width:14, height:14, display:'inline-flex', alignItems:'center', justifyContent:'center'}}>!</span>
        </div>
        <div style={statPill('green')}><span style={{color:'#6b6b75'}}>Сдано:</span><span style={pillValue('green')}>{allStats.сдано}</span></div>
        <div style={statPill('red')}><span style={{color:'#6b6b75'}}>Свободно:</span><span style={pillValue('red')}>{allStats.неСдано}</span></div>
        <div style={statPill('gray')}><span style={{color:'#6b6b75'}}>Площадь:</span><span style={pillValue('gray')}>{Math.round(allStats.площадьСдано).toLocaleString('ru-RU')} / {Math.round(allStats.площадьВсего).toLocaleString('ru-RU')} м²</span></div>
        <div style={statPill('gray')}><span style={{color:'#6b6b75'}}>Аренда/Комм.:</span><span style={pillValue('gray')}>{allStats.аренда.toLocaleString('ru-RU')} / {allStats.коммуналка.toLocaleString('ru-RU')} ₽</span></div>
        <span style={{fontSize:12, color:'#888', marginLeft:4}}>Статус:</span>
        <button onClick={() => { setFilterStatus(''); setSelectedBuilding(null); }} style={tagStyle(filterStatus === '')}>Все статусы</button>
        <button onClick={() => { setFilterStatus('Сдано'); setSelectedBuilding(null); }} style={tagStyle(filterStatus === 'Сдано')}>Есть сданные</button>
        <button onClick={() => { setFilterStatus('Не сдано'); setSelectedBuilding(null); }} style={tagStyle(filterStatus === 'Не сдано')}>Есть свободные</button>
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
        <button onClick={() => fetchAll(true)} disabled={refreshing}
          style={{background:'#f4f4f8', border:'1px solid #ddd', borderRadius:6, padding:'6px 12px', fontSize:13, cursor:'pointer', whiteSpace:'nowrap'}}>
          {refreshing ? '⏳ Обновление...' : '🔄 Обновить'}
        </button>
      </div>

      {lastUpdated && (
        <div style={{fontSize:11, color:'#aaa', marginBottom:8}}>
          Данные загружены: {lastUpdated.toLocaleTimeString('ru-RU')}
        </div>
      )}

      <div style={{display:'flex', gap:16, marginBottom:12}}>
        {Object.entries(STATUS_COLORS).filter(([k]) => k !== 'default').map(([status, style]) => (
          <div key={status} style={{display:'flex', alignItems:'center', gap:6, fontSize:12}}>
            <div style={{width:12, height:12, borderRadius:3, background:style.bg, border:`1px solid ${style.color}`}} />
            {status}
          </div>
        ))}
      </div>

      <div style={{display:'grid', gridTemplateColumns: selectedBuilding ? '1fr 1fr' : '1fr', gap:12, alignItems:'start'}}>
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
                        <div style={{display:'flex', gap:6, alignItems:'center'}} onClick={e => e.stopPropagation()}>
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
                          <span style={{color:'#534AB7'}}>
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
            <tfoot>
              <tr style={{fontWeight:600, background:'#f9f9fb', borderTop:'2px solid #e5e5ea'}}>
                <td>Итого</td>
                <td style={{textAlign:'center', color:'#aaa'}}>—</td>
                <td style={{textAlign:'center', cursor:'pointer', textDecoration:'underline', color:'#534AB7'}}
                  title="Перейти в Объекты"
                  onClick={() => onNavigate('objects', null, { filterStatus: '' })}>
                  {filteredTotals.всего}
                </td>
                <td style={{textAlign:'center', color:'#3B6D11', cursor:'pointer', textDecoration:'underline'}}
                  title="Перейти в Объекты со статусом «Сдано»"
                  onClick={() => onNavigate('objects', null, { filterStatus: 'Сдано' })}>
                  {filteredTotals.сдано}
                </td>
                <td style={{textAlign:'center', color: filteredTotals.неСдано > 0 ? '#A32D2D' : '#888', cursor:'pointer', textDecoration:'underline'}}
                  title="Перейти в Объекты со статусом «Не сдано»"
                  onClick={() => onNavigate('objects', null, { filterStatus: 'Не сдано' })}>
                  {filteredTotals.неСдано}
                </td>
                <td style={{textAlign:'right', fontSize:12}}>{Math.round(filteredTotals.площадьВсего).toLocaleString('ru-RU')}</td>
                <td style={{textAlign:'right', fontSize:12}}>{filteredTotals.аренда > 0 ? filteredTotals.аренда.toLocaleString('ru-RU') : '—'}</td>
                <td style={{textAlign:'right', fontSize:12}}>{filteredTotals.коммуналка > 0 ? filteredTotals.коммуналка.toLocaleString('ru-RU') : '—'}</td>
                <td style={{textAlign:'right', fontSize:12, color:'#534AB7'}}>{(filteredTotals.аренда + filteredTotals.коммуналка) > 0 ? (filteredTotals.аренда + filteredTotals.коммуналка).toLocaleString('ru-RU') : '—'}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {selectedBuilding && (
          <div style={{background:'#fff', border:'1px solid #e5e5e5', borderRadius:10, padding:16, position:'sticky', top:16, maxHeight:'80vh', overflowY:'auto'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12}}>
              <div style={{fontWeight:700, fontSize:14, color:'#534AB7'}}>
                🏢 {buildingNames2[selectedBuilding]?.display_name || selectedBuilding}
                <div style={{fontSize:11, color:'#aaa', fontWeight:400}}>{selectedBuilding}</div>
              </div>
              <button onClick={() => setSelectedBuilding(null)}
                style={{background:'none', border:'none', cursor:'pointer', color:'#aaa', fontSize:16}}>✕</button>
            </div>

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
                      <div style={{fontSize:11, fontWeight:600, color:'#aaa', marginBottom:6, letterSpacing:1}}>ЭТАЖ {floor}</div>
                      <div style={{display:'flex', flexWrap:'wrap', gap:4}}>
                        {floors[floor].map(obj => {
                          const st = getStatusStyle(obj.status);
                          const label = getShortLabel(obj);
                          return (
                            <div key={obj.id}
                              onClick={() => { setSelectedBuilding(null); onNavigate('objects', obj.id); }}
                              title={`${obj.name}\n${obj.tenant_name ? obj.tenant_name : 'Свободно'}\n${obj.area ? obj.area + ' м²' : ''}`}
                              style={{background:st.bg, color:st.color, border:`1px solid ${st.color}`, borderRadius:6, padding:'5px 7px', fontSize:10, cursor:'pointer', minWidth:52, maxWidth:90, textAlign:'center'}}>
                              <div style={{fontWeight:700, fontSize:11}}>{label}</div>
                              {obj.area && <div style={{opacity:0.7}}>{obj.area}м²</div>}
                              {obj.tenant_name && <div style={{opacity:0.85, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontSize:9}}>{obj.tenant_name.split(' ').slice(0,2).join(' ')}</div>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  {otherObjs.length > 0 && (
                    <div>
                      <div style={{fontSize:11, fontWeight:600, color:'#aaa', marginBottom:6, letterSpacing:1}}>ОБЩИЕ / ДРУГИЕ</div>
                      <div style={{display:'flex', flexWrap:'wrap', gap:4}}>
                        {otherObjs.map(obj => {
                          const st = getStatusStyle(obj.status);
                          const label = getShortLabel(obj);
                          return (
                            <div key={obj.id}
                              onClick={() => { setSelectedBuilding(null); onNavigate('objects', obj.id); }}
                              title={`${obj.name}\n${obj.tenant_name ? obj.tenant_name : 'Свободно'}`}
                              style={{background:st.bg, color:st.color, border:`1px solid ${st.color}`, borderRadius:6, padding:'5px 7px', fontSize:10, cursor:'pointer', minWidth:52, maxWidth:90, textAlign:'center'}}>
                              <div style={{fontWeight:700, fontSize:11}}>{label}</div>
                              {obj.tenant_name && <div style={{opacity:0.85, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontSize:9}}>{obj.tenant_name.split(' ').slice(0,2).join(' ')}</div>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}

            {/* Ключи здания */}
            <BuildingKeysSection buildingType={selectedBuilding} />
          </div>
        )}
      </div>
    </div>
  );
}
