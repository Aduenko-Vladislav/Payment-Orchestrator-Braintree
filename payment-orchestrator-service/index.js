import express from "express";
import dotenv from "dotenv";
import { mapSuccess, mapFailure } from "./src/utils/mappers.js";
import { validator } from "./src/middleware/validation.js";
import { saleSchema } from "./src/validation/saleSchema.js";
import { refundSchema } from "./src/validation/refundSchema.js";
import {
  handleIdempotency,
  processTransaction,
} from "./src/utils/idempotency.js";
import logger from "./src/logger/winstonLogging.js";
import { gateway } from "./src/braintree/client.js";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = Number(process.env.PORT || 3002);

app.post("/orchestrator/sale", validator(saleSchema), async (req, res) => {
  const {
    amount,
    currency,
    paymentMethodNonce,
    merchantReference,
    idempotencyKey,
    callbackUrl,
  } = req.body;

  logger.info(
    `Sale request received: ref=${merchantReference}, amount=${amount}`
  );

  if (handleIdempotency(idempotencyKey, callbackUrl, res)) return;
  

  const transactionId = `stub_sale_${Date.now()}`;
  const result = mapSuccess({
    merchantReference,
    operation: "sale",
    amount,
    currency,
    transactionId,
  });

  await processTransaction({ idempotencyKey, callbackUrl, result, res });
});


app.post("/orchestrator/refund", validator(refundSchema), async (req, res) => {
  const {
    transactionId,
    amount,
    merchantReference,
    idempotencyKey,
    callbackUrl,
  } = req.body;

  logger.info(
    `Refund request received: ref=${merchantReference}, amount=${amount}`
  );

  if (handleIdempotency(idempotencyKey, callbackUrl, res)) return;

  const result = mapSuccess({
    merchantReference,
    operation: "refund",
    amount,
    currency: "EUR",
    transactionId: `stub_refund_${Date.now()}`,
  });

  await processTransaction({ idempotencyKey, callbackUrl, result, res });
});

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use((err, req, res, next) => {
  const status = err.status || 500;
  logger.error(`HTTP ${status}: ${err.message}`);
  res.status(status).json({ error: { code: status, message: err.message } });
});

app.listen(PORT, () => logger.info(`Orchestrator (POS) running on :${PORT}`));
