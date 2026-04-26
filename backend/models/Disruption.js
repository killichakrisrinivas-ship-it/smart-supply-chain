const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const disruptionSchema = new mongoose.Schema({
  id: {
    type: String,
    default: () => `dis_${uuidv4().slice(0, 8)}`,
    unique: true
  },

  type: { type: String, required: true },
  location: { type: String, required: true },

  severity: {
    type: String,
    enum: ['low', 'medium', 'high'],
    required: true
  },

  status: {
    type: String,
    enum: ['active', 'resolved'],
    default: 'active'
  },

  start_time: { type: Date, required: true },
  end_time: { type: Date, required: true },

  affected_shipments: [
    { type: mongoose.Schema.Types.ObjectId, ref: 'Shipment' }
  ]

}, { timestamps: true });

module.exports = mongoose.model('Disruption', disruptionSchema);