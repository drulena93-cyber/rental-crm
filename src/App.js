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
          </div>
        </nav>
      </div>

      {showChangelog && (
        <div className="modal-overlay" onClick={() => setShowChangelog(false)}>
          <div className="modal" style={{width:640, maxHeight:'82vh', display:'flex', flexDirection:'column', padding:0}} onClick={e => e.stopPropagation()}>
            <div className="modal-title" style={{padding:'18px 24px', margin:0, borderBottom:'1px solid #eee'}}>
              🔔 История изменений
              <button className="modal-close" onClick={() => setShowChangelog(false)}>✕ Закрыть</button>
            </div>
            <div style={{overflowY:'auto', padding:'8px 24px 20px'}}>
              {Array.isArray(CHANGELOG) && CHANGELOG.length > 0 ? (
                Object.entries(
                  [...CHANGELOG].reverse().reduce((groups, entry) => {
                    if (!groups[entry.date]) groups[entry.date] = [];
                    groups[entry.date].push(entry);
                    return groups;
                  }, {})
                ).map(([date, entries]) => (
                  <div key={date} style={{marginTop:18}}>
                    <div style={{
                      fontSize:12, fontWeight:700, color:'#534AB7', textTransform:'uppercase',
                      letterSpacing:'0.04em', marginBottom:10, paddingBottom:6, borderBottom:'2px solid #EDEAFB'
                    }}>
                      {date}
                    </div>
                    {entries.map(entry => {
                      const colonIdx = entry.text.indexOf(':');
                      const hasPrefix = colonIdx > 0 && colonIdx < 30;
                      const prefix = hasPrefix ? entry.text.slice(0, colonIdx) : null;
                      const rest = hasPrefix ? entry.text.slice(colonIdx + 1).trim() : entry.text;
                      return (
                        <div key={entry.id} style={{display:'flex', gap:10, padding:'8px 0', alignItems:'flex-start'}}>
                          <div style={{width:6, height:6, borderRadius:'50%', background:'#534AB7', marginTop:7, flexShrink:0}} />
                          <div style={{fontSize:14, color:'#333', lineHeight:1.5}}>
                            {prefix && <span style={{fontWeight:600, color:'#534AB7'}}>{prefix}: </span>}
                            {rest}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))
              ) : (
                <div style={{padding:'30px 0', textAlign:'center', color:'#aaa', fontSize:13}}>Пока нет записей</div>
              )}
            </div>
          </div>
        </div>
      )}
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
