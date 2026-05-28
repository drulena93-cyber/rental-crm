import React, { useState, useEffect, useRef } from 'react';
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

export default function Documents({ tenantId, tenantName, onClose }) {
  const [documents, setDocuments] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [docTypes, setDocTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [showContractForm, setShowContractForm] = useState(false);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [uploadForm, setUploadForm] = useState({ name: '', type: 'Договор' });
  const [contractForm, setContractForm] = useState({ номер_договора: '', дата_договора: '' });
  const [selectedOrg, setSelectedOrg] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [selectedInvoiceTemplate, setSelectedInvoiceTemplate] = useState('');
  const [selectedActTemplate, setSelectedActTemplate] = useState('');
  const [tenant, setTenant] = useState(null);
  const [invoiceForm, setInvoiceForm] = useState({ номер: '', дата: '', дата_акта: '', позиции: [emptyItem()] });
  const fileRef = useRef();

  useEffect(() => { fetchAll(); }, [tenantId]);

  async function fetchAll() {
    setLoading(true);
    const { data: docs } = await supabase.from('documents').select('*, items').eq('tenant_id', tenantId).order('created_at', { ascending: false });
    const { data: orgs } = await supabase.from('organizations').select('*').order('name');
    const { data: ten } = await supabase.from('tenants').select('*').eq('id', tenantId).single();
    setDocuments(docs || []);
    setOrganizations(orgs || []);
    setTenant(ten);
    const def = orgs?.find(o => o.is_default);
    if (def) setSelectedOrg(def.id);

    try {
      const res = await fetch('/api/yandex-templates');
      const data = await res.json();
      setTemplates(data.items || []);
    } catch(e) { setTemplates([]); }
// Загружаем шаблоны по умолчанию
try {
  const defRes = await fetch('/api/db', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: `SELECT id, value FROM settings WHERE id IN ('default_invoice_template', 'default_act_template', 'default_contract_template')`, params: [] })
  });
  const defData = await defRes.json();
  const defRows = defData.rows || [];
  const defInvoice = defRows.find(r => r.id === 'default_invoice_template')?.value || '';
  const defAct = defRows.find(r => r.id === 'default_act_template')?.value || '';
  const defContract = defRows.find(r => r.id === 'default_contract_template')?.value || '';
  if (defInvoice) setSelectedInvoiceTemplate(defInvoice);
  if (defAct) setSelectedActTemplate(defAct);
  if (defContract) setSelectedTemplate(defContract);
} catch(e) {}
    try {
      const dtRes = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: `SELECT name FROM document_types ORDER BY created_at`, params: [] })
      });
      const dtData = await dtRes.json();
      setDocTypes((dtData.rows || []).map(r => r.name));
    } catch(e) { setDocTypes(['Договор', 'Акт', 'Доверенность', 'Скан паспорта', 'Другое']); }

    const lastNumRes = await fetch('/api/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `SELECT value FROM settings WHERE id = 'last_number_договор'`, params: [] })
    });
    const lastNumData = await lastNumRes.json();
    const nextNum = (parseInt(lastNumData.rows?.[0]?.value) || 0) + 1;
    setContractForm({ номер_договора: String(nextNum), дата_договора: ten?.contract_start || '' });

    // Следующий номер счёта
    const invNumRes = await fetch('/api/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `SELECT value FROM settings WHERE id = 'last_number_счет'`, params: [] })
    });
    const invNumData = await invNumRes.json();
    const nextInvNum = (parseInt(invNumData.rows?.[0]?.value) || 0) + 1;
    setInvoiceForm(f => ({ ...f, номер: String(nextInvNum), дата: new Date().toISOString().split('T')[0] }));

    setLoading(false);
  }

  async function uploadToYandex(filedata, filename, folder) {
    const res = await fetch('/api/upload-to-yandex', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename, filedata, folder })
    });
    return await res.json();
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => { resolve(reader.result.split(',')[1]); };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function uploadFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (!uploadForm.name) return alert('Введите название документа');
    setUploading(true);
    try {
      const base64 = await fileToBase64(file);
      const safeName = `${Date.now()}_${file.name}`;
      const result = await uploadToYandex(base64, safeName, `Документы/${tenantName}`);
      if (!result.success) { alert('Ошибка загрузки: ' + result.error); setUploading(false); return; }
      await supabase.from('documents').insert({
  tenant_id: tenantId, name: uploadForm.name, type: uploadForm.type,
  file_path: result.public_url, file_size: file.size, yandex_path: result.path,
});
      setShowUploadForm(false);
      setUploadForm({ name: '', type: 'Договор' });
      fetchAll();
    } catch(e) { alert('Ошибка: ' + e.message); }
    setUploading(false);
  }

  async function deleteDoc(id) {
    if (!window.confirm('Удалить документ из CRM и Яндекс Диска?')) return;
    const doc = documents.find(d => d.id === id);
    if (doc?.yandex_path) {
      await fetch('/api/yandex-templates', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: doc.yandex_path })
      });
    }
    await supabase.from('documents').delete().eq('id', id);
    fetchAll();
  }

  // Обновляем сумму позиции при изменении цены/количества
  function updateItem(idx, field, value) {
    const items = [...invoiceForm.позиции];
    items[idx] = { ...items[idx], [field]: value };
    if (field === 'цена' || field === 'количество') {
      const цена = parseFloat(field === 'цена' ? value : items[idx].цена) || 0;
      const кол = parseFloat(field === 'количество' ? value : items[idx].количество) || 0;
      items[idx].сумма = (цена * кол).toFixed(2);
    }
    setInvoiceForm({ ...invoiceForm, позиции: items });
  }

  function addItem() {
    setInvoiceForm({ ...invoiceForm, позиции: [...invoiceForm.позиции, emptyItem()] });
  }

  function removeItem(idx) {
    if (invoiceForm.позиции.length === 1) return;
    setInvoiceForm({ ...invoiceForm, позиции: invoiceForm.позиции.filter((_, i) => i !== idx) });
  }

  async function generateFromTemplate(templatePath, docData, docName, docType, counterKey, description = '', amount = 0, items = null) {
    const tmpl = templates.find(t => t.path === templatePath);
    if (!tmpl?.public_url) return alert('Нет публичной ссылки на шаблон');
    const dlRes = await fetch('/api/download-template', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ public_url: tmpl.public_url })
    });
    const dlData = await dlRes.json();
    if (!dlData.success) return alert('Ошибка скачивания шаблона');
    const binary = atob(dlData.filedata);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const arrayBuffer = bytes.buffer;

    const zip = new PizZip(arrayBuffer);
    const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
    doc.render(docData);

    const blob = doc.getZip().generate({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });

    const base64 = await new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.readAsDataURL(blob);
    });

    const safeName = `${Date.now()}_${docName}.docx`;
    const result = await uploadToYandex(base64, safeName, `Документы/${tenantName}`);

    await fetch('/api/db', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: `INSERT INTO documents (tenant_id, name, type, file_path, file_size, yandex_path, description, amount, items) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    params: [tenantId, docName, docType, result.public_url || '', blob.size, result.path || '', description, amount, items ? JSON.stringify(items) : null]
  })
});

    if (counterKey) {
      await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: `UPDATE settings SET value = $1 WHERE id = $2`, params: [invoiceForm.номер, counterKey] })
      });
    }

    saveAs(blob, `${docName}.docx`);
    return blob;
  }

  async function generateContract() {
    if (!selectedTemplate) return alert('Выберите шаблон');
    if (!selectedOrg) return alert('Выберите организацию');
    setGenerating(true);
    try {
      const org = organizations.find(o => o.id === selectedOrg);
      const { data: objData } = await supabase.from('objects').select('*').eq('id', tenant?.object_id).single();
      const tmpl = templates.find(t => t.path === selectedTemplate);
      if (!tmpl?.public_url) return alert('Нет публичной ссылки на шаблон');
      const dlRes = await fetch('/api/download-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ public_url: tmpl.public_url })
      });
      const dlData = await dlRes.json();
      if (!dlData.success) return alert('Ошибка скачивания шаблона');
      const binary = atob(dlData.filedata);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const arrayBuffer = bytes.buffer;
      const zip = new PizZip(arrayBuffer);
      const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
      doc.render({
        номер_договора: contractForm.номер_договора || '___',
        дата_договора: formatDateRu(contractForm.дата_договора),
        арендодатель_название: org?.full_name || org?.name || '',
        арендодатель_директор: org?.director_rod || org?.director || '',
        арендодатель_основание: org?.basis || '',
        арендодатель_адрес: org?.address_legal || '',
        арендодатель_инн: org?.inn || '',
        арендодатель_огрн: org?.ogrn || '',
        арендодатель_кпп: org?.kpp || '',
        арендодатель_бик: org?.bik || '',
        арендодатель_банк: org?.bank || '',
        арендодатель_рс: org?.bank_account || '',
        арендодатель_кс: org?.corr_account || '',
        арендатор_название: tenant?.name || '',
        арендатор_директор: tenant?.type === 'ФИЗ.ЛИЦО' ? (tenant?.name_rod || tenant?.name || '') : (tenant?.director_rod || tenant?.director || ''),
        арендатор_основание: tenant?.type === 'ФИЗ.ЛИЦО' ? 'паспорта' : (tenant?.basis || 'Устава'),
        арендатор_адрес: tenant?.type === 'ФИЗ.ЛИЦО' ? (tenant?.address || tenant?.passport || '') : (tenant?.address_legal || ''),
        арендатор_инн: tenant?.inn || '',
        арендатор_огрн: tenant?.ogrn || '',
        арендатор_кпп: tenant?.kpp || '',
        арендатор_бик: tenant?.bik || '',
        арендатор_банк: tenant?.bank || '',
        арендатор_рс: tenant?.bank_account || '',
        арендатор_кс: tenant?.corr_account || '',
        арендатор_паспорт: tenant?.passport || '',
        арендатор_прописка: tenant?.address || '',
        объект_название: objData?.name || '',
        объект_площадь: objData?.area || '',
        объект_стоимость: objData?.rent ? objData.rent.toLocaleString('ru-RU') : '',
        объект_стоимость_прописью: numberToWords(objData?.rent || 0),
        объект_этаж: objData?.floor || '',
        объект_адрес: objData?.address || '',
        арендодатель_директор_краткий: org?.director_rod || org?.director || '',
        арендатор_директор_им: tenant?.director || tenant?.name || '',
      });
      const blob = doc.getZip().generate({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      const filename = `Договор_${tenant?.name}_${contractForm.номер_договора || 'б-н'}`;
      const base64 = await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result.split(',')[1]); reader.readAsDataURL(blob); });
      const result = await uploadToYandex(base64, `${Date.now()}_${filename}.docx`, `Документы/${tenantName}`);
      await supabase.from('documents').insert({
        tenant_id: tenantId,
        name: `Договор №${contractForm.номер_договора || 'б-н'} от ${contractForm.дата_договора ? new Date(contractForm.дата_договора).toLocaleDateString('ru-RU') : '___'}`,
        type: 'Договор', file_path: result.public_url || '', file_size: blob.size, yandex_path: result.path || '',
      });
      await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: `UPDATE settings SET value = $1 WHERE id = 'last_number_договор'`, params: [contractForm.номер_договора] })
      });
      if (contractForm.дата_договора) {
        const startDate = new Date(contractForm.дата_договора);
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + 11);
        await supabase.from('tenants').update({ contract_start: contractForm.дата_договора, contract_end: endDate.toISOString().split('T')[0] }).eq('id', tenantId);
      }
      saveAs(blob, `${filename}.docx`);
      setShowContractForm(false);
      fetchAll();
    } catch(e) { console.error(e); alert('Ошибка: ' + e.message); }
    setGenerating(false);
  }

  async function generateInvoice() {
    if (!selectedInvoiceTemplate) return alert('Выберите шаблон счёта');
    if (!selectedOrg) return alert('Выберите организацию');
    if (invoiceForm.позиции.some(p => !p.наименование)) return alert('Заполните наименование для всех позиций');
    setGenerating(true);
    try {
      const org = organizations.find(o => o.id === selectedOrg);
      const итого = invoiceForm.позиции.reduce((sum, p) => sum + (parseFloat(p.сумма) || 0), 0);
      const docData = {
        номер_счета: invoiceForm.номер || '___',
        дата_счета: formatDateRu(invoiceForm.дата),
        арендодатель_название: org?.full_name || org?.name || '',
        арендодатель_инн: org?.inn || '',
        арендодатель_кпп: org?.kpp || '',
        арендодатель_адрес: org?.address_legal || '',
        арендодатель_банк: org?.bank || '',
        арендодатель_бик: org?.bik || '',
        арендодатель_рс: org?.bank_account || '',
        арендодатель_кс: org?.corr_account || '',
        арендатор_название: tenant?.name || '',
        арендатор_инн: tenant?.inn || '',
        арендатор_кпп: tenant?.kpp || '',
        позиции: invoiceForm.позиции.map((p, i) => ({
          номер_позиции: String(i + 1),
          наименование: p.наименование,
          количество: String(p.количество),
          единица: p.единица,
          цена: parseFloat(p.цена).toLocaleString('ru-RU', {minimumFractionDigits: 2}),
          сумма: parseFloat(p.сумма).toLocaleString('ru-RU', {minimumFractionDigits: 2}),
        })),
        итого: итого.toLocaleString('ru-RU', {minimumFractionDigits: 2}),
        итого_прописью: numberToWords(итого),
        количество_позиций: String(invoiceForm.позиции.length),
      };
      const docName = `Счёт №${invoiceForm.номер} от ${invoiceForm.дата ? new Date(invoiceForm.дата).toLocaleDateString('ru-RU') : '___'}`;
      const desc = invoiceForm.позиции.map(p => p.наименование).filter(Boolean).join(', '); await generateFromTemplate(selectedInvoiceTemplate, docData, docName, 'Счёт', 'last_number_счет', desc, итого, invoiceForm.позиции);
      fetchAll();
      setShowInvoiceForm(false);
    } catch(e) { console.error(e); alert('Ошибка: ' + e.message); }
    setGenerating(false);
  }

  async function generateAct() {
    if (!selectedActTemplate) return alert('Выберите шаблон акта');
    if (!selectedOrg) return alert('Выберите организацию');
    if (invoiceForm.позиции.some(p => !p.наименование)) return alert('Заполните наименование для всех позиций');
    setGenerating(true);
    try {
      const org = organizations.find(o => o.id === selectedOrg);
      const итого = invoiceForm.позиции.reduce((sum, p) => sum + (parseFloat(p.сумма) || 0), 0);

      // Следующий номер акта
      const actNumRes = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: `SELECT value FROM settings WHERE id = 'last_number_акт'`, params: [] })
      });
      const actNumData = await actNumRes.json();
      const actNum = (parseInt(actNumData.rows?.[0]?.value) || 0) + 1;

      const docData = {
        номер_акта: String(actNum),
        дата_акта: formatDateRu(invoiceForm.дата_акта || invoiceForm.дата),
        арендодатель_название: org?.full_name || org?.name || '',
        арендатор_название: tenant?.name || '',
        позиции: invoiceForm.позиции.map((p, i) => ({
          номер_позиции: String(i + 1),
          наименование: p.наименование,
          количество: String(p.количество),
          единица: p.единица,
          цена: parseFloat(p.цена).toLocaleString('ru-RU', {minimumFractionDigits: 2}),
          сумма: parseFloat(p.сумма).toLocaleString('ru-RU', {minimumFractionDigits: 2}),
        })),
        итого: итого.toLocaleString('ru-RU', {minimumFractionDigits: 2}),
        итого_прописью: numberToWords(итого),
        количество_позиций: String(invoiceForm.позиции.length),
      };
      const docName = `Акт №${actNum} от ${invoiceForm.дата ? new Date(invoiceForm.дата).toLocaleDateString('ru-RU') : '___'}`;
      const desc = invoiceForm.позиции.map(p => p.наименование).filter(Boolean).join(', ');
      await generateFromTemplate(selectedActTemplate, docData, docName, 'Акт', null, desc, итого);

      // Обновляем счётчик акта
      await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: `UPDATE settings SET value = $1 WHERE id = 'last_number_акт'`, params: [String(actNum)] })
      });

      fetchAll();
    } catch(e) { console.error(e); alert('Ошибка: ' + e.message); }
    setGenerating(false);
  }

  function formatSize(bytes) {
    if (!bytes) return '—';
    if (bytes < 1024) return bytes + ' Б';
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' КБ';
    return (bytes / 1024 / 1024).toFixed(1) + ' МБ';
  }

  function typeBadge(type) {
    const colors = { 'Договор': 'badge-blue', 'Акт': 'badge-green', 'Доверенность': 'badge-amber', 'Скан паспорта': 'badge-gray', 'Счёт': 'badge-purple', 'Другое': 'badge-gray' };
    return <span className={`badge ${colors[type] || 'badge-gray'}`}>{type}</span>;
  }

  const итого = invoiceForm.позиции.reduce((sum, p) => sum + (parseFloat(p.сумма) || 0), 0);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{width: 700}} onClick={e => e.stopPropagation()}>
        <div className="modal-title">
          📄 Документы — {tenantName}
          <button className="modal-close" onClick={onClose}>✕ Закрыть</button>
        </div>

        <div style={{display:'flex', gap:8, marginBottom:16, flexWrap:'wrap'}}>
          <button className="btn-add" onClick={() => setShowUploadForm(true)}>📎 Прикрепить</button>
          <button style={{background:'#3B6D11', color:'#fff', border:'none', borderRadius:6, padding:'7px 14px', fontSize:13, cursor:'pointer'}}
            onClick={() => { setShowContractForm(true); setShowInvoiceForm(false); }}>✨ Договор</button>
          <button style={{background:'#534AB7', color:'#fff', border:'none', borderRadius:6, padding:'7px 14px', fontSize:13, cursor:'pointer'}}
            onClick={() => { setShowInvoiceForm(true); setShowContractForm(false); }}>🧾 Счёт и Акт</button>
        </div>

        {loading ? <p>Загрузка...</p> : documents.length === 0 ? (
          <div style={{textAlign:'center', color:'#aaa', padding:30, fontSize:13}}>Документы не прикреплены</div>
        ) : (
          <table>
            <thead>
              <tr><th>Название</th><th>Тип</th><th>Размер</th><th>Дата</th><th style={{width:140}}>Действия</th></tr>
            </thead>
            <tbody>
              {documents.map(doc => (
                <tr key={doc.id}>
                  <td>📄 {doc.name}</td>
                  <td>{typeBadge(doc.type)}</td>
                  <td>{formatSize(doc.file_size)}</td>
                  <td style={{fontSize:12, color:'#888'}}>{new Date(doc.created_at).toLocaleDateString('ru-RU')}</td>
                  <td>
                    {doc.file_path && (
                      <a href={doc.file_path} target="_blank" rel="noreferrer"
                        style={{background:'#EAF3DE', color:'#3B6D11', border:'none', borderRadius:6, padding:'4px 8px', cursor:'pointer', fontSize:12, marginRight:4, textDecoration:'none'}}>
                        🔗 Открыть
                      </a>
                    )}
                    {doc.type === 'Счёт' && doc.items && (
  <button onClick={() => {
    const items = typeof doc.items === 'string' ? JSON.parse(doc.items) : doc.items;
    setInvoiceForm({ номер: invoiceForm.номер, дата: new Date().toISOString().split('T')[0], позиции: items });
    setShowInvoiceForm(true);
    setShowContractForm(false);
  }}
    style={{background:'#EAF3DE', color:'#3B6D11', border:'none', borderRadius:6, padding:'4px 8px', cursor:'pointer', fontSize:12, marginRight:4}}>
    📋 Акт
  </button>
)}
<button onClick={() => deleteDoc(doc.id)}
  style={{background:'#FCEBEB', color:'#A32D2D', border:'none', borderRadius:6, padding:'4px 8px', cursor:'pointer', fontSize:12}}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {showUploadForm && (
          <div style={{marginTop:16, padding:16, background:'#f8f8f8', borderRadius:8}}>
            <div style={{fontWeight:500, marginBottom:12}}>Прикрепить документ</div>
            <div className="form-grid">
              <div className="form-group"><label>Название *</label>
                <input value={uploadForm.name} onChange={e => setUploadForm({...uploadForm, name: e.target.value})} placeholder="Например: Договор №42" />
              </div>
              <div className="form-group"><label>Тип</label>
                <select value={uploadForm.type} onChange={e => setUploadForm({...uploadForm, type: e.target.value})}>
                  {docTypes.map(dt => <option key={dt}>{dt}</option>)}
                </select>
              </div>
            </div>
            <div style={{display:'flex', gap:8}}>
              <button className="btn-save" onClick={() => fileRef.current.click()} disabled={uploading}>
                {uploading ? 'Загружается...' : '📎 Выбрать файл'}
              </button>
              <button className="btn-cancel" onClick={() => setShowUploadForm(false)}>Отмена</button>
            </div>
            <input ref={fileRef} type="file" style={{display:'none'}} onChange={uploadFile} />
          </div>
        )}

        {showContractForm && (
          <div style={{marginTop:16, padding:16, background:'#f8f8f8', borderRadius:8}}>
            <div style={{fontWeight:500, marginBottom:12}}>✨ Сформировать договор</div>
            <div className="form-group"><label>Организация арендодателя</label>
              <select value={selectedOrg} onChange={e => setSelectedOrg(e.target.value)}>
                <option value="">— Выберите —</option>
                {organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Шаблон</label>
              <select value={selectedTemplate} onChange={e => setSelectedTemplate(e.target.value)}>
                <option value="">— Выберите шаблон —</option>
                {templates.map(t => <option key={t.name} value={t.path}>{t.name}</option>)}
              </select>
            </div>
            <div className="form-grid">
              <div className="form-group"><label>Номер договора</label>
                <input value={contractForm.номер_договора} onChange={e => setContractForm({...contractForm, номер_договора: e.target.value})} />
              </div>
              <div className="form-group"><label>Дата договора</label>
                <input type="date" value={contractForm.дата_договора} onChange={e => setContractForm({...contractForm, дата_договора: e.target.value})} />
              </div>
            </div>
            <div style={{display:'flex', gap:8}}>
              <button className="btn-save" onClick={generateContract} disabled={generating}>
                {generating ? 'Формируется...' : '⬇ Сформировать'}
              </button>
              <button className="btn-cancel" onClick={() => setShowContractForm(false)}>Отмена</button>
            </div>
          </div>
        )}

        {showInvoiceForm && (
          <div style={{marginTop:16, padding:16, background:'#f8f8f8', borderRadius:8}}>
            <div style={{fontWeight:500, marginBottom:12}}>🧾 Счёт и Акт</div>

            <div className="form-group"><label>Организация арендодателя</label>
              <select value={selectedOrg} onChange={e => setSelectedOrg(e.target.value)}>
                <option value="">— Выберите —</option>
                {organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>

            <div className="form-grid">
  <div className="form-group"><label>Номер счёта</label>
    <input value={invoiceForm.номер} onChange={e => setInvoiceForm({...invoiceForm, номер: e.target.value})} />
  </div>
  <div className="form-group"><label>Дата счёта</label>
    <input type="date" value={invoiceForm.дата} onChange={e => setInvoiceForm({...invoiceForm, дата: e.target.value})} />
  </div>
</div>
<div className="form-group"><label>Дата акта <span style={{fontSize:11, color:'#aaa'}}>(если отличается от даты счёта)</span></label>
  <input type="date" value={invoiceForm.дата_акта || ''} onChange={e => setInvoiceForm({...invoiceForm, дата_акта: e.target.value})} />
</div>
            </div>

            {/* Позиции */}
            <div style={{fontWeight:500, fontSize:13, marginBottom:8}}>Позиции</div>
            <table style={{width:'100%', borderCollapse:'collapse', marginBottom:8}}>
              <thead>
                <tr style={{background:'#eee', fontSize:12}}>
                  <th style={{padding:'4px 6px', textAlign:'left', width:30}}>№</th>
                  <th style={{padding:'4px 6px', textAlign:'left'}}>Наименование</th>
                  <th style={{padding:'4px 6px', textAlign:'center', width:60}}>Кол-во</th>
                  <th style={{padding:'4px 6px', textAlign:'center', width:50}}>Ед.</th>
                  <th style={{padding:'4px 6px', textAlign:'right', width:90}}>Цена</th>
                  <th style={{padding:'4px 6px', textAlign:'right', width:90}}>Сумма</th>
                  <th style={{width:30}}></th>
                </tr>
              </thead>
              <tbody>
                {invoiceForm.позиции.map((p, i) => (
                  <tr key={i}>
                    <td style={{padding:'4px 6px', fontSize:13}}>{i + 1}</td>
                    <td style={{padding:'4px 2px'}}>
                      <input value={p.наименование} onChange={e => updateItem(i, 'наименование', e.target.value)}
                        placeholder="Аренда помещения за июнь 2026г."
                        style={{width:'100%', padding:'4px 6px', border:'1px solid #ddd', borderRadius:4, fontSize:12}} />
                    </td>
                    <td style={{padding:'4px 2px'}}>
                      <input type="number" value={p.количество} onChange={e => updateItem(i, 'количество', e.target.value)}
                        style={{width:'100%', padding:'4px 6px', border:'1px solid #ddd', borderRadius:4, fontSize:12, textAlign:'center'}} />
                    </td>
                    <td style={{padding:'4px 2px'}}>
                      <input value={p.единица} onChange={e => updateItem(i, 'единица', e.target.value)}
                        style={{width:'100%', padding:'4px 6px', border:'1px solid #ddd', borderRadius:4, fontSize:12, textAlign:'center'}} />
                    </td>
                    <td style={{padding:'4px 2px'}}>
                      <input type="number" value={p.цена} onChange={e => updateItem(i, 'цена', e.target.value)}
                        placeholder="0.00"
                        style={{width:'100%', padding:'4px 6px', border:'1px solid #ddd', borderRadius:4, fontSize:12, textAlign:'right'}} />
                    </td>
                    <td style={{padding:'4px 6px', fontSize:12, textAlign:'right', fontWeight:500}}>
                      {parseFloat(p.сумма) ? parseFloat(p.сумма).toLocaleString('ru-RU', {minimumFractionDigits:2}) : '—'}
                    </td>
                    <td style={{padding:'4px 2px', textAlign:'center'}}>
                      {invoiceForm.позиции.length > 1 && (
                        <button onClick={() => removeItem(i)}
                          style={{background:'none', border:'none', color:'#A32D2D', cursor:'pointer', fontSize:14}}>✕</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <button onClick={addItem}
              style={{background:'#f4f4f8', border:'1px solid #ddd', borderRadius:6, padding:'5px 12px', fontSize:12, cursor:'pointer', marginBottom:12}}>
              + Добавить позицию
            </button>

            <div style={{textAlign:'right', fontSize:13, fontWeight:500, marginBottom:12}}>
              Итого: {итого.toLocaleString('ru-RU', {minimumFractionDigits:2})} руб.
              <div style={{fontSize:11, color:'#888', fontWeight:400}}>{numberToWords(итого)}</div>
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

            <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
              <button className="btn-save" onClick={generateInvoice} disabled={generating}>
                {generating ? 'Формируется...' : '⬇ Сформировать счёт'}
              </button>
              <button style={{background:'#3B6D11', color:'#fff', border:'none', borderRadius:6, padding:'8px 14px', fontSize:13, cursor:'pointer'}}
                onClick={generateAct} disabled={generating}>
                {generating ? 'Формируется...' : '⬇ Сформировать акт'}
              </button>
              <button style={{background:'#534AB7', color:'#fff', border:'none', borderRadius:6, padding:'8px 14px', fontSize:13, cursor:'pointer'}}
                onClick={async () => { await generateInvoice(); await generateAct(); }} disabled={generating}>
                {generating ? 'Формируется...' : '⬇ Сформировать оба'}
              </button>
              <button className="btn-cancel" onClick={() => setShowInvoiceForm(false)}>Отмена</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
