import React, { useState } from 'react';
import Objects from './pages/Objects';
import Tenants from './pages/Tenants';
import Analytics from './pages/Analytics';
import './App.css';

export default function App() {
  const [tab, setTab] = useState('objects');

  return (
    <div className="app">
      <div className="topbar">
        <div className="logo">🏢 CRM Аренда</div>
        <nav className="tabs">
          <button className={tab === 'objects' ? 'active' : ''} onClick={() => setTab('objects')}>Объекты</button>
          <button className={tab === 'tenants' ? 'active' : ''} onClick={() => setTab('tenants')}>Арендаторы</button>
          <button className={tab === 'analytics' ? 'active' : ''} onClick={() => setTab('analytics')}>Аналитика</button>
        </nav>
      </div>
      <div className="content">
        {tab === 'objects' && <Objects />}
        {tab === 'tenants' && <Tenants />}
        {tab === 'analytics' && <Analytics />}
      </div>
    </div>
  );
}
