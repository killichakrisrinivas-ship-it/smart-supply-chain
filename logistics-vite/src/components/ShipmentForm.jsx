import { useState } from 'react';
import { createShipment, getOptimizedRoute } from '../api.js';
import NetworkGraph from './NetworkGraph.jsx';

const NODES = ['A', 'B', 'C', 'D', 'E'];
const CARGO_TYPES = ['Electronics', 'Medical Supplies', 'Food & Perishables', 'Industrial Parts', 'Hazardous Materials', 'General Cargo'];

export default function ShipmentForm({ onShipmentCreated }) {
  const [form, setForm] = useState({
    origin: 'A',
    destination: 'D',
    weight: '',
    cargo_type: 'General Cargo',
    priority: '1',
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('basic'); // 'basic' | 'optimized'

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async () => {
    if (!form.weight || isNaN(Number(form.weight))) {
      setError('Please enter a valid weight (kg).');
      return;
    }
    if (form.origin === form.destination) {
      setError('Origin and destination must be different nodes.');
      return;
    }
    setError(null);
    setLoading(true);
    setResult(null);
    try {
      const shipment = await createShipment({
        ...form,
        weight: Number(form.weight),
        priority: Number(form.priority),
      });

      // Immediately fetch optimized route
      let route = null;
      try {
        route = await getOptimizedRoute(shipment.id);
      } catch (e) {
        // fallback to basic route info from shipment
      }

      setResult({ shipment, route });
      if (onShipmentCreated) onShipmentCreated(shipment);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setError(null);
    setForm({ origin: 'A', destination: 'D', weight: '', cargo_type: 'General Cargo', priority: '1' });
  };

  const priorityLabels = { '1': 'Standard', '2': 'Elevated', '3': 'High', '4': 'Urgent', '5': 'Critical' };
  const priorityColors = { '1': '#4a5a70', '2': '#00e5ff', '3': '#00b8cc', '4': '#ffb300', '5': '#ff3d5a' };

  return (
    <div className="fade-in">
      {!result ? (
        <>
          <div className="two-col" style={{ gap: 24 }}>
            {/* Form */}
            <div className="card">
              <p className="card-title">📦 New Shipment</p>

              {error && (
                <div className="alert alert-error" style={{ marginBottom: 16 }}>
                  ⚠ {error}
                </div>
              )}

              <div className="two-col" style={{ gap: 12 }}>
                <div className="input-group">
                  <label className="input-label">Origin Node</label>
                  <select className="input-field" value={form.origin} onChange={set('origin')}>
                    {NODES.map(n => <option key={n} value={n}>Node {n}</option>)}
                  </select>
                </div>
                <div className="input-group">
                  <label className="input-label">Destination Node</label>
                  <select className="input-field" value={form.destination} onChange={set('destination')}>
                    {NODES.map(n => <option key={n} value={n}>Node {n}</option>)}
                  </select>
                </div>
              </div>

              <div className="input-group">
                <label className="input-label">Cargo Type</label>
                <select className="input-field" value={form.cargo_type} onChange={set('cargo_type')}>
                  {CARGO_TYPES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>

              <div className="two-col" style={{ gap: 12 }}>
                <div className="input-group">
                  <label className="input-label">Weight (kg)</label>
                  <input
                    type="number"
                    className="input-field"
                    placeholder="0.0"
                    value={form.weight}
                    onChange={set('weight')}
                    min="0.1"
                  />
                </div>
                <div className="input-group">
                  <label className="input-label">Priority</label>
                  <select className="input-field" value={form.priority} onChange={set('priority')}>
                    {Object.entries(priorityLabels).map(([v, l]) => (
                      <option key={v} value={v}>{v} — {l}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Priority indicator */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 12px',
                background: 'var(--bg-deep)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                marginBottom: 20,
              }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: priorityColors[form.priority],
                  boxShadow: `0 0 6px ${priorityColors[form.priority]}`,
                }} />
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: priorityColors[form.priority] }}>
                  Priority Level {form.priority} — {priorityLabels[form.priority]}
                </span>
              </div>

              <button
                className="btn btn-primary btn-full"
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <div style={{ width: 14, height: 14, border: '2px solid #00456e', borderTopColor: '#00e5ff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                    Optimizing Route...
                  </>
                ) : (
                  <>⚡ Create & Optimize Route</>
                )}
              </button>
            </div>

            {/* Route Preview */}
            <div className="card">
              <p className="card-title">🗺 Route Preview</p>
              <NetworkGraph activeRoute={[form.origin, form.destination]} />
              <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--bg-deep)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                  Route will be computed by Java Dijkstra engine
                </span>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="fade-in">
          <div className="alert alert-success">
            ✓ Shipment <strong>{result.shipment.id}</strong> created successfully
          </div>

          <div className="two-col" style={{ gap: 24 }}>
            {/* Result details */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                <p className="card-title" style={{ marginBottom: 0 }}>📋 Shipment Details</p>
                <span className="badge badge-info">{result.shipment.status}</span>
              </div>

              <InfoRow label="Shipment ID" value={result.shipment.id} mono />
              <InfoRow label="Route" value={`${result.shipment.origin} → ${result.shipment.destination}`} mono />
              <InfoRow label="Cargo" value={result.shipment.cargo_type} />
              <InfoRow label="Weight" value={`${result.shipment.weight} kg`} />
              <InfoRow label="Priority" value={`${result.shipment.priority} — ${priorityLabels[String(result.shipment.priority)]}`} />

              {result.route && (
                <>
                  <div style={{ height: 1, background: 'var(--border)', margin: '16px 0' }} />
                  <InfoRow label="Engine" value={result.route.engine || 'java-dijkstra'} mono />
                  <InfoRow label="Status" value={result.route.status} mono />
                  <InfoRow label="Total Time" value={result.route.total_time || 'N/A'} />
                  <InfoRow label="Rerouted" value={result.route.rerouted ? 'Yes (disruptions avoided)' : 'No'} />

                  {result.route.risk_score !== undefined && (
                    <div style={{ marginTop: 12 }}>
                      <div className="risk-bar-label">
                        <span>AI Risk Score</span>
                        <span>{Math.round(result.route.risk_score * 100)}%</span>
                      </div>
                      <div className="risk-bar-track">
                        <div className="risk-bar-fill" style={{
                          width: `${result.route.risk_score * 100}%`,
                          background: result.route.risk_score > 0.6
                            ? 'var(--red)'
                            : result.route.risk_score > 0.3
                            ? 'var(--amber)'
                            : 'var(--green)',
                        }} />
                      </div>
                    </div>
                  )}

                  {result.route.recommendations && result.route.recommendations.length > 0 && (
                    <div style={{ marginTop: 14 }}>
                      <p style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>AI Recommendations</p>
                      {result.route.recommendations.map((rec, i) => (
                        <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                          <span style={{ color: 'var(--cyan)', fontSize: 11 }}>→</span>
                          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{rec}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              <div style={{ marginTop: 20 }}>
                <button className="btn btn-ghost btn-full" onClick={handleReset}>
                  + New Shipment
                </button>
              </div>
            </div>

            {/* Network visualization */}
            <div className="card">
              <p className="card-title">🗺 Computed Route</p>
              <NetworkGraph
                activeRoute={result.route?.route || [result.shipment.origin, result.shipment.destination]}
              />
              {result.route?.route && (
                <div className="route-path" style={{ marginTop: 12 }}>
                  {result.route.route.map((node, i) => (
                    <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <span className="route-node">{node}</span>
                      {i < result.route.route.length - 1 && (
                        <span className="route-arrow">→</span>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value, mono }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid #0f1921' }}>
      <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: 0.5 }}>{label}</span>
      <span style={{ fontSize: 12, color: 'var(--text-primary)', fontFamily: mono ? 'var(--font-mono)' : 'inherit', fontWeight: mono ? 400 : 500 }}>
        {value}
      </span>
    </div>
  );
}
