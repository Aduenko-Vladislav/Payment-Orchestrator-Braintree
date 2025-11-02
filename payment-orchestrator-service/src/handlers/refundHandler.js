import { mapTransaction } from "../utils/mappers.js";
import { handleIdempotency, processTransaction } from "../utils/idempotency.js";
import logger from "../logger/winstonLogging.js";
import { gateway } from "../braintree/client.js";

export async function handleRefund(req, res) {
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

  if (await handleIdempotency(idempotencyKey, callbackUrl, res, "refund"))
    return;

  try {
    const btResult = await gateway.transaction.refund(transactionId, amount);

    let result;
    const status = btResult?.transaction?.status;

    let resultType;
    if (status === "settlement_pending" || status === "settling") {
      resultType = "pending";
    } else if (btResult.success && btResult.transaction) {
      resultType = "success";
    } else {
      resultType = "failed";
    }

    switch (resultType) {
      case "pending":
        result = mapTransaction({
          merchantReference,
          operation: "refund",
          amount,
          currency: "EUR",
          transactionId: btResult.transaction.id,
          status: "PENDING",
        });
        logger.info(`Braintree refund pending: txn=${btResult.transaction.id}`);
        break;

      case "success":
        result = mapTransaction({
          merchantReference,
          operation: "refund",
          amount,
          currency: "EUR",
          transactionId: btResult.transaction.id,
          status: "SUCCESS",
        });
        logger.info(`Braintree refund success: txn=${btResult.transaction.id}`);
        break;

      case "failed":
      default:
        result = mapTransaction({
          merchantReference,
          operation: "refund",
          amount,
          currency: "EUR",
          code: btResult?.transaction?.processorResponseCode || "BT_ERROR",
          message:
            btResult?.transaction?.processorResponseText ||
            btResult?.message ||
            "Braintree refund failed",
          status: "FAILED",
        });
        logger.warn(`Braintree refund failed: ${btResult?.message}`);
        break;
    }

    await processTransaction({ idempotencyKey, callbackUrl, result, res });
  } catch (err) {
    logger.error(`Refund error: ${err.message}`);
    const result = mapTransaction({
      merchantReference,
      operation: "refund",
      amount,
      currency: "EUR",
      code: "EXCEPTION",
      message: err.message,
      status: "FAILED",
    });
    await processTransaction({ idempotencyKey, callbackUrl, result, res });
  }
}
