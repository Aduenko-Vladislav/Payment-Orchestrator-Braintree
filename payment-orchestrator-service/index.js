import express from "express";
import dotenv from "dotenv";
import { errorHandler } from "./src/middleware/errors/errors.js";
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

  try {
    const btResult = await gateway.transaction.sale({
      amount,
      paymentMethodNonce,
      options: { submitForSettlement: true },
    });

    let result;
    const status = btResult?.transaction?.status;

    if (status === "settlement_pending" || status === "settling") {
      result = mapPending({
        merchantReference,
        operation: "sale",
        amount,
        currency,
        transactionId: btResult.transaction.id,
      });
      logger.info(`Braintree refund pending: txn=${btResult.transaction.id}`);
    } else if (btResult.success && btResult.transaction) {
      result = mapSuccess({
        merchantReference,
        operation: "sale",
        amount,
        currency,
        transactionId: btResult.transaction.id,
      });
      logger.info(`Braintree sale success: txn=${btResult.transaction.id}`);
    } else {
      result = mapFailure({
        merchantReference,
        operation: "sale",
        amount,
        currency,
        code: btResult?.transaction?.processorResponseCode || "BT_ERROR",
        message:
          btResult?.transaction?.processorResponseText ||
          btResult?.message ||
          "Braintree sale failed",
      });
      logger.warn(`Braintree sale failed: ${btResult?.message}`);
    }

    await processTransaction({ idempotencyKey, callbackUrl, result, res });
  } catch (err) {
    logger.error(`Sale error: ${err.message}`);
    const result = mapFailure({
      merchantReference,
      operation: "sale",
      amount,
      currency,
      code: "EXCEPTION",
      message: err.message,
    });
    await processTransaction({ idempotencyKey, callbackUrl, result, res });
  }
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
    `Refund request received: ref=${merchantReference}, txn=${transactionId}, amount=${amount}`
  );

  if (handleIdempotency(idempotencyKey, callbackUrl, res)) return;

  try {
    const btResult = await gateway.transaction.refund(transactionId, amount);

    let result;
    const status = btResult?.transaction?.status;
    if (status === "settlement_pending" || status === "settling") {
      result = mapPending({
        merchantReference,
        operation: "refund",
        amount,
        currency,
        transactionId: btResult.transaction.id,
      });
      logger.info(`Braintree refund pending: txn=${btResult.transaction.id}`);
    } else if (btResult.success && btResult.transaction) {
      result = mapSuccess({
        merchantReference,
        operation: "refund",
        amount,
        currency: "EUR",
        transactionId: btResult.transaction.id,
      });
      logger.info(`Braintree refund success: txn=${btResult.transaction.id}`);
    } else {
      result = mapFailure({
        merchantReference,
        operation: "refund",
        amount,
        currency: "EUR",
        code: btResult?.transaction?.processorResponseCode || "BT_ERROR",
        message:
          btResult?.transaction?.processorResponseText ||
          btResult?.message ||
          "Braintree refund failed",
      });
      logger.warn(`Braintree refund failed: ${btResult?.message}`);
    }

    await processTransaction({ idempotencyKey, callbackUrl, result, res });
  } catch (err) {
    logger.error(`Refund error: ${err.message}`);
    const result = mapFailure({
      merchantReference,
      operation: "refund",
      amount,
      currency: "EUR",
      code: "EXCEPTION",
      message: err.message,
    });
    await processTransaction({ idempotencyKey, callbackUrl, result, res });
  }
});

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use(errorHandler);
app.listen(PORT, () => logger.info(`Orchestrator (POS) running on :${PORT}`));
