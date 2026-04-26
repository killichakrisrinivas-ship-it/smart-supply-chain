import { useState } from 'react';
import { getRoute, getOptimizedRoute, getShipment } from '../api.js';
import NetworkGraph from './NetworkGraph.jsx';

export default function RouteView() {
  const [shipmentId, setShipmentId] = useState('');
  const [mode, setMode] = useState('optimized'); // 'basic' | 'optimized'
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const lookup = async () => {
    if (!shipmentId.trim()) { setError('Enter a shipment ID.'); return; }
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const [shipment, route] = await Promise.all([
        getShipment(shipmentId.trim()),
        mode === 'optimized'
          ? getOptimizedRoute(shipmentId.trim())
          : getRoute(shipmentId.trim()),
      ]);
      setData({ shipment, route });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const statusColor = {
    success: 'var(--green)',
    rerouted: 'var(--amber)',
    no_route: 'var(--red)',
    bridge_unavailable: 'var(--red)',
    unknown: 'var(--text-muted)',
  };

  return (
    <div className="fade-in">
      {/* Search bar */}
      <div className="card" style={{ marginBottom: 24 }}>
        <p className="card-title">🔍 Route Lookup</p>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
          <div className="input-group" style={{ flex: 1, marginBottom: 0 }}>
            <label className="input-label">Shipment ID</label>
            <input
              className="input-field"
              placeholder="e.g. ship_abc12345"
              value={shipmentId}
              onChange={e => setShipmentId(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && lookup()}
              style={{ fontFamily: 'var(--font-mono)' }}
            />
          </div>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label">Mode</label>
            <select className="input-field" value={mode} onChange={e => setMode(e.target.value)}
              style={{ minWidth: 160 }}>
              <option value="optimized">AI Optimized</option>
              <option value="basic">Basic (Dijkstra)</option>
            </select>
          </div>
          <button
            className="btn btn-primary"
            onClick={lookup}
            disabled={loading}
            style={{ marginBottom: 0 }}
          >
            {loading ? '...' : 'Compute Route'}
          </button>
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginTop: 14, marginBottom: 0 }}>
            ⚠ {error}
          </div>
        )}
      </div>

      {/* Results */}
      {data && (
        <div className="fade-in two-col" style={{ gap: 24 }}>
          {/* Graph */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <p className="card-title" style={{ marginBottom: 0 }}>🗺 Route Visualization</p>
              <div style={{ display: 'flex', gap: 6 }}>
                <span style={{
                  fontSize: 10,
                  fontFamily: 'var(--font-mono)',
                  color: statusColor[data.route?.status] || 'var(--text-muted)',
                  background: 'var(--bg-deep)',
                  border: `1px solid ${statusColor[data.route?.status] || 'var(--border)'}`,
                  padding: '3px 8px',
                  borderRadius: 20,
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                }}>
                  {data.route?.status || 'unknown'}
                </span>
                {data.route?.rerouted && (
                  <span className="badge badge-warning">Rerouted</span>
                )}
              </div>
            </div>

            <NetworkGraph
              activeRoute={data.route?.route || []}
            />

            {data.route?.route && data.route.route.length > 0 && (
              <div className="route-path" style={{ marginTop: 12 }}>
                {data.route.route.map((node, i) => (
                  <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span className="route-node" style={{
                      borderColor: i === 0 ? 'var(--green)' : i === data.route.route.length - 1 ? 'var(--amber)' : 'var(--cyan)',
                      color: i === 0 ? 'var(--green)' : i === data.route.route.length - 1 ? 'var(--amber)' : 'var(--cyan)',
                    }}>{node}</span>
                    {i < data.route.route.length - 1 && (
                      <span className="route-arrow">→</span>
                    )}
                  </span>
                ))}
              </div>
            )}

            {data.route?.total_time && (
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
                <div style={{ padding: '8px 20px', background: 'var(--bg-deep)', border: '1px solid var(--border)', borderRadius: 20 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--cyan)' }}>
                    ⏱ {data.route.total_time}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Details */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {data.shipment && (
              <div className="card">
                <p className="card-title">📦 Shipment Info</p>
                <InfoRow label="ID" value={data.shipment.id} mono />
                <InfoRow label="Origin" value={data.shipment.origin} />
                <InfoRow label="Destination" value={data.shipment.destination} />
                <InfoRow label="Cargo" value={data.shipment.cargo_type} />
                <InfoRow label="Weight" value={`${data.shipment.weight} kg`} />
                <InfoRow label="Priority" value={data.shipment.priority} />
                <InfoRow label="Status" value={data.shipment.status} />
              </div>
            )}

            {data.route && (
              <div className="card">
                <p className="card-title">🤖 {mode === 'optimized' ? 'AI Analysis' : 'Route Details'}</p>

                {data.route.engine && (
                  <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                    <span className="badge badge-info">⚙ {data.route.engine}</span>
                    {data.route.disruptions_applied > 0 && (
                      <span className="badge badge-warning">
                        {data.route.disruptions_applied} disruption{data.route.disruptions_applied > 1 ? 's' : ''} avoided
                      </span>
                    )}
                  </div>
                )}

                {data.route.risk_score !== undefined && (
                  <div style={{ marginBottom: 14 }}>
                    <div className="risk-bar-label">
                      <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>Risk Score</span>
                      <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: data.route.risk_score > 0.6 ? 'var(--red)' : data.route.risk_score > 0.3 ? 'var(--amber)' : 'var(--green)' }}>
                        {Math.round(data.route.risk_score * 100)}%
                      </span>
                    </div>
                    <div className="risk-bar-track">
                      <div className="risk-bar-fill" style={{
                        width: `${data.route.risk_score * 100}%`,
                        background: data.route.risk_score > 0.6 ? 'var(--red)' : data.route.risk_score > 0.3 ? 'var(--amber)' : 'var(--green)',
                      }} />
                    </div>
                  </div>
                )}

                {data.route.recommendations && data.route.recommendations.length > 0 && (
                  <>
                    <p style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>Recommendations</p>
                    {data.route.recommendations.map((rec, i) => (
                      <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, padding: '8px 10px', background: 'var(--bg-deep)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                        <span style={{ color: 'var(--cyan)', fontSize: 12, flexShrink: 0 }}>→</span>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{rec}</span>
                      </div>
                    ))}
                  </>
                )}

                {(!data.route.recommendations || data.route.recommendations.length === 0) && mode === 'basic' && (
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Basic routing — no AI analysis. Use "AI Optimized" mode for risk assessment.</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {!data && !loading && (
        <div className="empty-state">
          <div className="empty-icon">🗺</div>
          <p style={{ color: 'var(--text-secondary)' }}>Enter a shipment ID to compute its route</p>
          <p style={{ fontSize: 12, marginTop: 4 }}>The Java Dijkstra engine will find the optimal path</p>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value, mono }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #0f1921' }}>
      <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{label}</span>
      <span style={{ fontSize: 12, color: 'var(--text-primary)', fontFamily: mono ? 'var(--font-mono)' : 'inherit' }}>{value}</span>
    </div>
  );
}
