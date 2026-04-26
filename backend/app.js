// app.js

require('dotenv').config();

const express    = require('express');
const mongoose   = require('mongoose');
const cors       = require('cors');
const { randomUUID } = require('crypto');
const rateLimit  = require('express-rate-limit');

const apiRoutes  = require('./routes/api');
const Shipment   = require('./models/Shipment');
const Disruption = require('./models/Disruption');
const { getOptimizedRoute }  = require('./utils/aiUtils');
const { getGraphSnapshot }   = require('./utils/algorithmUtils');
const { validateShipment, errorHandler } = require('./middleware/validation');
const { createDisruption } = require('./services/disruptionService');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Database ──────────────────────────────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/supplychain')
  .then(() => console.log('[DB] MongoDB Connected'))
  .catch(err => console.error('[DB] Connection failed:', err.message));

// ── Rate Limiters ──────────────────────────────────────────────────────────────
const createLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests created from this IP, please try again after 15 minutes' }
});

// ── API ROUTES ────────────────────────────────────────────────────────────────

// ── CREATE SHIPMENT
app.post('/api/shipments', createLimiter, validateShipment, async (req, res, next) => {
  try {
    const id = 'ship_' + randomUUID();

    const newShipment = new Shipment({
      id,
      origin:      req.body.origin,
      destination: req.body.destination,
      weight:      req.body.weight,
      cargo_type:  req.body.cargo_type
    });

    await newShipment.save();
    
    res.status(201).json({
      message: 'Shipment created successfully',
      id,
      route: `${req.body.origin} → ${req.body.destination}`
    });
  } catch (err) {
    next(err);
  }
});

// ── GET SHIPMENT DETAILS
app.get('/api/shipments/:id', async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!/^ship_[a-f0-9-]+$/.test(id)) {
      return res.status(400).json({ error: 'Invalid shipment ID format' });
    }

    const shipment = await Shipment.findOne({ id });

    if (!shipment) {
      return res.status(404).json({ error: 'Shipment not found' });
    }

    const now = new Date();
    const disruptions = await Disruption.find({
      status:     'active',
      start_time: { $lte: now },
      end_time:   { $gte: now }
    });

    const result = await getOptimizedRoute(shipment, disruptions);

    res.json({
      shipment,
      routeResult: result
    });
  } catch (err) {
    next(err);
  }
});

// ── LIST ALL SHIPMENTS
app.get('/api/shipments', async (req, res, next) => {
  try {
    const data = await Shipment.find().sort({ createdAt: -1 }).limit(50);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// ── CREATE DISRUPTION
app.post('/api/disruptions', createLimiter, async (req, res, next) => {
  try {
    const { location, type, severity } = req.body;
    if (!location || !type || !severity) {
      return res.status(400).json({ error: 'Missing fields: location, type, severity required' });
    }

    const allowedTypes = ['flood', 'accident', 'roadblock'];
    if (!allowedTypes.includes(type)) {
      return res.status(400).json({ error: `Invalid type. Allowed types are: ${allowedTypes.join(', ')}` });
    }

    const disruption = new Disruption({
      type,
      location: String(location).slice(0, 50),
      severity,
      status: 'active',
      start_time: new Date(),
      end_time: new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 hours
    });

    await disruption.save();

    // Fire and forget to Java engine to avoid hanging
    createDisruption(disruption.toObject()).catch(err => {
      console.error('[Disruption] Failed to send to Java engine:', err.message);
    });

    res.status(201).json({
      message: 'Disruption applied successfully',
      disruption
    });
  } catch (err) {
    next(err);
  }
});

// ── GRAPH ENDPOINT
app.get('/api/graph', async (req, res, next) => {
  try {
    const snapshot = await Promise.race([
      getGraphSnapshot(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout connecting to Java routing engine')), 5000))
    ]);

    if (!snapshot) {
      return res.status(503).json({
        error: 'Java routing engine not reachable or returned empty response.'
      });
    }
    res.json(snapshot);
  } catch (err) {
    return res.status(503).json({ error: err.message });
  }
});

// ── Additional API routes ─────────────────────────────────────────────────────
app.use('/api', apiRoutes);

// ── Global error handler ──────────────────────────────────────────────────────
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[Server] Running on http://localhost:${PORT}`);
  console.log(`[Server] Java bridge expected at ${process.env.JAVA_BRIDGE_URL || 'http://localhost:8080'}`);
});
