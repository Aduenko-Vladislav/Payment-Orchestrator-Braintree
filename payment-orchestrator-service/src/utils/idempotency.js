import { postWebhook } from "./webhook.js";
import logger from "../logger/winstonLogging.js";
import { createRedisIdempotencyStorage } from "../storage/redisIdempotencyStorage.js";
const idemStore = createRedisIdempotencyStorage();

/**
 * Handles idempotency check - returns cached result if key exists
 * @param {string} idempotencyKey - Idempotency key
 * @param {string} callbackUrl - URL to send webhook to
 * @param {Object} res - Express response object
 * @param {string} operation - Operation type: "sale" or "refund"
 * @returns {boolean} True if cached result was returned, false otherwise
 */
export async function handleIdempotency(
  idempotencyKey,
  callbackUrl,
  res,
  operation
) {
  if (!(await idemStore.has(idempotencyKey, operation))) {
    logger.debug(
      `Idempotency key not found: ${idempotencyKey.slice(
        0,
        8
      )} operation=${operation}`
    );
    return false;
  }
  const cached = await idemStore.get(idempotencyKey, operation);

  logger.info(
    `Returning cached result for idempotency key: ${idempotencyKey.slice(
      0,
      8
    )} operation=${operation}`
  );
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
    const operation = result.operation || "sale";
    await idemStore.set(idempotencyKey, result, operation);
    logger.info(
      `Stored result for idempotency key: ${idempotencyKey.slice(
        0,
        8
      )} operation=${operation}`
    );
  }
  logger.info(
    `Processing transaction: ${result.operation} for ${result.merchantReference}`
  );
  postWebhook(callbackUrl, result);
  res.json({ ok: true });
}
