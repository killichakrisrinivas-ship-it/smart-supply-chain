// utils/algorithmUtils.js
//
// FIX (review): "Your routing engine is in Java. Your backend is NodeJS.
//               But I see no integration layer."
//
// Old code had a hardcoded fake function:
//   routes['Shanghai'] = ['Shanghai', 'Guangzhou', 'HongKong', 'LA']
//
// This module replaces it with a real call to the Java routing microservice
// running on port 8080 (started by Main.java / RoutingHttpServer.java).
//
// If the Java service is unreachable (not started yet) it falls back to
// a basic stub so the Node.js server can still boot and show a clear error.

const JAVA_BRIDGE_URL = process.env.JAVA_BRIDGE_URL || 'http://localhost:8080';

/**
 * Get the shortest route from the Java routing engine.
 *
 * @param {string} origin      - Node ID, e.g. "A"
 * @param {string} destination - Node ID, e.g. "D"
 * @returns {Promise<{route: string[], totalTime: number, status: string}>}
 */
async function getShortestPath(origin, destination) {
  const url = `${JAVA_BRIDGE_URL}/route?from=${encodeURIComponent(origin)}&to=${encodeURIComponent(destination)}`;

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });

    if (!response.ok) {
      throw new Error(`Java bridge returned HTTP ${response.status}`);
    }

    const data = await response.json();

    // Java RouteResult.toJson() returns:
    // { source, destination, route: [...], time: <int>, status: "success"|"rerouted"|"no_route" }
    return {
      route:     data.route     || [],
      totalTime: data.time      || 0,
      status:    data.status    || 'unknown',
      source:    data.source,
      destination: data.destination
    };

  } catch (err) {
    console.error(`[algorithmUtils] Java bridge call failed: ${err.message}`);
    console.error(`  Is the Java engine running? Start Main.java first.`);

    // Graceful fallback — returns a stub so the API doesn't crash entirely
    return {
      route:       [origin, destination],
      totalTime:   -1,
      status:      'bridge_unavailable',
      error:       'Java routing engine not reachable. Start Main.java on port 8080.'
    };
  }
}

/**
 * Fetch the full graph topology from the Java engine.
 * Used by the /api/graph endpoint so the UI can visualise the network.
 */
async function getGraphSnapshot() {
  try {
    const response = await fetch(`${JAVA_BRIDGE_URL}/graph`,
      { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) {
    console.error(`[algorithmUtils] Could not fetch graph snapshot: ${err.message}`);
    return null;
  }
}

/**
 * Push a disruption (block/unblock an edge) to the Java engine.
 *
 * @param {string} from    - source node, e.g. "B"
 * @param {string} to      - destination node, e.g. "D"
 * @param {string} action  - "block" or "unblock"
 */
async function pushEdgeDisruption(from, to, action) {
  try {
    const response = await fetch(`${JAVA_BRIDGE_URL}/disruption`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, action }),
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) {
    console.error(`[algorithmUtils] Edge disruption push failed: ${err.message}`);
    return { ok: false, error: err.message };
  }
}

/**
 * Push congestion factor for a node to the Java engine.
 *
 * @param {string} node   - node ID, e.g. "C"
 * @param {number} factor - congestion multiplier, e.g. 2.5
 */
async function pushCongestion(node, factor) {
  try {
    const response = await fetch(`${JAVA_BRIDGE_URL}/disruption/congestion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ node, factor }),
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) {
    console.error(`[algorithmUtils] Congestion push failed: ${err.message}`);
    return { ok: false, error: err.message };
  }
}

module.exports = { getShortestPath, getGraphSnapshot, pushEdgeDisruption, pushCongestion };
