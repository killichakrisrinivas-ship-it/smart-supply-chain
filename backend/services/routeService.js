// services/routeService.js
//
// FIX (review): Old code called algorithmUtils.getShortestPath which returned
//               a hardcoded static array.  Now calls the real Java bridge.

const { getShortestPath } = require('../utils/algorithmUtils');
const Shipment = require('../models/Shipment');

async function getRoute(shipmentId) {
  const shipment = await Shipment.findOne({ id: shipmentId });
  if (!shipment) throw new Error('Shipment not found');

  const result = await getShortestPath(
    shipment.origin.toUpperCase(),
    shipment.destination.toUpperCase()
  );

  // Persist the computed route back to the shipment document
  if (result.status !== 'bridge_unavailable' && result.route.length > 0) {
    shipment.current_route = result.route;
    shipment.status        = 'in_transit';
    await shipment.save();
  }

  return {
    shipment_id: shipment.id,
    origin:      shipment.origin,
    destination: shipment.destination,
    route:       result.route,
    total_time:  result.totalTime > 0 ? `${result.totalTime} hours` : 'N/A',
    status:      result.status,
    engine:      result.status === 'bridge_unavailable' ? 'fallback' : 'java-dijkstra'
  };
}

module.exports = { getRoute };
