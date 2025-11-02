import logger from "../logger/winstonLogging.js";

export function createStatusHandler(storage) {
  return async (req, res, next) => {
    try {
      const { merchantReference } = req.params;
      const { operation } = req.query;

      const raw = await storage.get(merchantReference, operation);

      if (!raw) {
        logger.info(`Status pending: ref=${merchantReference} operation=${operation}`);
        return res.status(202).json({
          merchantReference,
          operation,
          status: "PENDING",
          message: "Result not available yet. Try again later.",
        });
      }

      const result = typeof raw === "string" ? JSON.parse(raw) : raw;
      return res.json(result);
    } catch (err) {
      next(err);
    }
  };
}