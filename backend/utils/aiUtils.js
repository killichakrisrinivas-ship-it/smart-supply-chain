// utils/aiUtils.js
//
// FIX (review): "The AI is just a fancy input parser. Judges may ask:
//               'Why use AI at all?' The route itself was still hardcoded."
//
// Old code returned [origin, 'Guangzhou', 'HongKong', destination] every
// time regardless of actual graph state.
//
// New design:
//   1. Call the Java engine for the real Dijkstra shortest path.
//   2. Use the disruptions list to also push active disruptions into the
//      Java engine (so it actually reroutes around them).
//   3. AI (Gemini) is used for risk scoring and recommendations —
//      something it's actually good at — rather than just text parsing.

const { getShortestPath, pushEdgeDisruption } = require('./algorithmUtils');

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;

/**
 * Get an optimized route for a shipment, accounting for active disruptions.
 *
 * @param {Object}   shipment    - Mongoose Shipment document
 * @param {Object[]} disruptions - Active Disruption documents from MongoDB
 * @returns {Promise<Object>}    - Route result with AI risk assessment
 */
async function getOptimizedRoute(shipment, disruptions) {

  // Step 1: Push active disruptions into the Java engine so Dijkstra
  //         actually routes around them (not just the Node.js layer).
  const pushedEdges = [];
  for (const d of disruptions) {
    // Parse location field — supports "B->D" or "B,D" format
    const match = d.location.match(/([A-Z])\s*[->,]\s*([A-Z])/i);
    if (match) {
      const from = match[1].toUpperCase();
      const to   = match[2].toUpperCase();
      const pushResult = await pushEdgeDisruption(from, to, 'block');
      if (pushResult.ok) pushedEdges.push({ from, to });
    }
  }

  // Step 2: Get the real optimized route from the Java Dijkstra engine
  const routeResult = await getShortestPath(
    shipment.origin.toUpperCase(),
    shipment.destination.toUpperCase()
  );

  // Step 3: Unblock edges we pushed (disruptions are stored in MongoDB,
  //         not permanently in the Java engine's in-memory graph)
  for (const edge of pushedEdges) {
    await pushEdgeDisruption(edge.from, edge.to, 'unblock');
  }

  // Step 4: Use AI to assess risk and produce recommendations
  //         (this is where the AI adds real value beyond just routing)
  let aiAssessment = null;
  if (process.env.GEMINI_API_KEY && disruptions.length > 0) {
    aiAssessment = await assessRouteRisk(shipment, disruptions, routeResult);
  }

  const rerouted = routeResult.status === 'rerouted';

  return {
    shipment_id:     shipment.id,
    origin:          shipment.origin,
    destination:     shipment.destination,
    route:           routeResult.route,
    total_time:      routeResult.totalTime > 0 ? `${routeResult.totalTime} hours` : 'N/A',
    status:          routeResult.status,
    rerouted:        rerouted,
    disruptions_applied: pushedEdges.length,
    risk_score:      aiAssessment ? aiAssessment.riskScore   : (disruptions.length > 0 ? 0.6 : 0.1),
    recommendations: aiAssessment ? aiAssessment.recommendations : defaultRecommendations(disruptions),
    engine:          routeResult.status === 'bridge_unavailable' ? 'fallback' : 'java-dijkstra'
  };
}

/**
 * Ask Gemini to assess the route risk given current disruptions.
 * This is what AI is actually good for in this system — not just parsing.
 */
async function assessRouteRisk(shipment, disruptions, routeResult) {
  const prompt =
    `You are a logistics risk analyst.\n\n` +
    `Shipment: ${shipment.cargo_type} from ${shipment.origin} to ${shipment.destination}\n` +
    `Computed route: ${routeResult.route.join(' -> ')}\n` +
    `Route status: ${routeResult.status}\n` +
    `Active disruptions:\n` +
    disruptions.map(d =>
      `  - ${d.type} at ${d.location} (severity: ${d.severity})`
    ).join('\n') + '\n\n' +
    `Respond in EXACTLY this format. No extra text:\n` +
    `RISK_SCORE: <decimal 0.0 to 1.0>\n` +
    `REC_1: <short recommendation>\n` +
    `REC_2: <short recommendation>\n` +
    `REC_3: <short recommendation>`;

  try {
    const response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      }),
      signal: AbortSignal.timeout(8000)
    });

    if (!response.ok) throw new Error(`Gemini HTTP ${response.status}`);

    const data    = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return parseRiskAssessment(rawText);

  } catch (err) {
    console.error('[aiUtils] Gemini risk assessment failed:', err.message);
    return null;
  }
}

function parseRiskAssessment(text) {
  const lines = text.split('\n');
  const get   = (key) => {
    const line = lines.find(l => l.toLowerCase().startsWith(key.toLowerCase() + ':'));
    return line ? line.substring(key.length + 1).trim() : null;
  };

  const riskStr = get('RISK_SCORE');
  const riskScore = riskStr ? Math.min(1, Math.max(0, parseFloat(riskStr))) : 0.5;

  return {
    riskScore,
    recommendations: [
      get('REC_1'),
      get('REC_2'),
      get('REC_3')
    ].filter(Boolean)
  };
}

function defaultRecommendations(disruptions) {
  if (disruptions.length === 0) return [];
  return disruptions.map(d =>
    `Monitor ${d.type} disruption at ${d.location} (${d.severity} severity)`
  );
}

module.exports = { getOptimizedRoute };
