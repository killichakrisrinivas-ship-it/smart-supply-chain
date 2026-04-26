// middleware/validation.js
// FIX (review): "You imported validation.js but I don't see strong enforcement.
//               User input rendered directly with ${req.body.origin} — no validation."

/**
 * Sanitise a string: trim whitespace, strip HTML/script tags, limit length.
 */
function sanitise(value, maxLen = 100) {
  if (typeof value !== 'string') return '';
  return value
    .trim()
    .replace(/<[^>]*>/g, '')   // strip HTML tags
    .replace(/['"`;]/g, '')    // strip SQL/JS injection chars
    .slice(0, maxLen);
}

exports.validateShipment = (req, res, next) => {
  const { origin, destination, weight, cargo_type } = req.body;

  if (!origin || !destination || weight === undefined || !cargo_type) {
    return res.status(400).json({
      error: 'Missing required fields: origin, destination, weight, cargo_type'
    });
  }

  const parsedWeight = parseFloat(weight);
  if (isNaN(parsedWeight) || parsedWeight <= 0) {
    return res.status(400).json({ error: 'weight must be a positive number' });
  }

  // Sanitise all string inputs — prevents XSS in HTML responses
  req.body.origin      = sanitise(origin);
  req.body.destination = sanitise(destination);
  req.body.cargo_type  = sanitise(cargo_type);
  req.body.weight      = parsedWeight;

  next();
};

exports.validateDisruption = (req, res, next) => {
  const { type, location, severity, start_time, end_time } = req.body;

  if (!type || !location || !severity || !start_time || !end_time) {
    return res.status(400).json({
      error: 'Missing required fields: type, location, severity, start_time, end_time'
    });
  }

  const validSeverities = ['low', 'medium', 'high'];
  if (!validSeverities.includes(severity.toLowerCase())) {
    return res.status(400).json({ error: 'severity must be low, medium, or high' });
  }

  const startDate = new Date(start_time);
  const endDate   = new Date(end_time);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return res.status(400).json({ error: 'start_time and end_time must be valid ISO dates' });
  }

  if (endDate <= startDate) {
    return res.status(400).json({ error: 'end_time must be after start_time' });
  }

  req.body.type     = sanitise(type);
  req.body.location = sanitise(location);
  req.body.severity = severity.toLowerCase();

  next();
};

/**
 * Error-handling middleware — catches async errors thrown in controllers.
 * Add as the last app.use() in app.js.
 */
exports.errorHandler = (err, req, res, next) => {
  console.error('[ERROR]', err.message);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
};
