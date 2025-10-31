import express from "express";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";
import { createOrchestratorClient } from "./utils/httpClient.js";
import logger from "./logger/winstonLogging.js";
import { failResponse, okResponse } from "./utils/response.js";

dotenv.config();

const app = express();
app.use(express.json({ limit: "1mb" }));

const PORT = Number(process.env.PORT);
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL;

const store = new Map();

const httpOrchestrator = createOrchestratorClient();

// Starts a Sale
app.post("/merchant/payments", async (req, res) => {
  const { amount, currency, paymentMethodNonce, merchantReference } =
    req.body || {};

  if (!amount || !merchantReference || !paymentMethodNonce) {
    return failResponse(
      res,
      400,
      "amount, paymentMethodNonce, merchantReference are required",
      merchantReference
    );
  }

  const idempotencyKey = uuidv4();
  const payload = {
    amount,
    currency,
    paymentMethodNonce,
    merchantReference,
    idempotencyKey,
    callbackUrl: `${PUBLIC_BASE_URL}/merchant/callback`,
  };

  try {
    await httpOrchestrator.post("/orchestrator/sale", payload);
    return okResponse(
      res,
      "Sale started",
      merchantReference,
      { idempotencyKey },
      202
    );
  } catch (e) {
    return failResponse(
      res,
      502,
      "Failed to reach orchestrator",
      merchantReference
    );
  }
});

// Starts a Refund
app.post("/merchant/refunds", async (req, res) => {
  const { transactionId, amount, merchantReference } = req.body || {};
  if (!transactionId || !amount || !merchantReference) {
    return failResponse(
      res,
      400,
      "transactionId, amount, merchantReference are required",
      merchantReference
    );
  }

  const idempotencyKey = uuidv4();
  const payload = {
    transactionId,
    amount,
    merchantReference,
    idempotencyKey,
    callbackUrl: `${PUBLIC_BASE_URL}/merchant/callback`,
  };

  try {
    await httpOrchestrator.post("/orchestrator/refund", payload);
    return okResponse(
      res,
      "Refund started",
      merchantReference,
      { idempotencyKey },
      202
    );
  } catch (e) {
    return failResponse(
      res,
      502,
      "Failed to reach orchestrator",
      merchantReference
    );
  }
});

//  Webhook
app.post("/merchant/callback", (req, res) => {
  // HMAC validation
  const result = req.body || {};
  if (!result.merchantReference) {
    logger.warn("Callback without merchantReference");
    return failResponse(res, 400, "merchantReference is required in callback");
  }
  store.set(result.merchantReference, result);
  logger.info(
    `Callback received: ref=${result.merchantReference} status=${
      result.status ?? "unknown"
    }`
  );
  return res.json({ ok: true });
});

// Check status
app.get("/merchant/status/:merchantReference", (req, res) => {
  const result = store.get(req.params.merchantReference);
  if (!result)
    return failResponse(res, 404, "Not found", req.params.merchantReference);
  return res.json(result);
});

// Healthcheck
app.get("/health", (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => logger.info(`Merchant Service running on :${PORT}`));
