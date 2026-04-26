import { useState } from 'react';
import { addDisruption } from '../api.js';
import NetworkGraph from './NetworkGraph.jsx';

const DISRUPTION_TYPES = [
  { value: 'weather', label: '🌧 Weather Event', icon: '🌧' },
  { value: 'traffic', label: '🚗 Traffic Congestion', icon: '🚗' },
  { value: 'infrastructure', label: '🏗 Infrastructure Damage', icon: '🏗' },
  { value: 'accident', label: '⚠ Accident', icon: '⚠' },
  { value: 'strike', label: '🪧 Strike / Labor Action', icon: '🪧' },
  { value: 'other', label: '📌 Other', icon: '📌' },
];

function nowPlusHours(h) {
  const d = new Date();
  d.setHours(d.getHours() + h);
  return d.toISOString().slice(0, 16);
}

export default function DisruptionForm({ onDisruptionAdded }) {
  const [form, setForm] = useState({
    type: 'weather',
    location: 'B->D',
    severity: 'medium',
    start_time: nowPlusHours(0),
    end_time: nowPlusHours(6),
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));

  // Parse location to blocked edges for visualization
  const getBlockedEdges = () => {
    const match = form.location.match(/([A-Za-z])\s*[->,]\s*([A-Za-z])/);
    if (match) return [{ from: match[1].toUpperCase(), to: match[2].toUpperCase() }];
    return [];
  };

  const severityConfig = {
    low: { color: 'var(--green)', label: 'Low Impact', desc: 'Minor delays expected' },
    medium: { color: 'var(--amber)', label: 'Medium Impact', desc: 'Significant rerouting likely' },
    high: { color: 'var(--red)', label: 'High Impact', desc: 'Route blocked, emergency rerouting' },
  };

  const handleSubmit = async () => {
    if (!form.location.trim()) { setError('Enter a location or route segment.'); return; }
    setError(null);
    setLoading(true);
    setSuccess(null);
    try {
      const result = await addDisruption({
        ...form,
        start_time: new Date(form.start_time).toISOString(),
        end_time: new Date(form.end_time).toISOString(),
      });
      setSuccess(result);
      if (onDisruptionAdded) onDisruptionAdded(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSuccess(null);
    setError(null);
    setForm({
      type: 'weather',
      location: 'B->D',
      severity: 'medium',
      start_time: nowPlusHours(0),
      end_time: nowPlusHours(6),
    });
  };

  const sevConf = severityConfig[form.severity];
  const blocked = getBlockedEdges();

  return (
    <div className="fade-in">
      {success ? (
        <div className="fade-in">
          <div className="alert alert-warning">
            ⚠ Disruption <strong>{success.id}</strong> reported — routing engine updated
          </div>
          <div className="two-col" style={{ gap: 24 }}>
            <div className="card">
              <p className="card-title">📋 Disruption Created</p>
              <InfoRow label="ID" value={success.id} mono />
              <InfoRow label="Type" value={success.type} />
              <InfoRow label="Location" value={success.location} mono />
              <InfoRow label="Severity" value={success.severity?.toUpperCase()} />
              <InfoRow label="Status" value={success.status} />
              <div style={{ marginTop: 20 }}>
                <button className="btn btn-ghost btn-full" onClick={handleReset}>
                  + Report Another
                </button>
              </div>
            </div>
            <div className="card">
              <p className="card-title">🗺 Affected Network</p>
              <NetworkGraph blockedEdges={blocked} />
              <div className="alert alert-warning" style={{ marginTop: 12, marginBottom: 0 }}>
                ⚠ Active disruptions are pushed to the Java routing engine — new route requests will automatically avoid blocked edges.
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="two-col" style={{ gap: 24 }}>
          {/* Form */}
          <div className="card">
            <p className="card-title">⚠ Report Disruption</p>

            {error && <div className="alert alert-error">{error}</div>}

            <div className="input-group">
              <label className="input-label">Disruption Type</label>
              <select className="input-field" value={form.type} onChange={set('type')}>
                {DISRUPTION_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div className="input-group">
              <label className="input-label">Location / Route Segment</label>
              <input
                className="input-field"
                placeholder='e.g. B->D or "City C"'
                value={form.location}
                onChange={set('location')}
                style={{ fontFamily: 'var(--font-mono)' }}
              />
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                Use "A-&gt;B" format to block a specific edge in the routing engine
              </p>
            </div>

            <div className="input-group">
              <label className="input-label">Severity</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {['low', 'medium', 'high'].map(s => (
                  <button
                    key={s}
                    onClick={() => setForm(f => ({ ...f, severity: s }))}
                    style={{
                      flex: 1,
                      padding: '10px 0',
                      background: form.severity === s ? severityConfig[s].color + '22' : 'var(--bg-deep)',
                      border: `1.5px solid ${form.severity === s ? severityConfig[s].color : 'var(--border)'}`,
                      borderRadius: 'var(--radius-sm)',
                      color: form.severity === s ? severityConfig[s].color : 'var(--text-muted)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: 1,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
              {sevConf && (
                <p style={{ fontSize: 11, color: sevConf.color, marginTop: 6, fontFamily: 'var(--font-mono)' }}>
                  ↳ {sevConf.label}: {sevConf.desc}
                </p>
              )}
            </div>

            <div className="two-col" style={{ gap: 12 }}>
              <div className="input-group">
                <label className="input-label">Start Time</label>
                <input
                  type="datetime-local"
                  className="input-field"
                  value={form.start_time}
                  onChange={set('start_time')}
                  style={{ colorScheme: 'dark' }}
                />
              </div>
              <div className="input-group">
                <label className="input-label">End Time</label>
                <input
                  type="datetime-local"
                  className="input-field"
                  value={form.end_time}
                  onChange={set('end_time')}
                  style={{ colorScheme: 'dark' }}
                />
              </div>
            </div>

            <button
              className="btn btn-amber btn-full"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <>
                  <div style={{ width: 14, height: 14, border: '2px solid #664800', borderTopColor: '#ffb300', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                  Reporting...
                </>
              ) : (
                <>⚡ Report & Update Engine</>
              )}
            </button>
          </div>

          {/* Preview */}
          <div className="card">
            <p className="card-title">🗺 Impact Preview</p>
            <NetworkGraph blockedEdges={blocked} />

            <div style={{ marginTop: 16 }}>
              <p style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
                What Happens
              </p>
              {[
                'Disruption saved to MongoDB',
                'Java routing engine edge blocked via REST bridge',
                'Existing cached routes invalidated',
                'New route requests auto-reroute around disruption',
                'AI provides updated risk scores',
              ].map((step, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 8, alignItems: 'flex-start' }}>
                  <span style={{ color: 'var(--amber)', fontFamily: 'var(--font-mono)', fontSize: 11, minWidth: 18 }}>{i + 1}.</span>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{step}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value, mono }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #0f1921' }}>
      <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{label}</span>
      <span style={{ fontSize: 12, color: 'var(--text-primary)', fontFamily: mono ? 'var(--font-mono)' : 'inherit' }}>{value}</span>
    </div>
  );
}
