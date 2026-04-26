// controllers/shipmentController.js

const service = require('../services/shipmentService');

exports.createShipment = async (req, res, next) => {
  try {
    const shipment = await service.createShipment(req.body);
    res.status(201).json({ shipment_id: shipment.id, status: shipment.status });
  } catch (err) {
    next(err);
  }
};

exports.getShipment = async (req, res, next) => {
  try {
    const shipment = await service.getShipment(req.params.shipmentId);
    if (!shipment) return res.status(404).json({ error: 'Shipment not found' });
    res.json(shipment);
  } catch (err) {
    next(err);
  }
};
