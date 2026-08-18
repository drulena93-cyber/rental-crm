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
import CHANGELOG from './changelogData';
import './App.css';

export default function App() {
  const [tab, setTab] = useState(() => localStorage.getItem('active_tab') || 'objects');
  const [highlightId, setHighlightId] = useState(null);
  const [contactTenantId, setContactTenantId] = useState(null);
  const [generationData, setGenerationData] = useState(null);
  const [navStack, setNavStack] = useState([]);
  const [showPaymentsTab, setShowPaymentsTab] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);
  const [seenCount, setSeenCount] = useState(() => parseInt(localStorage.getItem('changelog_seen_count') || '0'));

  const unreadCount = Math.max(0, CHANGELOG.length - seenCount);

  function toggleChangelog() {
    setShowChangelog(v => {
      const next = !v;
      if (next) {
        localStorage.setItem('changelog_seen_count', String(CHANGELOG.length));
        setSeenCount(CHANGELOG.length);
      }
      return next;
    });
  }

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
          <button className={tab === 'buildings' ? 'active' : ''} onClick={() => handleTabClick('buildings')}>🏢 Здания</button>
          <button className={tab === 'objects' ? 'active' : ''} onClick={() => handleTabClick('objects')}>Объекты</button>
          <button className={tab === 'tenants' ? 'active' : ''} onClick={() => handleTabClick('tenants')}>Арендаторы</button>
          <button className={tab === 'contacts' ? 'active' : ''} onClick={() => handleTabClick('contacts')}>Контакты</button>
          <button className={tab === 'documents' ? 'active' : ''} onClick={() => handleTabClick('documents')}>📄 Документы</button>
          <button className={tab === 'generation' ? 'active' : ''} onClick={() => handleTabClick('generation')}>✨ Генерация</button>
          {showPaymentsTab && <button className={tab === 'payments' ? 'active' : ''} onClick={() => handleTabClick('payments')}>💳 Оплаты</button>}
          <button className={tab === 'trash' ? 'active' : ''} onClick={() => handleTabClick('trash')} style={{color: tab === 'trash' ? '#fff' : '#A32D2D'}}>🗑 Корзина</button>
          <button className={tab === 'settings' ? 'active' : ''} onClick={() => handleTabClick('settings')}>⚙️ Настройки</button>
          <button className={tab === 'analytics' ? 'active' : ''} onClick={() => handleTabClick('analytics')}>📊 Аналитика</button>
          <div style={{position:'relative', marginLeft:4}}>
            <button onClick={toggleChangelog}
              title="История изменений"
              style={{
                position:'relative', background: showChangelog ? '#EDEAFB' : 'transparent',
                border:'1px solid #ddd', borderRadius:6, padding:'6px 10px', fontSize:15, cursor:'pointer', lineHeight:1
              }}>
              🔔
              {unreadCount > 0 && (
                <span style={{
                  position:'absolute', top:-5, right:-5, background:'#A32D2D', color:'#fff',
                  borderRadius:10, fontSize:10, fontWeight:700, minWidth:16, height:16,
                  display:'flex', alignItems:'center', justifyContent:'center', padding:'0 3px', lineHeight:1
                }}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {showChangelog && (
              <>
                <div onClick={() => setShowChangelog(false)}
                  style={{position:'fixed', inset:0, zIndex:40}} />
                <div style={{
                  position:'absolute', top:'calc(100% + 6px)', right:0, width:380, maxHeight:440,
                  background:'#fff', border:'1px solid #e5e5ea', borderRadius:10,
                  boxShadow:'0 8px 24px rgba(0,0,0,0.12)', zIndex:50, overflow:'hidden',
                  display:'flex', flexDirection:'column'
                }}>
                  <div style={{padding:'12px 16px', borderBottom:'1px solid #eee', fontWeight:600, fontSize:13, color:'#333'}}>
                    🔔 История изменений
                  </div>
                  <div style={{overflowY:'auto', padding:'8px 0', minHeight:40}}>
                    {Array.isArray(CHANGELOG) && CHANGELOG.length > 0 ? (
                      Object.entries(
                        [...CHANGELOG].reverse().reduce((groups, entry) => {
                          if (!groups[entry.date]) groups[entry.date] = [];
                          groups[entry.date].push(entry);
                          return groups;
                        }, {})
                      ).map(([date, entries]) => (
                        <div key={date}>
                          <div style={{padding:'8px 16px 4px', fontSize:11, fontWeight:700, color:'#888', textTransform:'uppercase', letterSpacing:'0.03em'}}>
                            {date}
                          </div>
                          {entries.map(entry => (
                            <div key={entry.id} style={{padding:'6px 16px', fontSize:13, color:'#333', lineHeight:1.4}}>
                              {entry.text}
                            </div>
                          ))}
                        </div>
                      ))
                    ) : (
                      <div style={{padding:'20px 16px', textAlign:'center', color:'#aaa', fontSize:13}}>Пока нет записей</div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
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
