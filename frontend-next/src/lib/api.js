/**
 * API service layer for Smart Energy Tracker.
 * Reads NEXT_PUBLIC_API_URL from environment — never exposes backend internals.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function request(path, options = {}) {
  // Merge in headers, adding the localtunnel bypass header
  const headers = {
    'Bypass-Tunnel-Reminder': 'true',
    ...(options.headers || {}),
  };

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${res.statusText}`);
  }
  return res.json();
}

/** GET /api/appliances — returns array of appliance objects */
export function fetchAppliances() {
  return request('/api/appliances');
}

/** POST /api/appliances/:id/toggle — toggles ON↔OFF */
export function toggleAppliance(id) {
  return request(`/api/appliances/${id}/toggle`, { method: 'POST' });
}

/** POST /api/appliances/:id/reset — zeroes the energy counter */
export function resetAppliance(id) {
  return request(`/api/appliances/${id}/reset`, { method: 'POST' });
}

/** GET /health — simple health check */
export function healthCheck() {
  return request('/health');
}

/** POST /api/ai/analyze — get AI conservation tips */
export function analyzeEnergyUsage() {
  return request('/api/ai/analyze', { method: 'POST' });
}
