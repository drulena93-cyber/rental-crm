import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { saveAs } from 'file-saver';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';

function numberToWords(num) {
  const n = parseInt(num);
  if (!n) return '';
  const ones = ['','один','два','три','четыре','пять','шесть','семь','восемь','девять',
    'десять','одиннадцать','двенадцать','тринадцать','четырнадцать','пятнадцать',
    'шестнадцать','семнадцать','восемнадцать','девятнадцать'];
  const tens = ['','','двадцать','тридцать','сорок','пятьдесят','шестьдесят','семьдесят','восемьдесят','девяносто'];
  const hundreds = ['','сто','двести','триста','четыреста','пятьсот','шестьсот','семьсот','восемьсот','девятьсот'];
  const thousands = ['','одна тысяча','две тысячи','три тысячи','четыре тысячи',
    'пять тысяч','шесть тысяч','семь тысяч','восемь тысяч','девять тысяч'];
  if (n < 20) return ones[n] + ' рублей 00 коп.';
  let result = '';
  const th = Math.floor(n / 1000);
  const rem = n % 1000;
  if (th > 0 && th < 10) result += thousands[th] + ' ';
  else if (th >= 10) result += th + ' тысяч ';
  const h = Math.floor(rem / 100);
  const t = Math.floor((rem % 100) / 10);
  const o = rem % 10;
  if (h > 0) result += hundreds[h] + ' ';
  if (t === 1) result += ones[10 + o] + ' ';
  else { if (t > 1) result += tens[t] + ' '; if (o > 0) result += ones[o] + ' '; }
  return result.trim() + ' рублей 00 коп.';
}

function formatDateRu(dateStr) {
  if (!dateStr) return '___';
  const months = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
  const d = new Date(dateStr);
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} г.`;
}

const emptyItem = () => ({ наименование: '', количество: 1, единица: 'шт', цена: '', сумма: '' });

export default function InvoiceGeneration({ onNavigate, initialData }) {
  const [tenants, setTenants] = useState([]);
  const [objects, setObjects] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, name: '' });
  const [selectedTenants, setSelectedTenants] = useState([]);
  const [filterInvoice, setFilterInvoice] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedOrg, setSelectedOrg] = useState('');
  const [selectedInvoiceTemplate, setSelectedInvoiceTemplate] = useState('');
  const [selectedActTemplate, setSelectedActTemplate] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [позиции, setПозиции] = useState([emptyItem()]);
  const [результаты, setРезультаты] = useState([]);
  const [itemTemplates, setItemTemplates] = useState([]);
  const [showItemTemplates, setShowItemTemplates] = useState(false);
  // ── Новый state: какие арендаторы уже получили документы за текущий месяц ──
  const [tenantDocStatus, setTenantDocStatus] = useState({}); // { tenantId: ['Счёт', 'Акт'] }

  useEffect(() => { fetchAll(); }, []);

  useEffect(() => {
    if (initialData) {
      if (initialData.позиции) setПозиции(initialData.позиции);
      if (initialData.tenantId) setSelectedTenants([initialData.tenantId]);
    }
  }, [initialData]);

  async function fetchAll() {
    setLoading(true);
    const { data: tens } = await supabase.from('tenants').select('*').is('deleted_at', null).order('name');
    const { data: objs } = await supabase.from('objects').select('*').is('deleted_at', null);
    const { data: orgs } = await supabase.from('organizations').select('*').order('name');

    try {
      const res = await fetch('/api/yandex-templates');
      const data = await res.json();
      setTemplates(data.items || []);
    } catch(e) { setTemplates([]); }

    try {
      const defRes = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: `SELECT id, value FROM settings WHERE id IN ('default_invoice_template', 'default_act_template')`, params: [] })
      });
      const defData = await defRes.json();
      const defRows = defData.rows || [];
      const defInvoice = defRows.find(r => r.id === 'default_invoice_template')?.value || '';
      const defAct = defRows.find(r => r.id === 'default_act_template')?.value || '';
      if (defInvoice) setSelectedInvoiceTemplate(defInvoice);
      if (defAct) setSelectedActTemplate(defAct);
    } catch(e) {}

    try {
      const itRes = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: `SELECT * FROM invoice_items_templates ORDER BY created_at`, params: [] })
      });
      const itData = await itRes.json();
      setItemTemplates(itData.rows || []);
    } catch(e) {}

    // ── Загружаем статусы документов за текущий месяц ──────────────────────
    try {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const docStatusRes = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `SELECT tenant_id, type FROM documents WHERE created_at >= $1 AND type IN ('Счёт','Акт')`,
          params: [monthStart]
        })
      });
      const docStatusData = await docStatusRes.json();
      const statusMap = {};
      for (const row of docStatusData.rows || []) {
        if (!statusMap[row.tenant_id]) statusMap[row.tenant_id] = new Set();
        statusMap[row.tenant_id].add(row.type);
      }
      // Конвертируем Set в массив
      const finalMap = {};
      for (const [id, types] of Object.entries(statusMap)) {
        finalMap[id] = [...types];
      }
      setTenantDocStatus(finalMap);
    } catch(e) {}

    // ── Загружаем результаты за последние 7 дней ───────────────────────────
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const recentRes = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `SELECT d.id, d.tenant_id, d.name, d.type, d.amount, d.yandex_path, d.created_at, t.name as tenant_name
                  FROM documents d
                  LEFT JOIN tenants t ON t.id = d.tenant_id
                  WHERE d.created_at >= $1 AND d.type IN ('Счёт','Акт')
                  ORDER BY d.created_at DESC`,
          params: [sevenDaysAgo]
        })
      });
      const recentData = await recentRes.json();
      const loaded = (recentData.rows || []).map(row => ({
        tenantId: row.tenant_id,
        tenant: row.tenant_name || '—',
        type: row.type,
        status: '✅',
        name: row.name,
        docId: row.id,
        yandexPath: row.yandex_path,
        amount: row.amount ? parseFloat(row.amount) : null,
        createdAt: row.created_at,
      }));
      setРезультаты(loaded);
    } catch(e) {}

    setTenants(tens || []);
    setObjects(objs || []);
    setOrganizations(orgs || []);
    const defOrg = orgs?.find(o => o.is_default);
    if (defOrg) setSelectedOrg(defOrg.id);
    setLoading(false);
  }

  const getObject = (id) => objects.find(o => o.id === id);

  const filteredTenants = tenants.filter(t => {
    if (t.status !== 'Активный') return false;
    if (filterInvoice && !t.in_invoice) return false;
    if (search && !t.name?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  function toggleTenant(id) {
    setSelectedTenants(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  }

  function toggleAll() {
    if (selectedTenants.length === filteredTenants.length) {
      setSelectedTenants([]);
    } else {
      setSelectedTenants(filteredTenants.map(t => t.id));
    }
  }

  function updateItem(idx, field, value) {
    const items = [...позиции];
    items[idx] = { ...items[idx], [field]: value };
    if (field === 'цена' || field === 'количество') {
      const цена = parseFloat(field === 'цена' ? value : items[idx].цена) || 0;
      const кол = parseFloat(field === 'количество' ? value : items[idx].количество) || 0;
      items[idx].сумма = (цена * кол).toFixed(2);
    }
    setПозиции(items);
  }

  const итого = позиции.reduce((sum, p) => sum + (parseFloat(p.сумма) || 0), 0);

  async function uploadToYandex(filedata, filename, folder) {
    const res = await fetch('/api/upload-to-yandex', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename, filedata, folder })
    });
    return await res.json();
  }

  async function deleteResult(resultItem) {
    if (!window.confirm('Удалить документ из карточки и Яндекс Диска?')) return;
    try {
      if (resultItem.yandexPath) {
        await fetch('/api/yandex-templates', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: resultItem.yandexPath })
        });
      }
      await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: `DELETE FROM documents WHERE id = $1`, params: [resultItem.docId] })
      });
      setРезультаты(prev => prev.filter(r => r.docId !== resultItem.docId));
      // Обновляем статус арендатора в списке
      setTenantDocStatus(prev => {
        const updated = { ...prev };
        // Проверяем остались ли ещё документы этого типа у арендатора
        const stillHas = результаты.some(r =>
          r.docId !== resultItem.docId &&
          r.tenantId === resultItem.tenantId &&
          r.type === resultItem.type
        );
        if (!stillHas && updated[resultItem.tenantId]) {
          updated[resultItem.tenantId] = updated[resultItem.tenantId].filter(t => t !== resultItem.type);
          if (updated[resultItem.tenantId].length === 0) delete updated[resultItem.tenantId];
        }
        return updated;
      });
    } catch(e) {
      alert('Ошибка удаления: ' + e.message);
    }
  }

  async function generateForTenant(tenant, type) {
    const org = organizations.find(o => o.id === selectedOrg);
    const templatePath = type === 'invoice' ? selectedInvoiceTemplate : selectedActTemplate;
    const tmpl = templates.find(t => t.path === templatePath);
    if (!tmpl?.public_url) throw new Error('Нет шаблона');

    const dlRes = await fetch('/api/download-template', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ public_url: tmpl.public_url })
    });
    const dlData = await dlRes.json();
    if (!dlData.success) throw new Error('Ошибка скачивания шаблона');

    const binary = atob(dlData.filedata);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const arrayBuffer = bytes.buffer;

    const counterKey = type === 'invoice' ? 'last_number_счет' : 'last_number_акт';
    const numRes = await fetch('/api/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `SELECT value FROM settings WHERE id = $1`, params: [counterKey] })
    });
    const numData = await numRes.json();
    const nextNum = (parseInt(numData.rows?.[0]?.value) || 0) + 1;

    const zip = new PizZip(arrayBuffer);
    const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

    const docData = type === 'invoice' ? {
      номер_счета: String(nextNum),
      дата_счета: formatDateRu(date),
      арендодатель_название: org?.full_name || org?.name || '',
      арендодатель_инн: org?.inn || '',
      арендодатель_кпп: org?.kpp || '',
      арендодатель_адрес: org?.address_legal || '',
      арендодатель_банк: org?.bank || '',
      арендодатель_бик: org?.bik || '',
      арендодатель_рс: org?.bank_account || '',
      арендодатель_кс: org?.corr_account || '',
      арендатор_название: tenant.name || '',
      арендатор_инн: tenant.inn || '',
      арендатор_кпп: tenant.kpp || '',
      позиции: позиции.map((p, i) => ({
        номер_позиции: String(i + 1),
        наименование: p.наименование,
        количество: String(p.количество),
        единица: p.единица,
        цена: parseFloat(p.цена).toLocaleString('ru-RU', {minimumFractionDigits: 2}),
        сумма: parseFloat(p.сумма).toLocaleString('ru-RU', {minimumFractionDigits: 2}),
      })),
      итого: итого.toLocaleString('ru-RU', {minimumFractionDigits: 2}),
      итого_прописью: numberToWords(итого),
      количество_позиций: String(позиции.length),
    } : {
      номер_акта: String(nextNum),
      дата_акта: formatDateRu(date),
      арендодатель_название: org?.full_name || org?.name || '',
      арендатор_название: tenant.name || '',
      позиции: позиции.map((p, i) => ({
        номер_позиции: String(i + 1),
        наименование: p.наименование,
        количество: String(p.количество),
        единица: p.единица,
        цена: parseFloat(p.цена).toLocaleString('ru-RU', {minimumFractionDigits: 2}),
        сумма: parseFloat(p.сумма).toLocaleString('ru-RU', {minimumFractionDigits: 2}),
      })),
      итого: итого.toLocaleString('ru-RU', {minimumFractionDigits: 2}),
      итого_прописью: numberToWords(итого),
      количество_позиций: String(позиции.length),
    };

    doc.render(docData);
    const blob = doc.getZip().generate({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });

    const docName = type === 'invoice'
      ? `Счёт №${nextNum} от ${new Date(date).toLocaleDateString('ru-RU')} — ${tenant.name}`
      : `Акт №${nextNum} от ${new Date(date).toLocaleDateString('ru-RU')} — ${tenant.name}`;
    const docType = type === 'invoice' ? 'Счёт' : 'Акт';

    const base64 = await new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.readAsDataURL(blob);
    });

    const result = await uploadToYandex(base64, `${Date.now()}_${docName}.docx`, `Документы/${tenant.name}`);
    const desc = позиции.map(p => p.наименование).filter(Boolean).join(', ');
    const createdAt = new Date().toISOString();

    const insertRes = await fetch('/api/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `INSERT INTO documents (tenant_id, name, type, file_path, file_size, yandex_path, description, amount, items, created_at)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
        params: [tenant.id, docName, docType, result.public_url || '', blob.size,
                 result.path || '', desc, итого, JSON.stringify(позиции), createdAt]
      })
    });
    const insertData = await insertRes.json();
    const docId = insertData.rows?.[0]?.id || null;

    await fetch('/api/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `UPDATE settings SET value = $1 WHERE id = $2`, params: [String(nextNum), counterKey] })
    });

    saveAs(blob, `${docName}.docx`);
    return { name: docName, url: result.public_url, docId, yandexPath: result.path || '', amount: итого, createdAt };
  }

  async function generateAll(type) {
    if (!selectedOrg) return alert('Выберите организацию');
    if (selectedTenants.length === 0) return alert('Выберите арендаторов');
    if (позиции.some(p => !p.наименование)) return alert('Заполните наименование для всех позиций');
    if (type !== 'act' && !selectedInvoiceTemplate) return alert('Выберите шаблон счёта');
    if (type !== 'invoice' && !selectedActTemplate) return alert('Выберите шаблон акта');

    setGenerating(true);
    const newResults = [];
    const tenantsToProcess = tenants.filter(t => selectedTenants.includes(t.id));

    for (let i = 0; i < tenantsToProcess.length; i++) {
      const tenant = tenantsToProcess[i];
      setProgress({ current: i + 1, total: tenantsToProcess.length, name: tenant.name });

      try {
        if (type === 'both' || type === 'invoice') {
          const r = await generateForTenant(tenant, 'invoice');
          newResults.push({
            tenantId: tenant.id, tenant: tenant.name, type: 'Счёт', status: '✅',
            name: r.name, docId: r.docId, yandexPath: r.yandexPath, amount: r.amount, createdAt: r.createdAt,
          });
          // Обновляем статус в списке арендаторов
          setTenantDocStatus(prev => ({
            ...prev,
            [tenant.id]: [...new Set([...(prev[tenant.id] || []), 'Счёт'])]
          }));
        }
        if (type === 'both' || type === 'act') {
          const r = await generateForTenant(tenant, 'act');
          newResults.push({
            tenantId: tenant.id, tenant: tenant.name, type: 'Акт', status: '✅',
            name: r.name, docId: r.docId, yandexPath: r.yandexPath, amount: r.amount, createdAt: r.createdAt,
          });
          setTenantDocStatus(prev => ({
            ...prev,
            [tenant.id]: [...new Set([...(prev[tenant.id] || []), 'Акт'])]
          }));
        }
      } catch(e) {
        newResults.push({ tenant: tenant.name, type, status: '❌', name: e.message, docId: null });
      }
    }

    // Добавляем новые результаты в начало списка (не заменяем!)
    setРезультаты(prev => [...newResults, ...prev]);
    setProgress({ current: 0, total: 0, name: '' });
    setGenerating(false);
  }

  return (
    <div>
      <div className="stats">
        <div className="stat"><div className="stat-label">Активных арендаторов</div><div className="stat-val purple">{tenants.length}</div></div>
        <div className="stat"><div className="stat-label">В счёт</div><div className="stat-val green">{tenants.filter(t => t.in_invoice).length}</div></div>
        <div className="stat"><div className="stat-label">Выбрано</div><div className="stat-val blue">{selectedTenants.length}</div></div>
        <div className="stat"><div className="stat-label">Итого к генерации</div><div className="stat-val">{итого.toLocaleString('ru-RU', {minimumFractionDigits:2})} ₽</div></div>
      </div>

      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16}}>

        <div>
          <div style={{fontWeight:500, fontSize:14, marginBottom:12}}>👥 Арендаторы</div>
          <div style={{display:'flex', gap:8, marginBottom:8, flexWrap:'wrap'}}>
            <input placeholder="Поиск..." value={search} onChange={e => setSearch(e.target.value)}
              style={{flex:1, padding:'6px 10px', borderRadius:6, border:'1px solid #ddd', fontSize:13}} />
            <label style={{display:'flex', alignItems:'center', gap:6, fontSize:13, cursor:'pointer'}}>
              <input type="checkbox" checked={filterInvoice} onChange={e => setFilterInvoice(e.target.checked)} />
              Только "В счёт"
            </label>
          </div>
          <div style={{background:'#fff', border:'1px solid #e5e5e5', borderRadius:8, overflow:'hidden'}}>
            <div style={{padding:'8px 12px', background:'#f4f4f8', display:'flex', alignItems:'center', gap:8, fontSize:13, borderBottom:'1px solid #e5e5e5'}}>
              <input type="checkbox"
                checked={selectedTenants.length === filteredTenants.length && filteredTenants.length > 0}
                onChange={toggleAll} />
              <span style={{fontWeight:500}}>Выбрать всех ({filteredTenants.length})</span>
            </div>
            <div style={{maxHeight:400, overflowY:'auto'}}>
              {loading ? <div style={{padding:20, textAlign:'center', color:'#aaa'}}>Загрузка...</div> :
               filteredTenants.length === 0 ? <div style={{padding:20, textAlign:'center', color:'#aaa'}}>Нет арендаторов</div> :
               filteredTenants.map(t => {
                const obj = getObject(t.object_id);
                const docTypes = tenantDocStatus[t.id] || [];
                const isDone = docTypes.length > 0;
                return (
                  <div key={t.id} style={{
                    padding:'10px 12px', borderBottom:'1px solid #f0f0f0',
                    display:'flex', alignItems:'center', gap:8, cursor:'pointer',
                    background: selectedTenants.includes(t.id) ? '#f0f0ff' : isDone ? '#f0fff4' : '#fff'
                  }}
                    onClick={() => toggleTenant(t.id)}>
                    <input type="checkbox" checked={selectedTenants.includes(t.id)} onChange={() => {}} />
                    <div style={{flex:1}}>
                      <div style={{fontSize:13, fontWeight:500, display:'flex', alignItems:'center', gap:6}}>
                        {t.name}
                        {isDone && (
                          <span style={{fontSize:11, color:'#3B6D11', background:'#EAF3DE', borderRadius:4, padding:'1px 6px'}}>
                            ✅ {docTypes.join(', ')}
                          </span>
                        )}
                      </div>
                      {obj && <div style={{fontSize:11, color:'#888'}}>{obj.name} — {obj.rent?.toLocaleString('ru-RU')} ₽/мес</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div>
          <div style={{fontWeight:500, fontSize:14, marginBottom:12}}>⚙️ Настройки генерации</div>

          <div className="form-group"><label>Организация арендодателя</label>
            <select value={selectedOrg} onChange={e => setSelectedOrg(e.target.value)}>
              <option value="">— Выберите —</option>
              {organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>

          <div className="form-grid">
            <div className="form-group"><label>Дата документа</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group"><label>Шаблон счёта</label>
              <select value={selectedInvoiceTemplate} onChange={e => setSelectedInvoiceTemplate(e.target.value)}>
                <option value="">— Выберите —</option>
                {templates.map(t => <option key={t.name} value={t.path}>{t.name}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Шаблон акта</label>
              <select value={selectedActTemplate} onChange={e => setSelectedActTemplate(e.target.value)}>
                <option value="">— Выберите —</option>
                {templates.map(t => <option key={t.name} value={t.path}>{t.name}</option>)}
              </select>
            </div>
          </div>

          <div style={{fontWeight:500, fontSize:13, marginBottom:8}}>Позиции</div>
          <table style={{width:'100%', borderCollapse:'collapse', marginBottom:8}}>
            <thead>
              <tr style={{background:'#eee', fontSize:12}}>
                <th style={{padding:'4px 6px', textAlign:'left'}}>Наименование</th>
                <th style={{padding:'4px 6px', textAlign:'center', width:60}}>Кол-во</th>
                <th style={{padding:'4px 6px', textAlign:'center', width:45}}>Ед.</th>
                <th style={{padding:'4px 6px', textAlign:'right', width:90}}>Цена</th>
                <th style={{padding:'4px 6px', textAlign:'right', width:90}}>Сумма</th>
                <th style={{width:25}}></th>
              </tr>
            </thead>
            <tbody>
              {позиции.map((p, i) => (
                <tr key={i}>
                  <td style={{padding:'3px 2px'}}>
                    <input value={p.наименование} onChange={e => updateItem(i, 'наименование', e.target.value)}
                      placeholder="Аренда за июль 2026г."
                      style={{width:'100%', padding:'4px 6px', border:'1px solid #ddd', borderRadius:4, fontSize:12}} />
                  </td>
                  <td style={{padding:'3px 2px'}}>
                    <input type="number" value={p.количество} onChange={e => updateItem(i, 'количество', e.target.value)}
                      style={{width:'100%', padding:'4px 4px', border:'1px solid #ddd', borderRadius:4, fontSize:12, textAlign:'center'}} />
                  </td>
                  <td style={{padding:'3px 2px'}}>
                    <input value={p.единица} onChange={e => updateItem(i, 'единица', e.target.value)}
                      style={{width:'100%', padding:'4px 4px', border:'1px solid #ddd', borderRadius:4, fontSize:12, textAlign:'center'}} />
                  </td>
                  <td style={{padding:'3px 2px'}}>
                    <input type="number" value={p.цена} onChange={e => updateItem(i, 'цена', e.target.value)}
                      style={{width:'100%', padding:'4px 4px', border:'1px solid #ddd', borderRadius:4, fontSize:12, textAlign:'right'}} />
                  </td>
                  <td style={{padding:'4px 6px', fontSize:12, textAlign:'right', fontWeight:500}}>
                    {parseFloat(p.сумма) ? parseFloat(p.сумма).toLocaleString('ru-RU', {minimumFractionDigits:2}) : '—'}
                  </td>
                  <td style={{textAlign:'center'}}>
                    {позиции.length > 1 && (
                      <button onClick={() => setПозиции(позиции.filter((_, idx) => idx !== i))}
                        style={{background:'none', border:'none', color:'#A32D2D', cursor:'pointer', fontSize:13}}>✕</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{display:'flex', gap:8, marginBottom:8}}>
            <button onClick={() => setПозиции([...позиции, emptyItem()])}
              style={{background:'#f4f4f8', border:'1px solid #ddd', borderRadius:6, padding:'5px 12px', fontSize:12, cursor:'pointer'}}>
              + Добавить позицию
            </button>
            <button onClick={() => setShowItemTemplates(!showItemTemplates)}
              style={{background:'#f0f0ff', border:'1px solid #534AB7', borderRadius:6, padding:'5px 12px', fontSize:12, cursor:'pointer', color:'#534AB7'}}>
              📋 Из шаблона
            </button>
          </div>
          {showItemTemplates && itemTemplates.length > 0 && (
            <div style={{background:'#fff', border:'1px solid #e5e5e5', borderRadius:8, padding:8, marginBottom:8}}>
              <div style={{fontSize:12, color:'#888', marginBottom:6}}>Выберите позицию:</div>
              <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
                {itemTemplates.map(it => (
                  <button key={it.id} onClick={() => {
                    const newItems = [...позиции];
                    const lastEmpty = newItems.findIndex(p => !p.наименование);
                    const idx = lastEmpty >= 0 ? lastEmpty : newItems.length;
                    if (lastEmpty < 0) newItems.push(emptyItem());
                    newItems[idx] = {
                      наименование: it.name, количество: 1, единица: it.unit || 'шт',
                      цена: it.price ? String(it.price) : '', сумма: it.price ? String(it.price) : ''
                    };
                    setПозиции(newItems);
                    setShowItemTemplates(false);
                  }}
                    style={{background:'#f4f4f8', border:'1px solid #ddd', borderRadius:6, padding:'5px 10px', fontSize:12, cursor:'pointer', textAlign:'left'}}>
                    <div style={{fontWeight:500}}>{it.name}</div>
                    {it.price && <div style={{fontSize:11, color:'#888'}}>{parseFloat(it.price).toLocaleString('ru-RU')} ₽ / {it.unit || 'шт'}</div>}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div style={{textAlign:'right', fontSize:13, fontWeight:500, marginBottom:12}}>
            Итого: {итого.toLocaleString('ru-RU', {minimumFractionDigits:2})} руб.
            <div style={{fontSize:11, color:'#888', fontWeight:400}}>{numberToWords(итого)}</div>
          </div>

          {generating && progress.total > 0 && (
            <div style={{background:'#f0f0ff', border:'1px solid #534AB7', borderRadius:8, padding:12, marginBottom:12}}>
              <div style={{fontSize:13, marginBottom:6}}>
                ⏳ Обработка {progress.current} из {progress.total}: {progress.name}
              </div>
              <div style={{background:'#ddd', borderRadius:4, height:8}}>
                <div style={{background:'#534AB7', borderRadius:4, height:8, width:`${(progress.current/progress.total)*100}%`, transition:'width 0.3s'}} />
              </div>
            </div>
          )}

          <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
            <button className="btn-save" onClick={() => generateAll('invoice')} disabled={generating}>
              {generating ? '⏳...' : '⬇ Счета'}
            </button>
            <button style={{background:'#3B6D11', color:'#fff', border:'none', borderRadius:6, padding:'8px 14px', fontSize:13, cursor:'pointer'}}
              onClick={() => generateAll('act')} disabled={generating}>
              {generating ? '⏳...' : '⬇ Акты'}
            </button>
            <button style={{background:'#534AB7', color:'#fff', border:'none', borderRadius:6, padding:'8px 14px', fontSize:13, cursor:'pointer'}}
              onClick={() => generateAll('both')} disabled={generating}>
              {generating ? '⏳...' : '⬇ Счета + Акты'}
            </button>
          </div>
        </div>
      </div>

      {результаты.length > 0 && (
        <div style={{marginTop:24}}>
          <div style={{fontWeight:500, fontSize:14, marginBottom:12}}>
            📋 Результаты генерации
            <span style={{fontSize:12, color:'#888', fontWeight:400, marginLeft:8}}>за последние 7 дней</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Арендатор</th>
                <th>Тип</th>
                <th>Документ</th>
                <th style={{textAlign:'right'}}>Сумма</th>
                <th>Дата генерации</th>
                <th style={{textAlign:'center'}}>Статус</th>
                <th style={{width:40}}></th>
              </tr>
            </thead>
            <tbody>
              {результаты.map((r, i) => (
                <tr key={r.docId || i}>
                  <td>
                    {r.tenantId ? (
                      <span style={{color:'#534AB7', cursor:'pointer', textDecoration:'underline'}}
                        onClick={() => onNavigate('tenants', r.tenantId)}>
                        {r.tenant}
                      </span>
                    ) : r.tenant}
                  </td>
                  <td>{r.type}</td>
                  <td style={{fontSize:12}}>{r.name}</td>
                  <td style={{textAlign:'right', fontSize:12, fontWeight:500, whiteSpace:'nowrap'}}>
                    {r.amount != null ? r.amount.toLocaleString('ru-RU', {minimumFractionDigits:2}) + ' ₽' : '—'}
                  </td>
                  <td style={{fontSize:12, color:'#555', whiteSpace:'nowrap'}}>
                    {r.createdAt ? new Date(r.createdAt).toLocaleString('ru-RU', {
                      day:'2-digit', month:'2-digit', year:'numeric',
                      hour:'2-digit', minute:'2-digit'
                    }) : '—'}
                  </td>
                  <td style={{textAlign:'center'}}>{r.status}</td>
                  <td style={{textAlign:'center'}}>
                    {r.docId && (
                      <button onClick={() => deleteResult(r)}
                        title="Удалить документ из карточки и Яндекс Диска"
                        style={{background:'none', border:'none', color:'#A32D2D', cursor:'pointer', fontSize:16, lineHeight:1}}>
                        ✕
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
