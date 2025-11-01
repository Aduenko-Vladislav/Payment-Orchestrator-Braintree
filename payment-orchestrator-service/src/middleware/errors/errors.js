import logger from "../../logger/winstonLogging.js";
export function createError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export function errorHandler(error, req, res, next) {
  const status = error.status ?? 500;
  logger.error(`HTTP ${status}: ${error.message}`);
  const message = error.message ?? "Internal server error";
  logger.error(`[${req.method}] ${req.url} → ${status}: ${message}`);
  res.status(status).json({ error: { code: status, message: message } });
}
