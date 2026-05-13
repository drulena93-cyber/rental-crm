import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function Settings() {
  const [orgs, setOrgs] = useState([]);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    const { data } = await supabase.from('organizations').select('*').order('name');
    setOrgs(data || []);
    setLoading(false);
  }

  function openAdd() {
    setForm({ is_default: false, basis: 'Устава', position: 'директора' });
    setShowForm(true);
    setSelected(null);
  }

  function openEdit(org) {
    setForm({ ...org });
    setShowForm(true);
    setSelected(null);
  }

  async function saveForm() {
    if (!form.name) return alert('Введите название организации');
    if (form.id) {
      await supabase.from('organizations').update(form).eq('id', form.id);
    } else {
      await supabase.from('organizations').insert(form);
    }
    if (form.is_default) {
      await supabase.from('organizations').update({ is_default: false }).neq('id', form.id || '00000000-0000-0000-0000-000000000000');
      await supabase.from('organizations').update({ is_default: true }).eq('name', form.name);
    }
    setShowForm(false);
    fetchAll();
  }

  async function deleteOrg(id) {
    if (!window.confirm('Удалить организацию?')) return;
    await supabase.from('organizations').delete().eq('id', id);
    fetchAll();
  }

  return (
    <div>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16}}>
        <h2 style={{fontSize:16, fontWeight:500}}>⚙️ Настройки — Организации арендодателя</h2>
        <button className="btn-add" onClick={openAdd}>+ Добавить организацию</button>
      </div>

      {loading ? <p>Загрузка...</p> : (
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(360px, 1fr))', gap:12}}>
          {orgs.map(org => (
            <div key={org.id} style={{background:'#fff', border:`1.5px solid ${org.is_default ? '#534AB7' : '#e5e5e5'}`, borderRadius:10, padding:16}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10}}>
                <div>
                  <div style={{fontWeight:500, fontSize:15}}>{org.name}</div>
                  <div style={{fontSize:12, color:'#888', marginTop:2}}>{org.full_name}</div>
                </div>
                {org.is_default && <span className="badge badge-blue">По умолчанию</span>}
              </div>
              <div style={{fontSize:13, display:'grid', gap:4}}>
                <div><span style={{color:'#888'}}>Директор: </span>{org.director || '—'}</div>
                <div><span style={{color:'#888'}}>Основание: </span>{org.basis || '—'}</div>
                <div><span style={{color:'#888'}}>Адрес: </span>{org.address_legal || '—'}</div>
                <div><span style={{color:'#888'}}>ИНН: </span>{org.inn || '—'} {org.kpp ? `/ КПП: ${org.kpp}` : ''}</div>
                <div><span style={{color:'#888'}}>ОГРН: </span>{org.ogrn || '—'}</div>
                <div><span style={{color:'#888'}}>Банк: </span>{org.bank || '—'}</div>
                <div><span style={{color:'#888'}}>Р/С: </span>{org.bank_account || '—'}</div>
                <div><span style={{color:'#888'}}>К/С: </span>{org.corr_account || '—'}</div>
              </div>
              <div style={{display:'flex', gap:8, marginTop:12}}>
                <button className="btn-save" style={{flex:1, padding:'6px 0'}} onClick={() => openEdit(org)}>Редактировать</button>
                <button className="btn-cancel" style={{padding:'6px 12px'}} onClick={() => deleteOrg(org.id)}>Удалить</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">
              {form.id ? 'Редактировать организацию' : 'Новая организация'}
              <button className="modal-close" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <div className="form-group"><label>Название краткое *</label><input value={form.name||''} onChange={e => setForm({...form, name: e.target.value})} placeholder='ООО "Эрия"' /></div>
            <div className="form-group"><label>Название полное</label><input value={form.full_name||''} onChange={e => setForm({...form, full_name: e.target.value})} placeholder='Общество с ограниченной ответственностью "Эрия"' /></div>
            <div className="form-grid">
              <div className="form-group"><label>ФИО директора (именительный)</label><input value={form.director||''} onChange={e => setForm({...form, director: e.target.value})} /></div>
              <div className="form-group"><label>ФИО директора (родительный)</label><input value={form.director_rod||''} onChange={e => setForm({...form, director_rod: e.target.value})} placeholder="Крякова Михаила Сергеевича" /></div>
              <div className="form-group"><label>Должность</label><input value={form.position||''} onChange={e => setForm({...form, position: e.target.value})} placeholder="директора" /></div>
              <div className="form-group"><label>Основание</label><input value={form.basis||''} onChange={e => setForm({...form, basis: e.target.value})} placeholder="Устава" /></div>
            </div>
            <div className="form-group"><label>Юридический адрес</label><input value={form.address_legal||''} onChange={e => setForm({...form, address_legal: e.target.value})} /></div>
            <div className="form-group"><label>Фактический адрес</label><input value={form.address_fact||''} onChange={e => setForm({...form, address_fact: e.target.value})} /></div>
            <div className="form-grid">
              <div className="form-group"><label>ИНН</label><input value={form.inn||''} onChange={e => setForm({...form, inn: e.target.value})} /></div>
              <div className="form-group"><label>ОГРН / ОГРНИП</label><input value={form.ogrn||''} onChange={e => setForm({...form, ogrn: e.target.value})} /></div>
              <div className="form-group"><label>КПП</label><input value={form.kpp||''} onChange={e => setForm({...form, kpp: e.target.value})} /></div>
              <div className="form-group"><label>ОКПО</label><input value={form.okpo||''} onChange={e => setForm({...form, okpo: e.target.value})} /></div>
            </div>
            <div className="form-group"><label>Банк</label><input value={form.bank||''} onChange={e => setForm({...form, bank: e.target.value})} /></div>
            <div className="form-grid">
              <div className="form-group"><label>БИК</label><input value={form.bik||''} onChange={e => setForm({...form, bik: e.target.value})} /></div>
              <div className="form-group"><label>Корр. счёт</label><input value={form.corr_account||''} onChange={e => setForm({...form, corr_account: e.target.value})} /></div>
              <div className="form-group"><label>Расч. счёт</label><input value={form.bank_account||''} onChange={e => setForm({...form, bank_account: e.target.value})} /></div>
            </div>
            <div className="form-group"><label><input type="checkbox" checked={form.is_default||false} onChange={e => setForm({...form, is_default: e.target.checked})} /> Использовать по умолчанию</label></div>
            <div className="form-actions">
              <button className="btn-cancel" onClick={() => setShowForm(false)}>Отмена</button>
              <button className="btn-save" onClick={saveForm}>Сохранить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
