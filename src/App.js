import React, { useState } from 'react';
import Objects from './pages/Objects';
import Tenants from './pages/Tenants';
import Analytics from './pages/Analytics';
import Contacts from './pages/Contacts';
import Trash from './pages/Trash';
import Settings from './pages/Settings';
import AllDocuments from './pages/AllDocuments';
import './App.css';

export default function App() {
  const [tab, setTab] = useState('objects');
  const [highlightId, setHighlightId] = useState(null);
  const [contactTenantId, setContactTenantId] = useState(null);

  function handleNavigate(section, id) {
    if (section === 'tenants') {
      setTab('tenants');
      setHighlightId(id);
    } else if (section === 'objects') {
      setTab('objects');
      setHighlightId(id);
    } else if (section === 'contacts') {
      setTab('contacts');
      setContactTenantId(id);
    } else if (section === 'analytics') {
      setTab('analytics');
    }
  }

  return (
    <div className="app">
      <div className="topbar">
        <div className="logo">🏢 CRM Аренда</div>
        <nav className="tabs">
          <button className={tab === 'objects' ? 'active' : ''} onClick={() => setTab('objects')}>Объекты</button>
          <button className={tab === 'tenants' ? 'active' : ''} onClick={() => setTab('tenants')}>Арендаторы</button>
          <button className={tab === 'contacts' ? 'active' : ''} onClick={() => setTab('contacts')}>Контакты</button>
          <button className={tab === 'documents' ? 'active' : ''} onClick={() => setTab('documents')}>📄 Документы</button>
          <button className={tab === 'analytics' ? 'active' : ''} onClick={() => setTab('analytics')}>Аналитика</button>
          <button className={tab === 'trash' ? 'active' : ''} onClick={() => setTab('trash')} style={{color: tab === 'trash' ? '#fff' : '#A32D2D'}}>🗑 Корзина</button>
          <button className={tab === 'settings' ? 'active' : ''} onClick={() => setTab('settings')}>⚙️ Настройки</button>
        </nav>
      </div>
      <div className="content">
        {tab === 'objects' && <Objects onNavigate={handleNavigate} highlightId={highlightId} />}
        {tab === 'tenants' && <Tenants onNavigate={handleNavigate} highlightId={highlightId} />}
        {tab === 'contacts' && <Contacts onNavigate={handleNavigate} tenantId={contactTenantId} />}
        {tab === 'documents' && <AllDocuments onNavigate={handleNavigate} />}
        {tab === 'analytics' && <Analytics />}
        {tab === 'trash' && <Trash />}
        {tab === 'settings' && <Settings />}
      </div>
    </div>
  );
}
