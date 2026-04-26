// controllers/routeController.js

const { getRoute }          = require('../services/routeService');
const { getOptimizedRoute } = require('../utils/aiUtils');
const Shipment              = require('../models/Shipment');
const Disruption            = require('../models/Disruption');

const getRouteController = async (req, res, next) => {
  try {
    const data = await getRoute(req.params.shipmentId);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

const getOptimizedRouteController = async (req, res, next) => {
  try {
    const shipment = await Shipment.findOne({ id: req.params.shipmentId });

    if (!shipment) {
      return res.status(404).json({ error: 'Shipment not found' });
    }

    const now = new Date();
    const disruptions = await Disruption.find({
      status:     'active',
      start_time: { $lte: now },
      end_time:   { $gte: now }
    });

    const optimized = await getOptimizedRoute(shipment, disruptions);
    res.json(optimized);

  } catch (err) {
    next(err);
  }
};

module.exports = {
  getRoute:           getRouteController,
  getOptimizedRoute:  getOptimizedRouteController
};
