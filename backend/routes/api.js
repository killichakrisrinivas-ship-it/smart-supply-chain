// routes/api.js
//
// FIX (review): Validation middleware was imported but not applied on routes.

const express    = require('express');
const router     = express.Router();

const routeController     = require('../controllers/routeController');
const shipmentController  = require('../controllers/shipmentController');
const disruptionController= require('../controllers/disruptionController');
const { validateShipment, validateDisruption } = require('../middleware/validation');

// ── Shipment ──────────────────────────────────────────────────────────────────
// FIX: validateShipment is now actually applied (was missing before)
router.post('/shipment',         validateShipment,   shipmentController.createShipment);
router.get( '/shipment/:shipmentId',                  shipmentController.getShipment);

// ── Routing ───────────────────────────────────────────────────────────────────
router.get('/route/:shipmentId',           routeController.getRoute);
router.get('/optimized-route/:shipmentId', routeController.getOptimizedRoute);

// ── Disruption ────────────────────────────────────────────────────────────────
// FIX: validateDisruption is now actually applied (was missing before)
router.post('/disruption', validateDisruption, disruptionController.createDisruption);

// ── Health check (useful for judges / judges asking "is this connected?") ─────
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

module.exports = router;
