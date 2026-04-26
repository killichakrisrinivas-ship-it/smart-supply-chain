// services/disruptionService.js
//
// FIX: Disruptions are now pushed to the Java routing engine (via the bridge)
//      in addition to being saved in MongoDB.  This means the graph actually
//      reroutes when a disruption is posted — not just stored as a record.

const Disruption = require('../models/Disruption');
const Shipment   = require('../models/Shipment');
const { pushEdgeDisruption, pushCongestion } = require('../utils/algorithmUtils');

async function createDisruption(data) {
  const disruption = new Disruption(data);

  // Find shipments whose route passes through the disrupted location
  const shipments = await Shipment.find({
    status: 'in_transit',
    $or: [
      { origin:        data.location },
      { destination:   data.location },
      { current_route: data.location }
    ]
  });

  disruption.affected_shipments = shipments.map(s => s._id);

  for (const shipment of shipments) {
    shipment.status = 'disrupted';
    await shipment.save();
  }

  const saved = await disruption.save();

  // Push disruption into the live Java routing engine:
  //   - If location is an edge ("B->D"), block that edge.
  //   - If location is a node ("C"), apply congestion factor based on severity.
  const edgeMatch = data.location.match(/([A-Z])\s*[->,]\s*([A-Z])/i);
  if (edgeMatch) {
    const from = edgeMatch[1].toUpperCase();
    const to   = edgeMatch[2].toUpperCase();
    await pushEdgeDisruption(from, to, 'block');
    console.log(`[disruptionService] Pushed edge block ${from}->${to} to Java engine`);
  } else if (/^[A-Z]$/i.test(data.location.trim())) {
    // Single-node location — apply congestion
    const factorMap = { low: 1.5, medium: 2.5, high: 4.0 };
    const factor    = factorMap[data.severity] || 2.0;
    await pushCongestion(data.location.trim().toUpperCase(), factor);
    console.log(`[disruptionService] Pushed congestion x${factor} on node ${data.location} to Java engine`);
  }

  return saved;
}

module.exports = { createDisruption };
