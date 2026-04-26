import { useState } from 'react';
import Dashboard from './components/Dashboard.jsx';
import ShipmentForm from './components/ShipmentForm.jsx';
import RouteView from './components/RouteView.jsx';
import DisruptionForm from './components/DisruptionForm.jsx';
import NetworkGraph from './components/NetworkGraph.jsx';

const NAV = [
  {
    section: 'Overview',
    items: [
      { id: 'dashboard', icon: '⬡', label: 'Dashboard' },
      { id: 'network', icon: '◈', label: 'Network Graph' },
    ],
  },
  {
    section: 'Operations',
    items: [
      { id: 'shipment', icon: '📦', label: 'New Shipment' },
      { id: 'routes', icon: '🗺', label: 'Route Lookup' },
      { id: 'disruption', icon: '⚠', label: 'Disruptions' },
    ],
  },
];

const PAGE_META = {
  dashboard: { title: 'Mission Control', desc: 'System health, live network, and architecture overview' },
  network: { title: 'Network Graph', desc: 'Interactive logistics network — hover nodes, visualize routes' },
  shipment: { title: 'Create Shipment', desc: 'Define a new cargo shipment and get an AI-optimized route instantly' },
  routes: { title: 'Route Lookup', desc: 'Compute Dijkstra or AI-optimized routes for any shipment ID' },
  disruption: { title: 'Report Disruption', desc: 'Inject a disruption — the routing engine updates in real time' },
};

export default function App() {
  const [page, setPage] = useState('dashboard');
  const [counts, setCounts] = useState({ shipments: 0, disruptions: 0 });

  const handleShipmentCreated = () => setCounts(c => ({ ...c, shipments: c.shipments + 1 }));
  const handleDisruptionAdded = () => setCounts(c => ({ ...c, disruptions: c.disruptions + 1 }));

  const meta = PAGE_META[page];

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <span className="logo-icon">⬡</span>
          <h1>Smart Supply<br />Chain Optimizer</h1>
          <p>Hackathon Edition</p>
        </div>
        <nav className="sidebar-nav">
          {NAV.map(section => (
            <div key={section.section}>
              <p className="nav-section-label">{section.section}</p>
              {section.items.map(item => (
                <div key={item.id} className={`nav-item ${page === item.id ? 'active' : ''}`} onClick={() => setPage(item.id)}>
                  <span className="nav-icon">{item.icon}</span>
                  {item.label}
                  {item.id === 'disruption' && counts.disruptions > 0 && (
                    <span className="nav-badge">{counts.disruptions}</span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="health-pill">
            <div className="health-dot online" />
            <span>Backend running</span>
          </div>
          <div style={{ marginTop: 8, padding: '8px 12px', background: 'var(--bg-card)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
            <p style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: 1, marginBottom: 4 }}>API BASE</p>
            <p style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--cyan)' }}>localhost:3000/api</p>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-void)', borderBottom: '1px solid var(--border)', padding: '14px 32px', display: 'flex', alignItems: 'center', gap: 16, backdropFilter: 'blur(10px)' }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, letterSpacing: 0.5 }}>{meta.title}</h2>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{meta.desc}</p>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            {!['shipment','disruption'].includes(page) && (
              <button className="btn btn-ghost" style={{ fontSize: 10 }} onClick={() => setPage('shipment')}>+ New Shipment</button>
            )}
            {page !== 'disruption' && (
              <button className="btn btn-ghost" style={{ fontSize: 10 }} onClick={() => setPage('disruption')}>⚠ Report Disruption</button>
            )}
          </div>
        </div>

        <div style={{ padding: '28px 32px 40px' }}>
          {page === 'dashboard' && <Dashboard counts={counts} />}
          {page === 'network' && <NetworkPage />}
          {page === 'shipment' && <ShipmentForm onShipmentCreated={handleShipmentCreated} />}
          {page === 'routes' && <RouteView />}
          {page === 'disruption' && <DisruptionForm onDisruptionAdded={handleDisruptionAdded} />}
        </div>
      </main>
    </div>
  );
}

function NetworkPage() {
  const [activeRoute, setActiveRoute] = useState([]);
  const [from, setFrom] = useState('A');
  const [to, setTo] = useState('D');
  const [errorMsg, setErrorMsg] = useState(null);
  const NODES = ['A','B','C','D','E'];
  const showRoute = async () => {
    setErrorMsg(null);
    try {
      const res = await fetch(`http://localhost:8080/route?from=${from}&to=${to}`);
      if (!res.ok) {
        const errorData = await res.json();
        console.warn('Routing error:', errorData);
        setActiveRoute([]);
        setErrorMsg('Failed to compute route.');
        return;
      }
      const data = await res.json();
      if (data.route && Array.isArray(data.route) && data.route.length > 0) {
        setActiveRoute(data.route);
      } else {
        setActiveRoute([from, to]);
        setErrorMsg(`No path exists from ${from} to ${to} in the directed network.`);
      }
    } catch (err) {
      console.error('Failed to fetch route:', err);
      setActiveRoute([]);
      setErrorMsg('Error communicating with Java engine.');
    }
  };
  return (
    <div className="fade-in">
      <div className="card" style={{ marginBottom: 20 }}>
        <p className="card-title">🔗 Topology Explorer</p>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label">From</label>
            <select className="input-field" value={from} onChange={e => setFrom(e.target.value)} style={{ minWidth: 110 }}>
              {NODES.map(n => <option key={n} value={n}>Node {n}</option>)}
            </select>
          </div>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label">To</label>
            <select className="input-field" value={to} onChange={e => setTo(e.target.value)} style={{ minWidth: 110 }}>
              {NODES.map(n => <option key={n} value={n}>Node {n}</option>)}
            </select>
          </div>
          <button className="btn btn-primary" onClick={showRoute}>Highlight Path</button>
          <button className="btn btn-ghost" onClick={() => { setActiveRoute([]); setErrorMsg(null); }}>Clear</button>
        </div>
        {errorMsg && (
          <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger)', borderRadius: 'var(--radius-sm)', color: '#ff8a8a', fontSize: 13 }}>
            ⚠ {errorMsg}
          </div>
        )}
      </div>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <p className="card-title" style={{ marginBottom: 0 }}>Logistics Network</p>
          <div style={{ display: 'flex', gap: 20 }}>
            {[['Nodes','5'],['Edges','5'],['Algorithm','Dijkstra']].map(([l,v]) => (
              <div key={l} style={{ textAlign: 'center' }}>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: 'var(--cyan)' }}>{v}</p>
                <p style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{l}</p>
              </div>
            ))}
          </div>
        </div>
        <NetworkGraph activeRoute={activeRoute} />
        <div style={{ marginTop: 20 }}>
          <p className="card-title">Edge Weights (Transit Hours)</p>
          <div className="three-col" style={{ gap: 10 }}>
            {[['A → B',5],['A → C',6],['B → D',3],['C → D',2],['C → E',4]].map(([edge,w]) => (
              <div key={edge} style={{ padding: '10px 14px', background: 'var(--bg-deep)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--cyan)' }}>{edge}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>{w}h</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
