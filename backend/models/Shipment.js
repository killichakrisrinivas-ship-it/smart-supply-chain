const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const shipmentSchema = new mongoose.Schema({
  id: {
    type: String,
    default: () => `ship_${uuidv4().slice(0, 8)}`,
    unique: true
  },
  origin: { type: String, required: true },
  destination: { type: String, required: true },
  weight: { type: Number, required: true },
  cargo_type: { type: String, required: true },

  priority: { type: Number, default: 1, min: 1, max: 5 },

  status: {
    type: String,
    enum: ['planning', 'in_transit', 'disrupted', 'optimized', 'delivered'],
    default: 'planning'
  },

  current_route: [String]

}, { timestamps: true });

module.exports = mongoose.model('Shipment', shipmentSchema);