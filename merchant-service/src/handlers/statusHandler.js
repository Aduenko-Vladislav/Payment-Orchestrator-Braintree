import logger from "../logger/winstonLogging.js";

export function createStatusHandler(storage) {
  return async (req, res) => {
    const ref = req.params.merchantReference;
    const operation = req.query.operation || "sale";

    const result = await storage.get(ref, operation);
    if (!result) {
      logger.warn(`Status not found: ref=${ref} operation=${operation}`);
      return res.status(404).json({
        error: "Not found",
        merchantReference: ref,
        operation,
      });
    }
    return res.json(result);
  };
}
