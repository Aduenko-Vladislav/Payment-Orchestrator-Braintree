import { postWebhook } from "./webhook.js";
import logger from "../logger/winstonLogging.js";

const idemStore = new Map();

/**
 * Handles idempotency check - returns cached result if key exists
 * @param {string} idempotencyKey - Idempotency key
 * @param {string} callbackUrl - URL to send webhook to
 * @param {Object} res - Express response object
 * @returns {boolean} True if cached result was returned, false otherwise
 */
export function handleIdempotency(idempotencyKey, callbackUrl, res) {
  if (!idemStore.has(idempotencyKey)) {
    logger.debug(`Idempotency key not found: ${idempotencyKey}`);
    return false;
  }
  const cached = idemStore.get(idempotencyKey);
  logger.info(`Returning cached result for idempotency key: ${idempotencyKey}`);
  postWebhook(callbackUrl, cached);
  res.json({ ok: true, idempotent: true });
  return true;
}

/**
 * Processes transaction by storing in idempotency cache and sending webhook
 * @param {Object} params - Transaction processing parameters
 * @param {string} params.idempotencyKey - Idempotency key
 * @param {string} params.callbackUrl - URL to send webhook to
 * @param {Object} params.result - Transaction result object
 * @param {Object} params.res - Express response object
 */
export async function processTransaction({
  idempotencyKey,
  callbackUrl,
  result,
  res,
}) {
  if (idempotencyKey) {
    idemStore.set(idempotencyKey, result);
    logger.info(`Stored result for idempotency key: ${idempotencyKey}`);
  }
  logger.info(
    `Processing transaction: ${result.operation} for ${result.merchantReference}`
  );
  postWebhook(callbackUrl, result);
  res.json({ ok: true });
}
