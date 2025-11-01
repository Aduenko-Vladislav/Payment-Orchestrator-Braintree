import logger from "../logger/winstonLogging.js";
import { mergedResult } from "../payments/statusPayment.js";

export function createCallbackHandler(store) {
  return (req, res) => {
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
  };
}
