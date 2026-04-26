const API_BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const checkHealth = () => request('/health');

export const createShipment = (data) =>
  request('/shipment', { method: 'POST', body: JSON.stringify(data) });

export const getShipment = (id) => request(`/shipment/${id}`);

export const getRoute = (id) => request(`/route/${id}`);

export const getOptimizedRoute = (id) => request(`/optimized-route/${id}`);

export const addDisruption = (data) =>
  request('/disruption', { method: 'POST', body: JSON.stringify(data) });

export const getGraph = () => request('/graph');
