import { v4 as uuidv4 } from "uuid";
import logger from "../logger/winstonLogging.js";
import { createOrchestratorClient } from "../utils/httpClient.js";

export function createRefundHandler(publicBaseUrl) {
  return async (req, res) => {
    const { transactionId, amount, merchantReference } = req.body;

    const idempotencyKey = uuidv4();
    const httpOrchestrator = createOrchestratorClient();
    const payload = {
      transactionId,
      amount,
      merchantReference,
      idempotencyKey,
      callbackUrl: `${publicBaseUrl}/merchant/callback`,
    };

    try {
      await httpOrchestrator.post("/orchestrator/refund", payload);
      logger.info(
        `202 Refund started ref=${merchantReference} idemKey=${idempotencyKey.slice(
          0,
          8
        )}`
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
  };
}
