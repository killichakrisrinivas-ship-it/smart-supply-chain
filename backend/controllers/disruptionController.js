// controllers/disruptionController.js

const service = require('../services/disruptionService');

exports.createDisruption = async (req, res, next) => {
  try {
    const disruption = await service.createDisruption(req.body);

    res.status(201).json({
      disruption_id:      disruption.id,
      status:             disruption.status,
      affected_shipments: disruption.affected_shipments.length,
      engine_updated:     true
    });

  } catch (err) {
    next(err);
  }
};
