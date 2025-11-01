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
      `202 Sale started ref=${merchantReference} idemKey=${idempotencyKey}`
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
      `202 Refund started ref=${merchantReference} idemKey=${idempotencyKey}`
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
    const result = req.body;

    const prev = store.get(result.merchantReference);
    if (prev) {
      logger.info(
        `Callback duplicate: ref=${result.merchantReference} (overwrite)`
      );
    }

    store.set(result.merchantReference, result);
    logger.info(
      `Callback received: ref=${result.merchantReference} status=${result.status}`
    );
    return res.json({ ok: true });
  }
);

// Check status
app.get("/merchant/status/:merchantReference", (req, res) => {
  const result = store.get(req.params.merchantReference);
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
