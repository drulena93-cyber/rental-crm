import React, { useState } from 'react';
import Objects from './pages/Objects';
import Tenants from './pages/Tenants';
import Analytics from './pages/Analytics';
import Contacts from './pages/Contacts';
import Trash from './pages/Trash';
import Settings from './pages/Settings';
import AllDocuments from './pages/AllDocuments';
import InvoiceGeneration from './pages/InvoiceGeneration';
import './App.css';

export default function App() {
  const [tab, setTab] = useState(() => localStorage.getItem('active_tab') || 'objects');
  const [highlightId, setHighlightId] = useState(null);
  const [contactTenantId, setContactTenantId] = useState(null);
  const [generationData, setGenerationData] = useState(null);

  function changeTab(newTab) {
    setTab(newTab);
    localStorage.setItem('active_tab', newTab);
  }

  function handleNavigate(section, id, data) {
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

  return (
    <div className="app">
      <div className="topbar">
        <div className="logo">🏢 CRM Аренда</div>
        <nav className="tabs">
          <button className={tab === 'objects' ? 'active' : ''} onClick={() => changeTab('objects')}>Объекты</button>
          <button className={tab === 'tenants' ? 'active' : ''} onClick={() => changeTab('tenants')}>Арендаторы</button>
          <button className={tab === 'contacts' ? 'active' : ''} onClick={() => changeTab('contacts')}>Контакты</button>
          <button className={tab === 'documents' ? 'active' : ''} onClick={() => changeTab('documents')}>📄 Документы</button>
          <button className={tab === 'generation' ? 'active' : ''} onClick={() => changeTab('generation')}>✨ Генерация</button>
          <button className={tab === 'analytics' ? 'active' : ''} onClick={() => changeTab('analytics')}>Аналитика</button>
          <button className={tab === 'trash' ? 'active' : ''} onClick={() => changeTab('trash')} style={{color: tab === 'trash' ? '#fff' : '#A32D2D'}}>🗑 Корзина</button>
          <button className={tab === 'settings' ? 'active' : ''} onClick={() => changeTab('settings')}>⚙️ Настройки</button>
        </nav>
      </div>
      <div className="content">
        {tab === 'objects' && <Objects onNavigate={handleNavigate} highlightId={highlightId} />}
        {tab === 'tenants' && <Tenants onNavigate={handleNavigate} highlightId={highlightId} />}
        {tab === 'contacts' && <Contacts onNavigate={handleNavigate} tenantId={contactTenantId} />}
        {tab === 'documents' && <AllDocuments onNavigate={handleNavigate} />}
        {tab === 'generation' && <InvoiceGeneration onNavigate={handleNavigate} initialData={generationData} />}
        {tab === 'analytics' && <Analytics />}
        {tab === 'trash' && <Trash />}
        {tab === 'settings' && <Settings />}
      </div>
    </div>
  );
}
