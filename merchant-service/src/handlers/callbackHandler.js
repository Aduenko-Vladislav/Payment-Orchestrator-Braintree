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

    const callbackType = !prev
      ? "new"
      : statusChanged
      ? "statusChanged"
      : !payloadChanged
      ? "idempotent"
      : "merged";

    switch (callbackType) {
      case "new":
        logger.info(
          `Callback received: ref=${ref} operation=${operation} status=${incoming.status}`
        );
        break;
      case "statusChanged":
        logger.info(
          `Callback updated: ref=${ref} operation=${operation} ${prev.status} -> ${merged.status}`
        );
        break;
      case "idempotent":
        logger.info(
          `Callback idempotent: ref=${ref} operation=${operation} status=${incoming.status} unchanged`
        );
        break;
      case "merged":
        logger.info(
          `Callback merged: ref=${ref} operation=${operation} status=${incoming.status} details updated`
        );
        break;
    }

    await storage.set(ref, merged, operation);
    return res.json({ ok: true });
  };
}
