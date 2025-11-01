import express from "express";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";
import { createOrchestratorClient } from "./src/utils/httpClient.js";
import logger from "./src/logger/winstonLogging.js";
import { errorHandler } from "./src/middleware/errors/errors.js";
import { validator } from "./src/middleware/validation.js";
import { paymentSchema } from "./src/validation/PaymentSchema.js";
import { refundSchema } from "./src/validation/refundSchema.js";
import { callbackSchema } from "./src/validation/callbackSchema.js";
import { verifyHmac } from "./src/middleware/security/verifySignature.js";
import { mergedResult } from "./src/payments/statusPayment.js";

dotenv.config();

const app = express();
app.use(
  express.json({
    limit: "1mb",
    verify: (req, _res, buf) => {
      req.rawBody = Buffer.from(buf);
    },
  })
);

const PORT = Number(process.env.PORT);
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL;

const store = new Map();

const httpOrchestrator = createOrchestratorClient();

// Starts a Sale
app.post("/merchant/payments", validator(paymentSchema), async (req, res) => {
  const { amount, currency, paymentMethodNonce, merchantReference } = req.body;

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
    logger.info(
      `202 Sale started ref=${merchantReference} idemKey=${idempotencyKey.slice(0,8)}`
    );
    return res.status(202).json({
      message: "Sale started",
      merchantReference,
      idempotencyKey,
    });
  } catch (err) {
    const status = err.response?.status ?? 502;
    const body = err.response?.data ?? {
      error: "Failed to reach orchestrator",
      merchantReference,
    };
    logger.error(
      `Sale error: status=${status} ref=${merchantReference} msg=${err.message}`
    );
    return res.status(status).json(body);
  }
});

// Starts a Refund
app.post("/merchant/refunds", validator(refundSchema), async (req, res) => {
  const { transactionId, amount, merchantReference } = req.body;

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
    logger.info(
      `202 Refund started ref=${merchantReference} idemKey=${idempotencyKey.slice(0,8)}`
    );
    return res.status(202).json({
      message: "Refund started",
      merchantReference,
      idempotencyKey,
    });
  } catch (err) {
    const status = err.response?.status ?? 502;
    const body = err.response?.data ?? {
      error: "Failed to reach orchestrator",
      merchantReference,
    };
    logger.error(
      `Refund error: status=${status} ref=${merchantReference} msg=${err.message}`
    );
    return res.status(status).json(body);
  }
});

//  Webhook
app.post(
  "/merchant/callback",
  verifyHmac,
  validator(callbackSchema),
  (req, res) => {
    const incoming = req.body;
    const ref = incoming.merchantReference;
    const prev = store.get(ref);

    const merged = mergedResult(prev, incoming);

    const statusChanged = prev ? prev.status !== merged.status : true;
    const payloadChanged = JSON.stringify(prev) !== JSON.stringify(merged);

    if (!prev) {
      logger.info(`Callback received: ref=${ref} status=${incoming.status}`);
    } else if (statusChanged) {
      logger.info(
        `Callback updated: ref=${ref} ${prev.status} -> ${merged.status}`
      );
    } else if (!payloadChanged) {
      logger.info(
        `Callback idempotent: ref=${ref} status=${incoming.status} unchanged`
      );
    } else {
      logger.info(
        `Callback merged: ref=${ref} status=${incoming.status} details updated`
      );
    }

    store.set(ref, merged);
    return res.json({ ok: true });
  }
);

// Check status
app.get("/merchant/status/:merchantReference", (req, res) => {
  const ref = req.params.merchantReference;
  const result = store.get(ref);
  if (!result) {
    logger.warn(`Status not found: ref=${ref}`);
    return res.status(404).json({ error: "Not found", merchantReference: ref });
  }
  return res.json(result);
});

// Healthcheck
app.get("/health", (_req, res) => res.json({ ok: true }));

app.use(errorHandler);
app.listen(PORT, () => logger.info(`Merchant Service running on :${PORT}`));
