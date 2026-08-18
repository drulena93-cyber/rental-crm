import React, { useState, useEffect } from 'react';
import Objects from './pages/Objects';
import Tenants from './pages/Tenants';
import Analytics from './pages/Analytics';
import Contacts from './pages/Contacts';
import Trash from './pages/Trash';
import Settings from './pages/Settings';
import AllDocuments from './pages/AllDocuments';
import InvoiceGeneration from './pages/InvoiceGeneration';
import Payments from './pages/Payments';
import Buildings from './pages/Buildings';
import './App.css';

export default function App() {
  const [tab, setTab] = useState(() => localStorage.getItem('active_tab') || 'objects');
  const [highlightId, setHighlightId] = useState(null);
  const [contactTenantId, setContactTenantId] = useState(null);
  const [generationData, setGenerationData] = useState(null);
  const [navStack, setNavStack] = useState([]);
  const [showPaymentsTab, setShowPaymentsTab] = useState(false);

  useEffect(() => {
    fetch('/api/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `SELECT value FROM settings WHERE id = 'show_payments_tab'`, params: [] })
    }).then(r => r.json()).then(d => {
      setShowPaymentsTab(d.rows?.[0]?.value === 'true');
    }).catch(() => {});
  }, []);

  function changeTab(newTab) {
    setTab(newTab);
    localStorage.setItem('active_tab', newTab);
  }

  function handleNavigate(section, id, data) {
    setNavStack(prev => [...prev, { tab, highlightId, contactTenantId, generationData }]);
    if (section === 'tenants') {
      changeTab('tenants');
      setHighlightId(id);
    } else if (section === 'objects') {
      changeTab('objects');
      setHighlightId(id);
    } else if (section === 'contacts') {
      changeTab('contacts');
      setContactTenantId(id);
    } else if (section === 'analytics') {
      changeTab('analytics');
    } else if (section === 'generation') {
      setGenerationData(data || null);
      changeTab('generation');
    }
  }

  function handleBack() {
    if (navStack.length === 0) return;
    const prev = navStack[navStack.length - 1];
    setNavStack(s => s.slice(0, -1));
    setTab(prev.tab);
    setHighlightId(prev.highlightId);
    setContactTenantId(prev.contactTenantId);
    setGenerationData(prev.generationData);
    localStorage.setItem('active_tab', prev.tab);
  }

  function handleTabClick(newTab) {
    setNavStack([]);
    setHighlightId(null);
    setContactTenantId(null);
    setGenerationData(null);
    changeTab(newTab);
  }

  return (
    <div className="app">
      <div className="topbar">
        <div className="logo">🏢 CRM Аренда</div>
        <nav className="tabs">
          {navStack.length > 0 && (
            <button onClick={handleBack}
              style={{background:'#f4f4f8', border:'1px solid #ddd', borderRadius:6, padding:'6px 12px', fontSize:13, cursor:'pointer', marginRight:8, whiteSpace:'nowrap'}}>
              ← Назад
            </button>
          )}
          <button className={tab === 'analytics' ? 'active' : ''} onClick={() => handleTabClick('analytics')}>📊 Аналитика</button>
          <button className={tab === 'buildings' ? 'active' : ''} onClick={() => handleTabClick('buildings')}>🏢 Здания</button>
          <button className={tab === 'objects' ? 'active' : ''} onClick={() => handleTabClick('objects')}>Объекты</button>
          <button className={tab === 'tenants' ? 'active' : ''} onClick={() => handleTabClick('tenants')}>Арендаторы</button>
          <button className={tab === 'contacts' ? 'active' : ''} onClick={() => handleTabClick('contacts')}>Контакты</button>
          <button className={tab === 'documents' ? 'active' : ''} onClick={() => handleTabClick('documents')}>📄 Документы</button>
          <button className={tab === 'generation' ? 'active' : ''} onClick={() => handleTabClick('generation')}>✨ Генерация</button>
          {showPaymentsTab && <button className={tab === 'payments' ? 'active' : ''} onClick={() => handleTabClick('payments')}>💳 Оплаты</button>}
          <button className={tab === 'trash' ? 'active' : ''} onClick={() => handleTabClick('trash')} style={{color: tab === 'trash' ? '#fff' : '#A32D2D'}}>🗑 Корзина</button>
          <button className={tab === 'settings' ? 'active' : ''} onClick={() => handleTabClick('settings')}>⚙️ Настройки</button>
        </nav>
      </div>
      <div className="content">
        {tab === 'buildings' && <Buildings onNavigate={handleNavigate} />}
        {tab === 'objects' && <Objects onNavigate={handleNavigate} highlightId={highlightId} />}
        {tab === 'tenants' && <Tenants onNavigate={handleNavigate} highlightId={highlightId} showPayments={showPaymentsTab} />}
        {tab === 'contacts' && <Contacts onNavigate={handleNavigate} tenantId={contactTenantId} />}
        {tab === 'documents' && <AllDocuments onNavigate={handleNavigate} />}
        {tab === 'generation' && <InvoiceGeneration onNavigate={handleNavigate} initialData={generationData} />}
        {tab === 'payments' && <Payments onNavigate={handleNavigate} />}
        {tab === 'analytics' && <Analytics onNavigate={handleNavigate} />}
        {tab === 'trash' && <Trash />}
        {tab === 'settings' && <Settings />}
      </div>
    </div>
  );
}
