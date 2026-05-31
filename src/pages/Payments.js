import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const MONTHS = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'];
const MONTHS_FULL = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];

export default function Payments({ onNavigate }) {
  const [mode, setMode] = useState('grid'); // grid | list
  const [tenants, setTenants] = useState([]);
  const [objects, setObjects] = useState([]);
  const [objectTenants, setObjectTenants] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());
  const [filterTenant, setFilterTenant] = useState('');
  const [filterBuilding, setFilterBuilding] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentForm, setPaymentForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
const PAGE_SIZE = 15;

  useEffect(() => { fetchAll(); }, [year]);
  useEffect(() => { setPage(1); }, [filterTenant, filterBuilding, filterStatus, year]);

  async function fetchAll() {
    setLoading(true);
    const { data: tens } = await supabase.from('tenants').select('*').is('deleted_at', null).order('name');
    const { data: objs } = await supabase.from('objects').select('*').is('deleted_at', null);
    const otRes = await fetch('/api/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `SELECT ot.tenant_id, SUM(COALESCE(o.rent,0) + COALESCE(o.utility_cost,0)) as total_rent, STRING_AGG(o.type, ',') as object_types FROM object_tenants ot JOIN tenants t ON t.id = ot.tenant_id JOIN objects o ON o.id = ot.object_id WHERE t.deleted_at IS NULL AND t.status = 'Активный' GROUP BY ot.tenant_id`, params: [] })
    });
    const otData = await otRes.json();
    const payRes = await fetch('/api/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `SELECT * FROM payments WHERE period_year = $1 ORDER BY payment_date DESC`, params: [year] })
    });
    const payData = await payRes.json();
    setTenants((tens || []).filter(t => t.status === 'Активный'));
    setObjects(objs || []);
    setObjectTenants(otData.rows || []);
    setPayments(payData.rows || []);
    setLoading(false);
  }

  // Получаем уникальные здания
  const buildings = [...new Set(objectTenants.flatMap(ot => (ot.object_types || '').split(',').filter(Boolean)))].sort();

  // Получаем объекты арендатора
  const getTenantObjects = (tenantId) => objectTenants.filter(ot => ot.tenant_id === tenantId);
  const getTenantRent = (tenantId) => {
  const row = objectTenants.find(ot => ot.tenant_id === tenantId);
  return parseFloat(row?.total_rent || 0);
};
const getTenantBuilding = (tenantId) => {
  const row = objectTenants.find(ot => ot.tenant_id === tenantId);
  return row?.object_types?.split(',')[0] || null;
};

  // Получаем оплату для арендатора за месяц
  const getPayment = (tenantId, month) => payments.find(p => p.tenant_id === tenantId && p.period_month === month + 1 && p.period_year === year);

  // Строки таблицы — один арендатор может иметь несколько объектов
  const rows = tenants.map(tenant => ({
  tenant,
  building: getTenantBuilding(tenant.id),
  rent: getTenantRent(tenant.id),
}));

  // Фильтрация строк
 const filteredRows = rows.filter(row => {
  if (filterTenant && row.tenant.id !== filterTenant) return false;
  if (filterBuilding) {
  const types = objectTenants.find(ot => ot.tenant_id === row.tenant.id)?.object_types?.split(',') || [];
  if (!types.includes(filterBuilding)) return false;
}
  if (filterStatus) {
  const tenantPayments = payments.filter(p => p.tenant_id === row.tenant.id);
  const hasAnyPayment = tenantPayments.length > 0;
  const hasUnpaid = tenantPayments.some(p => p.status !== 'Оплачено');
  const allPaid = hasAnyPayment && !hasUnpaid;
  if (filterStatus === 'Есть долги' && allPaid) return false;
  if (filterStatus === 'Все оплачено' && !allPaid) return false;
}
  return true;
});

const totalPages = Math.ceil(filteredRows.length / PAGE_SIZE);
const paginatedRows = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Статистика
  const totalExpected = payments.length > 0 ? payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0) : 0;
  const paidCount = payments.filter(p => p.status === 'Оплачено').length;

  async function openAddPayment(tenant, monthIdx) {
    const existing = getPayment(tenant.id, monthIdx);
    setPaymentForm({
      tenant_id: tenant.id,
      tenant_name: tenant.name,
      period_month: monthIdx + 1,
      period_year: year,
      payment_date: new Date().toISOString().split('T')[0],
      amount: '',
      payment_method: 'Безнал',
      status: 'Оплачено',
      comment: '',
      existing_id: existing?.id || null,
    });
    setShowPaymentForm(true);
  }

  async function savePayment() {
    setSaving(true);
    try {
      if (paymentForm.existing_id) {
        await fetch('/api/db', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: `UPDATE payments SET amount=$1, payment_date=$2, payment_method=$3, status=$4, comment=$5 WHERE id=$6`,
            params: [paymentForm.amount, paymentForm.payment_date, paymentForm.payment_method, paymentForm.status, paymentForm.comment, paymentForm.existing_id]
          })
        });
      } else {
        await fetch('/api/db', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: `INSERT INTO payments (tenant_id, amount, payment_date, payment_method, period_month, period_year, status, comment) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            params: [paymentForm.tenant_id, paymentForm.amount, paymentForm.payment_date, paymentForm.payment_method, paymentForm.period_month, paymentForm.period_year, paymentForm.status, paymentForm.comment]
          })
        });
      }
      setShowPaymentForm(false);
      fetchAll();
    } catch(e) { alert('Ошибка: ' + e.message); }
    setSaving(false);
  }

  async function deletePayment(id) {
    if (!window.confirm('Удалить запись об оплате?')) return;
    await fetch('/api/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `DELETE FROM payments WHERE id=$1`, params: [id] })
    });
    fetchAll();
  }

  function cellColor(payment) {
    if (!payment) return { bg: '#fff', color: '#ccc', label: '—' };
    if (payment.status === 'Оплачено') return { bg: '#EAF3DE', color: '#3B6D11', label: '✅' };
    if (payment.status === 'Частично') return { bg: '#FFF8E1', color: '#f0a500', label: '⚠️' };
    if (payment.status === 'Не оплачено') return { bg: '#FCEBEB', color: '#A32D2D', label: '❌' };
    return { bg: '#f4f4f8', color: '#555', label: '?' };
  }

  if (loading) return <p>Загрузка...</p>;

  return (
    <div>
      {/* Метрики */}
      <div className="stats" style={{marginBottom:16}}>
        <div className="stat"><div className="stat-label">Активных арендаторов</div><div className="stat-val purple">{tenants.length}</div></div>
        <div className="stat"><div className="stat-label">Платежей за {year}</div><div className="stat-val green">{paidCount}</div></div>
        <div className="stat"><div className="stat-label">Сумма получена</div><div className="stat-val">{totalExpected.toLocaleString('ru-RU')} ₽</div></div>
        <div className="stat"><div className="stat-label">Текущий месяц</div><div className="stat-val blue">{MONTHS_FULL[new Date().getMonth()]}</div></div>
      </div>

      {/* Тулбар */}
      <div style={{display:'flex', gap:8, marginBottom:12, flexWrap:'wrap', alignItems:'center'}}>
        {/* Переключатель режима */}
        <div style={{display:'flex', border:'1px solid #ddd', borderRadius:6, overflow:'hidden', marginRight:8}}>
          <button onClick={() => setMode('grid')}
            style={{padding:'6px 14px', fontSize:13, cursor:'pointer', border:'none', background: mode==='grid' ? '#534AB7' : '#fff', color: mode==='grid' ? '#fff' : '#333'}}>
            📊 Сводная
          </button>
          <button onClick={() => setMode('list')}
            style={{padding:'6px 14px', fontSize:13, cursor:'pointer', border:'none', background: mode==='list' ? '#534AB7' : '#fff', color: mode==='list' ? '#fff' : '#333'}}>
            📋 Список
          </button>
        </div>

        {/* Год */}
        <div style={{display:'flex', alignItems:'center', gap:4}}>
          <button onClick={() => setYear(y => y - 1)}
            style={{background:'#f4f4f8', border:'1px solid #ddd', borderRadius:6, padding:'6px 10px', cursor:'pointer', fontSize:13}}>‹</button>
          <span style={{fontWeight:600, fontSize:14, minWidth:50, textAlign:'center'}}>{year}</span>
          <button onClick={() => setYear(y => y + 1)}
            style={{background:'#f4f4f8', border:'1px solid #ddd', borderRadius:6, padding:'6px 10px', cursor:'pointer', fontSize:13}}>›</button>
        </div>

        {/* Фильтры */}
        <select value={filterBuilding} onChange={e => setFilterBuilding(e.target.value)}
          style={{padding:'6px 10px', borderRadius:6, border:'1px solid #ddd', fontSize:13}}>
          <option value="">Все здания</option>
          {buildings.map(b => <option key={b}>{b}</option>)}
        </select>
        <select value={filterTenant} onChange={e => setFilterTenant(e.target.value)}
          style={{padding:'6px 10px', borderRadius:6, border:'1px solid #ddd', fontSize:13}}>
          <option value="">Все арендаторы</option>
          {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          style={{padding:'6px 10px', borderRadius:6, border:'1px solid #ddd', fontSize:13}}>
          <option value="">Все статусы</option>
          <option value="Есть долги">Есть долги</option>
          <option value="Все оплачено">Все оплачено</option>
        </select>
        {(filterBuilding || filterTenant || filterStatus) && (
          <button onClick={() => { setFilterBuilding(''); setFilterTenant(''); setFilterStatus(''); }}
            style={{background:'#FCEBEB', color:'#A32D2D', border:'none', borderRadius:6, padding:'6px 12px', fontSize:13, cursor:'pointer'}}>
            ✕ Сбросить
          </button>
        )}
        <button onClick={() => { setPaymentForm({ payment_date: new Date().toISOString().split('T')[0], payment_method: 'Безнал', status: 'Оплачено', period_month: new Date().getMonth() + 1, period_year: year }); setShowPaymentForm(true); }}
          className="btn-add" style={{marginLeft:'auto'}}>
          + Добавить оплату
        </button>
      </div>

      {/* Легенда */}
      <div style={{display:'flex', gap:16, marginBottom:12, fontSize:12}}>
        {[['✅ Оплачено','#EAF3DE','#3B6D11'],['⚠️ Частично','#FFF8E1','#f0a500'],['❌ Не оплачено','#FCEBEB','#A32D2D'],['— Нет данных','#fff','#ccc']].map(([label, bg, color]) => (
          <div key={label} style={{display:'flex', alignItems:'center', gap:6}}>
            <div style={{width:14, height:14, borderRadius:3, background:bg, border:`1px solid ${color}`}} />
            <span style={{color:'#555'}}>{label}</span>
          </div>
        ))}
      </div>

      {/* РЕЖИМ 1 — Сводная таблица */}
      {mode === 'grid' && (
  <>
    <div style={{overflowX:'auto'}}>
          <table style={{minWidth:900}}>
            <thead>
              <tr>
                <th style={{minWidth:220, position:'sticky', left:0, background:'#f4f4f8', zIndex:1}}>Арендатор</th>
                <th style={{minWidth:140, position:'sticky', left:180, background:'#f4f4f8', zIndex:1}}>Объект</th>
                {MONTHS.map((m, i) => (
                  <th key={i} style={{textAlign:'center', minWidth:60, fontWeight: i === new Date().getMonth() ? 700 : 500, color: i === new Date().getMonth() ? '#534AB7' : 'inherit'}}>
                    {m}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedRows.map((row, idx) => (
                <tr key={`${row.tenant.id}_${row.object?.id || 'none'}_${idx}`}>
                  <td style={{fontWeight:500, fontSize:13, position:'sticky', left:0, background:'#fff', zIndex:1, cursor:'pointer'}}>
  <span style={{color:'#534AB7'}} onClick={() => onNavigate('tenants', row.tenant.id)}>
    {row.tenant.name}
  </span>
  {row.rent > 0 && (
    <div style={{fontSize:10, color:'#3B6D11', fontWeight:400}}>
      {row.rent.toLocaleString('ru-RU')} ₽/мес
    </div>
  )}
</td>
                  <td style={{fontSize:12, color:'#888', position:'sticky', left:180, background:'#fff', zIndex:1}}>
                    {row.object?.name || '—'}
                  </td>
                  {MONTHS.map((_, monthIdx) => {
                    const payment = getPayment(row.tenant.id, monthIdx);
                    const cell = cellColor(payment);
                    const isCurrentMonth = monthIdx === new Date().getMonth() && year === new Date().getFullYear();
                    return (
                      <td key={monthIdx} style={{textAlign:'center', padding:'4px 2px'}}>
                        <div
                          onClick={() => openAddPayment(row.tenant, monthIdx)}
                          title={payment ? `${payment.amount ? parseFloat(payment.amount).toLocaleString('ru-RU') + ' ₽' : ''} ${payment.payment_method || ''} ${payment.comment || ''}`.trim() : 'Нажмите чтобы добавить оплату'}
                          style={{
                            background: cell.bg,
                            border: `1px solid ${isCurrentMonth ? '#534AB7' : cell.color}`,
                            borderRadius: 6,
                            padding: '4px 2px',
                            cursor: 'pointer',
                            fontSize: 11,
                            minHeight: 32,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}>
                          <div>{cell.label}</div>
                          {payment?.amount && (
                            <div style={{fontSize:9, color: cell.color, fontWeight:500}}>
                              {parseFloat(payment.amount).toLocaleString('ru-RU')}
                            </div>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div style={{display:'flex', alignItems:'center', gap:8, marginTop:12, justifyContent:'center'}}>
            <button onClick={() => setPage(1)} disabled={page === 1}
              style={{background:'#f4f4f8', border:'1px solid #ddd', borderRadius:6, padding:'5px 10px', cursor:'pointer', fontSize:13, opacity: page===1?0.4:1}}>«</button>
            <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1}
              style={{background:'#f4f4f8', border:'1px solid #ddd', borderRadius:6, padding:'5px 10px', cursor:'pointer', fontSize:13, opacity: page===1?0.4:1}}>‹</button>
            {Array.from({length: totalPages}, (_, i) => i+1).filter(p => Math.abs(p - page) <= 2).map(p => (
              <button key={p} onClick={() => setPage(p)}
                style={{background: p===page ? '#534AB7' : '#f4f4f8', color: p===page ? '#fff' : '#333',
                  border:'1px solid #ddd', borderRadius:6, padding:'5px 10px', cursor:'pointer', fontSize:13, fontWeight: p===page?600:400}}>
                {p}
              </button>
            ))}
            <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages}
              style={{background:'#f4f4f8', border:'1px solid #ddd', borderRadius:6, padding:'5px 10px', cursor:'pointer', fontSize:13, opacity: page===totalPages?0.4:1}}>›</button>
            <button onClick={() => setPage(totalPages)} disabled={page === totalPages}
              style={{background:'#f4f4f8', border:'1px solid #ddd', borderRadius:6, padding:'5px 10px', cursor:'pointer', fontSize:13, opacity: page===totalPages?0.4:1}}>»</button>
          </div>
        )}
        <div style={{fontSize:11, color:'#aaa', textAlign:'center', marginTop:6}}>
          Показано {((page-1)*PAGE_SIZE)+1}–{Math.min(page*PAGE_SIZE, filteredRows.length)} из {filteredRows.length} арендаторов
        </div>
      </>
      )}

      {/* РЕЖИМ 2 — Детальный список */}
      {mode === 'list' && (
        <table>
          <thead>
            <tr>
              <th>Арендатор</th>
              <th>Период</th>
              <th style={{textAlign:'right'}}>Сумма</th>
              <th>Дата оплаты</th>
              <th>Способ</th>
              <th>Статус</th>
              <th>Комментарий</th>
              <th style={{width:40}}></th>
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 && (
              <tr><td colSpan={8} style={{textAlign:'center', color:'#aaa', padding:30}}>Нет платежей за {year} год</td></tr>
            )}
            {payments.map(p => {
              const tenant = tenants.find(t => t.id === p.tenant_id);
              return (
                <tr key={p.id}>
                  <td style={{cursor:'pointer', color:'#534AB7'}} onClick={() => onNavigate('tenants', p.tenant_id)}>
                    {tenant?.name || '—'}
                  </td>
                  <td style={{fontSize:12}}>{MONTHS_FULL[p.period_month - 1]} {p.period_year}</td>
                  <td style={{textAlign:'right', fontWeight:500}}>{p.amount ? parseFloat(p.amount).toLocaleString('ru-RU') + ' ₽' : '—'}</td>
                  <td style={{fontSize:12}}>{p.payment_date ? new Date(p.payment_date).toLocaleDateString('ru-RU') : '—'}</td>
                  <td style={{fontSize:12}}>{p.payment_method || '—'}</td>
                  <td>
                    <span style={{
                      background: p.status === 'Оплачено' ? '#EAF3DE' : p.status === 'Частично' ? '#FFF8E1' : '#FCEBEB',
                      color: p.status === 'Оплачено' ? '#3B6D11' : p.status === 'Частично' ? '#f0a500' : '#A32D2D',
                      borderRadius: 6, padding: '2px 8px', fontSize: 12
                    }}>{p.status}</span>
                  </td>
                  <td style={{fontSize:12, color:'#888'}}>{p.comment || '—'}</td>
                  <td>
                    <button onClick={() => deletePayment(p.id)}
                      style={{background:'#FCEBEB', color:'#A32D2D', border:'none', borderRadius:6, padding:'4px 8px', cursor:'pointer', fontSize:12}}>✕</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* Форма добавления оплаты */}
      {showPaymentForm && (
        <div className="modal-overlay" onClick={() => setShowPaymentForm(false)}>
          <div className="modal" style={{maxWidth:420}} onClick={e => e.stopPropagation()}>
            <div className="modal-title">
              {paymentForm.existing_id ? 'Редактировать оплату' : 'Добавить оплату'}
              <button className="modal-close" onClick={() => setShowPaymentForm(false)}>✕</button>
            </div>

            {!paymentForm.tenant_id && (
              <div className="form-group"><label>Арендатор *</label>
                <select value={paymentForm.tenant_id || ''} onChange={e => setPaymentForm({...paymentForm, tenant_id: e.target.value})}>
                  <option value="">— Выберите —</option>
                  {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            )}
            {paymentForm.tenant_name && (
              <div style={{fontWeight:500, fontSize:14, marginBottom:12, color:'#534AB7'}}>{paymentForm.tenant_name}</div>
            )}

            <div className="form-grid">
              <div className="form-group"><label>Месяц</label>
                <select value={paymentForm.period_month || ''} onChange={e => setPaymentForm({...paymentForm, period_month: parseInt(e.target.value)})}>
                  {MONTHS_FULL.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
                </select>
              </div>
              <div className="form-group"><label>Год</label>
                <input type="number" value={paymentForm.period_year || year} onChange={e => setPaymentForm({...paymentForm, period_year: parseInt(e.target.value)})} />
              </div>
            </div>

            <div className="form-grid">
              <div className="form-group"><label>Сумма ₽</label>
                <input type="number" value={paymentForm.amount || ''} onChange={e => setPaymentForm({...paymentForm, amount: e.target.value})} placeholder="0" />
              </div>
              <div className="form-group"><label>Дата оплаты</label>
                <input type="date" value={paymentForm.payment_date || ''} onChange={e => setPaymentForm({...paymentForm, payment_date: e.target.value})} />
              </div>
            </div>

            <div className="form-grid">
              <div className="form-group"><label>Способ оплаты</label>
                <select value={paymentForm.payment_method || 'Безнал'} onChange={e => setPaymentForm({...paymentForm, payment_method: e.target.value})}>
                  <option>Безнал</option>
                  <option>Наличные</option>
                  <option>Смешанный</option>
                </select>
              </div>
              <div className="form-group"><label>Статус</label>
                <select value={paymentForm.status || 'Оплачено'} onChange={e => setPaymentForm({...paymentForm, status: e.target.value})}>
                  <option>Оплачено</option>
                  <option>Частично</option>
                  <option>Не оплачено</option>
                </select>
              </div>
            </div>

            <div className="form-group"><label>Комментарий</label>
              <textarea rows={2} value={paymentForm.comment || ''} onChange={e => setPaymentForm({...paymentForm, comment: e.target.value})} placeholder="Необязательно..." />
            </div>

            <div className="form-actions">
              <button className="btn-cancel" onClick={() => setShowPaymentForm(false)}>Отмена</button>
              <button className="btn-save" onClick={savePayment} disabled={saving}>
                {saving ? 'Сохраняется...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
