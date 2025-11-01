import axios from "axios";
import dotenv from "dotenv";
import logger from "../logger/winstonLogging.js";
import { hmacSignature } from "../security/security.js";

dotenv.config();

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
  const secret = process.env.CALLBACK_SECRET;
  const raw = Buffer.from(JSON.stringify(payload));

  try {
    await axios.post(callbackUrl, raw, {
      timeout: 8000,
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(raw),
        "X-Signature": hmacSignature(raw, secret),
      },
    });
    logger.info(`Webhook sent successfully to ${callbackUrl}`);
  } catch (e) {
    logger.error(`Webhook failed to ${callbackUrl}: ${e.message}`);
  }
}
