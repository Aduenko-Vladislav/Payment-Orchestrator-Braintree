import { v4 as uuidv4 } from "uuid";
import logger from "../logger/winstonLogging.js";
import { createOrchestratorClient } from "../utils/httpClient.js";

export function createPaymentHandler(publicBaseUrl) {
  return async (req, res) => {
    const { amount, currency, paymentMethodNonce, merchantReference } =
      req.body;

    const idempotencyKey = uuidv4();
    const httpOrchestrator = createOrchestratorClient();
    const payload = {
      amount,
      currency,
      paymentMethodNonce,
      merchantReference,
      idempotencyKey,
      callbackUrl: `${publicBaseUrl}/merchant/callback`,
    };

    try {
      await httpOrchestrator.post("/orchestrator/sale", payload);
      logger.info(
        `202 Sale started ref=${merchantReference} idemKey=${idempotencyKey.slice(
          0,
          8
        )}`
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
  };
}
