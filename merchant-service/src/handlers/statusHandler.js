import logger from "../logger/winstonLogging.js";

export function createStatusHandler(store) {
  return (req, res) => {
    const ref = req.params.merchantReference;
    const result = store.get(ref);
    if (!result) {
      logger.warn(`Status not found: ref=${ref}`);
      return res
        .status(404)
        .json({ error: "Not found", merchantReference: ref });
    }
    return res.json(result);
  };
}
