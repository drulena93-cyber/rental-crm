import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { saveAs } from 'file-saver';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';

export default function Documents({ tenantId, tenantName, onClose }) {
  const [documents, setDocuments] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [showContractForm, setShowContractForm] = useState(false);
  const [uploadForm, setUploadForm] = useState({ name: '', type: 'Договор' });
  const [contractForm, setContractForm] = useState({ номер_договора: '', дата_договора: '' });
  const [selectedOrg, setSelectedOrg] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [tenant, setTenant] = useState(null);
  const fileRef = useRef();

  useEffect(() => { fetchAll(); }, [tenantId]);

  async function fetchAll() {
    setLoading(true);
    const { data: docs } = await supabase.from('documents').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false });
    const { data: orgs } = await supabase.from('organizations').select('*').order('name');
    const { data: ten } = await supabase.from('tenants').select('*').eq('id', tenantId).single();
    setDocuments(docs || []);
    setOrganizations(orgs || []);
    setTenant(ten);
    const def = orgs?.find(o => o.is_default);
    if (def) setSelectedOrg(def.id);

    // Загружаем шаблоны из Supabase Storage
    try {
      const { data: tmpl } = await supabase.storage.from('templates').list();
      setTemplates(tmpl || []);
    } catch(e) {
      setTemplates([]);
    }
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
      reader.onload = () => {
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
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
      if (!result.success) {
        alert('Ошибка загрузки на Яндекс Диск: ' + result.error);
        setUploading(false);
        return;
      }
      await supabase.from('documents').insert({
        tenant_id: tenantId,
        name: uploadForm.name,
        type: uploadForm.type,
        file_path: result.public_url,
        file_size: file.size,
      });
      setShowUploadForm(false);
      setUploadForm({ name: '', type: 'Договор' });
      fetchAll();
    } catch(e) {
      alert('Ошибка: ' + e.message);
    }
    setUploading(false);
  }

  async function deleteDoc(id) {
    if (!window.confirm('Удалить документ из CRM?')) return;
    await supabase.from('documents').delete().eq('id', id);
    fetchAll();
  }

  async function generateContract() {
    if (!selectedTemplate) return alert('Выберите шаблон');
    if (!selectedOrg) return alert('Выберите организацию');
    setGenerating(true);
    try {
      const org = organizations.find(o => o.id === selectedOrg);
      const { data: objData } = await supabase.from('objects').select('*').eq('id', tenant?.object_id).single();
      const { data: fileData } = await supabase.storage.from('templates').download(selectedTemplate);
      const arrayBuffer = await fileData.arrayBuffer();
      const zip = new PizZip(arrayBuffer);
      const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
      doc.render({
        номер_договора: contractForm.номер_договора || '___',
        дата_договора: contractForm.дата_договора || '___',
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
        арендатор_директор: tenant?.director || '',
        арендатор_основание: tenant?.basis || '',
        арендатор_адрес: tenant?.passport || '',
        арендатор_инн: tenant?.inn || '',
        арендатор_огрн: tenant?.ogrn || '',
        арендатор_кпп: tenant?.kpp || '',
        арендатор_бик: '',
        арендатор_банк: tenant?.bank || '',
        арендатор_рс: '',
        арендатор_кс: '',
        объект_название: objData?.name || '',
        объект_площадь: objData?.area || '',
        объект_стоимость: objData?.rent || '',
        объект_этаж: objData?.floor || '',
      });

      const blob = doc.getZip().generate({
        type: 'blob',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });
      const filename = `Договор_${tenant?.name}_${contractForm.номер_договора || 'б-н'}.docx`;

      // Конвертируем blob в base64
      const base64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(blob);
      });

      // Загружаем на Яндекс Диск
      const safeName = `${Date.now()}_${filename}`;
      const result = await uploadToYandex(base64, safeName, `Документы/${tenantName}`);

      // Сохраняем запись в БД
      await supabase.from('documents').insert({
        tenant_id: tenantId,
        name: `Договор №${contractForm.номер_договора || 'б-н'} от ${contractForm.дата_договора || '___'}`,
        type: 'Договор',
        file_path: result.public_url || '',
        file_size: blob.size,
      });

      // Скачиваем локально
      saveAs(blob, filename);
      setShowContractForm(false);
      fetchAll();
    } catch(e) {
      console.error(e);
      alert('Ошибка: ' + e.message);
    }
    setGenerating(false);
  }

  function formatSize(bytes) {
    if (!bytes) return '—';
    if (bytes < 1024) return bytes + ' Б';
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' КБ';
    return (bytes / 1024 / 1024).toFixed(1) + ' МБ';
  }

  function typeBadge(type) {
    const colors = { 'Договор': 'badge-blue', 'Акт': 'badge-green', 'Доверенность': 'badge-amber', 'Скан паспорта': 'badge-gray', 'Другое': 'badge-gray' };
    return <span className={`badge ${colors[type] || 'badge-gray'}`}>{type}</span>;
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{width: 640}} onClick={e => e.stopPropagation()}>
        <div className="modal-title">
          📄 Документы — {tenantName}
          <button className="modal-close" onClick={onClose}>✕ Закрыть</button>
        </div>

        <div style={{display:'flex', gap:8, marginBottom:16}}>
          <button className="btn-add" onClick={() => setShowUploadForm(true)}>
            📎 Прикрепить документ
          </button>
          <button style={{background:'#3B6D11', color:'#fff', border:'none', borderRadius:6, padding:'7px 14px', fontSize:13, cursor:'pointer'}}
            onClick={() => setShowContractForm(true)}>
            ✨ Сформировать из шаблона
          </button>
        </div>

        {loading ? <p>Загрузка...</p> : documents.length === 0 ? (
          <div style={{textAlign:'center', color:'#aaa', padding:30, fontSize:13}}>
            Документы не прикреплены
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Название</th>
                <th>Тип</th>
                <th>Размер</th>
                <th>Дата</th>
                <th style={{width:140}}>Действия</th>
              </tr>
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
                    <button onClick={() => deleteDoc(doc.id)}
                      style={{background:'#FCEBEB', color:'#A32D2D', border:'none', borderRadius:6, padding:'4px 8px', cursor:'pointer', fontSize:12}}>
                      ✕
                    </button>
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
                  <option>Договор</option>
                  <option>Акт</option>
                  <option>Доверенность</option>
                  <option>Скан паспорта</option>
                  <option>Другое</option>
                </select>
              </div>
            </div>
            <div style={{display:'flex', gap:8}}>
              <button className="btn-save" onClick={() => fileRef.current.click()} disabled={uploading}>
                {uploading ? 'Загружается на Яндекс Диск...' : '📎 Выбрать файл'}
              </button>
              <button className="btn-cancel" onClick={() => setShowUploadForm(false)}>Отмена</button>
            </div>
            <input ref={fileRef} type="file" style={{display:'none'}} onChange={uploadFile} />
          </div>
        )}

        {showContractForm && (
          <div style={{marginTop:16, padding:16, background:'#f8f8f8', borderRadius:8}}>
            <div style={{fontWeight:500, marginBottom:12}}>Сформировать из шаблона</div>
            <div className="form-group"><label>Организация арендодателя</label>
              <select value={selectedOrg} onChange={e => setSelectedOrg(e.target.value)}>
                <option value="">— Выберите —</option>
                {organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Шаблон</label>
              <select value={selectedTemplate} onChange={e => setSelectedTemplate(e.target.value)}>
                <option value="">— Выберите шаблон —</option>
                {templates.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
              </select>
            </div>
            <div className="form-grid">
              <div className="form-group"><label>Номер договора</label>
                <input value={contractForm.номер_договора} onChange={e => setContractForm({...contractForm, номер_договора: e.target.value})} placeholder="42" />
              </div>
              <div className="form-group"><label>Дата договора</label>
                <input type="date" value={contractForm.дата_договора} onChange={e => setContractForm({...contractForm, дата_договора: e.target.value})} />
              </div>
            </div>
            <div style={{display:'flex', gap:8}}>
              <button className="btn-save" onClick={generateContract} disabled={generating}>
                {generating ? 'Формируется...' : '⬇ Сформировать и скачать'}
              </button>
              <button className="btn-cancel" onClick={() => setShowContractForm(false)}>Отмена</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
