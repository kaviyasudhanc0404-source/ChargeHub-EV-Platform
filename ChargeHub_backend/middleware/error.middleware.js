// Error with an HTTP status that is safe to show to the client; `reason` is a code the app can act on
class AppError extends Error {
  constructor(status, message, reason) {
    super(message);
    this.status = status;
    this.reason = reason;
  }
}

// Wraps async route handlers so rejected promises reach the error handler
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const notFound = (req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
};

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let status = err.status || 500;
  let message = err.message;

  if (err.name === 'ValidationError') {
    status = 400;
    message = Object.values(err.errors).map(e => e.message).join(', ');
  } else if (err.name === 'CastError') {
    status = 400;
    message = 'Invalid id';
  } else if (err.code === 11000) {
    status = 409;
    const fields = Object.keys(err.keyValue || {});
    message = fields.some(f => f.startsWith('email'))
      ? 'This email is already used by another account'
      : `${fields.join(', ') || 'Value'} already exists`;
  } else if (err.type === 'entity.too.large') {
    status = 413;
    message = 'Request is too large';
  }

  // An AppError is an expected outcome whose message is meant for the user (e.g. maintenance, email or assistant
  // unavailable). Anything else at 500+ is a bug: logged, and its details hidden from users in production.
  if (status >= 500 && !(err instanceof AppError)) {
    console.error(err);
    if (process.env.NODE_ENV === 'production') message = 'Internal Server Error';
  }

  res.status(status).json({ success: false, message, ...(err.reason && { reason: err.reason }) });
};

module.exports = { AppError, asyncHandler, notFound, errorHandler };
