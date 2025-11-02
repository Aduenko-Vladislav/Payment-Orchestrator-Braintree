import { mapTransaction } from "../utils/mappers.js";
import { handleIdempotency, processTransaction } from "../utils/idempotency.js";
import logger from "../logger/winstonLogging.js";
import { gateway } from "../braintree/client.js";

export async function handleSale(req, res) {
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

  if (await handleIdempotency(idempotencyKey, callbackUrl, res, "sale")) return;

  try {
    const btResult = await gateway.transaction.sale({
      amount,
      paymentMethodNonce,
      options: { submitForSettlement: true },
    });

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
          operation: "sale",
          amount,
          currency,
          transactionId: btResult.transaction.id,
          status: "PENDING",
        });
        logger.info(`Braintree sale pending: txn=${btResult.transaction.id}`);
        break;

      case "success":
        result = mapTransaction({
          merchantReference,
          operation: "sale",
          amount,
          currency,
          transactionId: btResult.transaction.id,
          status: "SUCCESS",
        });
        logger.info(`Braintree sale success: txn=${btResult.transaction.id}`);
        break;

      case "failed":
      default:
        result = mapTransaction({
          merchantReference,
          operation: "sale",
          amount,
          currency,
          code: btResult?.transaction?.processorResponseCode || "BT_ERROR",
          message:
            btResult?.transaction?.processorResponseText ||
            btResult?.message ||
            "Braintree sale failed",
          status: "FAILED",
        });
        logger.warn(`Braintree sale failed: ${btResult?.message}`);
        break;
    }

    await processTransaction({ idempotencyKey, callbackUrl, result, res });
  } catch (err) {
    logger.error(`Sale error: ${err.message}`);
    const result = mapTransaction({
      merchantReference,
      operation: "sale",
      amount,
      currency,
      code: "EXCEPTION",
      message: err.message,
      status: "FAILED",
    });
    await processTransaction({ idempotencyKey, callbackUrl, result, res });
  }
}
