import logger from "../logger/winstonLogging.js";
import { mergedResult } from "../payments/statusPayment.js";

export function createCallbackHandler(storage) {
  return async (req, res) => {
    const incoming = req.body;
    const ref = incoming.merchantReference;
    const operation = incoming.operation || "sale";

    const prev = await storage.get(ref, operation);
    const merged = mergedResult(prev, incoming);

    const statusChanged = prev ? prev.status !== merged.status : true;
    const payloadChanged = JSON.stringify(prev) !== JSON.stringify(merged);

    if (!prev) {
      logger.info(
        `Callback received: ref=${ref} operation=${operation} status=${incoming.status}`
      );
    } else if (statusChanged) {
      logger.info(
        `Callback updated: ref=${ref} operation=${operation} ${prev.status} -> ${merged.status}`
      );
    } else if (!payloadChanged) {
      logger.info(
        `Callback idempotent: ref=${ref} operation=${operation} status=${incoming.status} unchanged`
      );
    } else {
      logger.info(
        `Callback merged: ref=${ref} operation=${operation} status=${incoming.status} details updated`
      );
    }

    await storage.set(ref, merged, operation);
    return res.json({ ok: true });
  };
}
