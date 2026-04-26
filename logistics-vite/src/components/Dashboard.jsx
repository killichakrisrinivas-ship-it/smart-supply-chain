import { useState, useEffect } from 'react';
import { checkHealth, getGraph } from '../api.js';
import NetworkGraph from './NetworkGraph.jsx';

const DEMO_ROUTES = [
  { id: 'DEL-001', from: 'A', to: 'D', path: ['A', 'B', 'D'], time: '8h', status: 'success' },
  { id: 'DEL-002', from: 'A', to: 'E', path: ['A', 'C', 'E'], time: '10h', status: 'rerouted' },
  { id: 'DEL-003', from: 'B', to: 'D', path: ['B', 'D'], time: '3h', status: 'success' },
];

export default function Dashboard({ counts }) {
  const [health, setHealth] = useState({ node: null, java: null });
  const [graphData, setGraphData] = useState(null);
  const [previewRoute, setPreviewRoute] = useState(DEMO_ROUTES[0]);
  const [previewIdx, setPreviewIdx] = useState(0);

  useEffect(() => {
    // Check Node.js health
    checkHealth()
      .then(() => setHealth(h => ({ ...h, node: 'online' })))
      .catch(() => setHealth(h => ({ ...h, node: 'offline' })));

    // Check graph (also reveals Java engine status)
    getGraph()
      .then(data => {
        setGraphData(data);
        setHealth(h => ({ ...h, java: 'online' }));
      })
      .catch(() => setHealth(h => ({ ...h, java: 'offline' })));
  }, []);

  // Cycle through demo routes for visualization
  useEffect(() => {
    const timer = setInterval(() => {
      setPreviewIdx(i => {
        const next = (i + 1) % DEMO_ROUTES.length;
        setPreviewRoute(DEMO_ROUTES[next]);
        return next;
      });
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const nodeOnline = health.node === 'online';
  const javaOnline = health.java === 'online';

  return (
    <div className="fade-in">
      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card cyan">
          <div className="stat-label">Total Shipments</div>
          <div className="stat-value">{counts?.shipments ?? '—'}</div>
          <div className="stat-sub">Tracked in MongoDB</div>
        </div>
        <div className="stat-card amber">
          <div className="stat-label">Active Disruptions</div>
          <div className="stat-value">{counts?.disruptions ?? '—'}</div>
          <div className="stat-sub">Affecting live routing</div>
        </div>
        <div className="stat-card green">
          <div className="stat-label">Graph Nodes</div>
          <div className="stat-value">5</div>
          <div className="stat-sub">A, B, C, D, E</div>
        </div>
        <div className="stat-card" style={{ borderTopColor: nodeOnline ? 'var(--green)' : 'var(--red)' }}>
          <div className="stat-label">System Status</div>
          <div className="stat-value" style={{ fontSize: 16, marginTop: 4 }}>
            <StatusRow label="Node.js API" online={nodeOnline} />
            <StatusRow label="Java Engine" online={javaOnline} />
            <StatusRow label="MongoDB" online={nodeOnline} />
          </div>
        </div>
      </div>

      <div className="two-col" style={{ gap: 24 }}>
        {/* Live Network */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <p className="card-title" style={{ marginBottom: 0 }}>🗺 Live Network</p>
            <div style={{ display: 'flex', gap: 8 }}>
              {DEMO_ROUTES.map((r, i) => (
                <button
                  key={r.id}
                  onClick={() => { setPreviewIdx(i); setPreviewRoute(r); }}
                  style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: i === previewIdx ? 'var(--cyan)' : 'var(--border)',
                    border: 'none', cursor: 'pointer', padding: 0,
                  }}
                />
              ))}
            </div>
          </div>

          <NetworkGraph activeRoute={previewRoute.path} />

          <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--bg-deep)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
              {previewRoute.from} → {previewRoute.to}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <span className={`badge ${previewRoute.status === 'success' ? 'badge-success' : 'badge-warning'}`}>
                {previewRoute.status}
              </span>
              <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                {previewRoute.time}
              </span>
            </div>
          </div>
        </div>

        {/* Architecture overview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <p className="card-title">🏗 Architecture</p>
            <ArchLayer
              name="React Frontend"
              port={3001}
              status="online"
              desc="You are here — this dashboard"
              color="var(--purple)"
            />
            <div style={{ width: 2, height: 16, background: 'var(--border)', margin: '0 24px' }} />
            <ArchLayer
              name="Node.js API"
              port={3000}
              status={health.node}
              desc="Express + MongoDB + Gemini AI"
              color="var(--green)"
            />
            <div style={{ width: 2, height: 16, background: 'var(--border)', margin: '0 24px' }} />
            <ArchLayer
              name="Java Routing Engine"
              port={8080}
              status={health.java}
              desc="Dijkstra + RouteCache + DisruptionSimulator"
              color="var(--cyan)"
            />
            <div style={{ width: 2, height: 16, background: 'var(--border)', margin: '0 24px' }} />
            <ArchLayer
              name="MongoDB"
              port={27017}
              status={health.node}
              desc="Shipments + Disruptions persistence"
              color="var(--amber)"
            />
          </div>

          <div className="card">
            <p className="card-title">🔑 Key Features</p>
            {[
              { icon: '⚡', title: 'Dijkstra Routing', desc: 'Real shortest-path computation in Java' },
              { icon: '🤖', title: 'Gemini AI', desc: 'Risk scoring + recommendations' },
              { icon: '🔄', title: 'Live Rerouting', desc: 'Disruptions update routing engine instantly' },
              { icon: '📦', title: 'Version Cache', desc: 'Graph-version-aware route cache' },
            ].map(f => (
              <div key={f.title} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 18 }}>{f.icon}</span>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{f.title}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusRow({ label, online }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
      <div className={`health-dot ${online ? 'online' : online === false ? 'offline' : ''}`} />
      <span style={{ fontSize: 12, color: online ? 'var(--green)' : online === false ? 'var(--red)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
        {label}
      </span>
    </div>
  );
}

function ArchLayer({ name, port, status, desc, color }) {
  const online = status === 'online';
  return (
    <div style={{
      padding: '12px 14px',
      background: 'var(--bg-deep)',
      border: `1px solid ${online ? color + '44' : 'var(--border)'}`,
      borderLeft: `3px solid ${online ? color : 'var(--border)'}`,
      borderRadius: 'var(--radius-sm)',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    }}>
      <div>
        <p style={{ fontSize: 13, fontWeight: 600, color: online ? color : 'var(--text-secondary)' }}>{name}</p>
        <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{desc}</p>
      </div>
      <div style={{ textAlign: 'right' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>:{port}</span>
        <div style={{ marginTop: 4 }}>
          <span className={`badge ${online ? 'badge-success' : status === null ? 'badge-muted' : 'badge-danger'}`}>
            {online ? '● online' : status === null ? '○ checking' : '● offline'}
          </span>
        </div>
      </div>
    </div>
  );
}
