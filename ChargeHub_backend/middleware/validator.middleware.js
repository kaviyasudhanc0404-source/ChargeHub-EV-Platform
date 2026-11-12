const { validationResult } = require('express-validator');

// Respond with the first validation error message (plus the full list)
exports.validate = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();

  const list = errors.array().map(err => ({ field: err.path, message: err.msg }));
  res.status(422).json({ success: false, message: list[0].message, errors: list });
};
