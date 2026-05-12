import React, { useState } from 'react';
import Objects from './pages/Objects';
import Tenants from './pages/Tenants';
import Analytics from './pages/Analytics';
import Contacts from './pages/Contacts';
import './App.css';

export default function App() {
  const [tab, setTab] = useState('objects');
  const [highlightId, setHighlightId] = useState(null);
  const [contactTenantId, setContactTenantId] = useState(null);

  function handleNavigate(section, id) {
    setHighlightId(null);
    setContactTenantId(null);
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
          <button className={tab === 'analytics' ? 'active' : ''} onClick={() => setTab('analytics')}>Аналитика</button>
        </nav>
      </div>
      <div className="content">
        {tab === 'objects' && <Objects onNavigate={handleNavigate} highlightId={highlightId} />}
        {tab === 'tenants' && <Tenants onNavigate={handleNavigate} highlightId={highlightId} />}
        {tab === 'contacts' && <Contacts onNavigate={handleNavigate} tenantId={contactTenantId} />}
        {tab === 'analytics' && <Analytics />}
      </div>
    </div>
  );
}
