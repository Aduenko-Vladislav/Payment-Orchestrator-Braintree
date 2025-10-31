import axios from "axios";
import logger from "../logger/winstonLogging.js";

/**
 * Sends a webhook notification to the callback URL
 * @param {string} callbackUrl - URL to send the webhook to
 * @param {Object} payload - Data to send in the webhook
 */
export async function postWebhook(callbackUrl, payload) {
  if (!callbackUrl) {
    logger.warn("Webhook called without callbackUrl");
    return;
  }
  try {
    await axios.post(callbackUrl, payload, {
      timeout: 8000,
      headers: { "Content-Type": "application/json" },
    });
    logger.info(`Webhook sent successfully to ${callbackUrl}`);
  } catch (e) {
    logger.error(`Webhook failed to ${callbackUrl}: ${e.message}`);
  }
}
