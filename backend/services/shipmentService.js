const Shipment = require('../models/Shipment');

async function createShipment(data) {
  const shipment = new Shipment(data);
  return await shipment.save();
}

async function getShipment(id) {
  return await Shipment.findOne({ id });
}

module.exports = { createShipment, getShipment };