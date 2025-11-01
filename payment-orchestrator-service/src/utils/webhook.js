import axios from "axios";
import dotenv from "dotenv";
import axiosRetry from "axios-retry";
import logger from "../logger/winstonLogging.js";
import { hmacSignature } from "../security/security.js";

dotenv.config();

const webhookClient = axios.create({ timeout: 8000 });

axiosRetry(webhookClient, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  shouldResetTimeout: true,
  retryCondition: (error) =>
    axiosRetry.isNetworkError(error) ||
    (error.response?.status >= 500 && error.response?.status < 600),
  onRetry: (retryCount, error, requestConfig) => {
    logger.warn(
      `Webhook retry ${retryCount}/3 -> ${requestConfig?.url} reason=${error?.message}`
    );
  },
});

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
  const sig = hmacSignature(raw, secret);

  try {
    await webhookClient.post(callbackUrl, raw, {
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(raw),
        "X-Signature": sig,
      },
    });
    logger.info(`Webhook sent successfully to ${callbackUrl}`);
  } catch (e) {
    logger.error(`Webhook failed to ${callbackUrl}: ${e.message}`);
  }
}
