import logger from "../logger/winstonLogging.js";

export const failResponse = (res, status, message, merchantReference) => {
  logger.error(
    `${status} ${message} ref=${merchantReference ?? "not available"}`
  );
  return res.status(status).json({ error: message, merchantReference });
};

export const okResponse = (
  res,
  message,
  merchantReference,
  data = {},
  status = 200
) => {
  const logLine = message ?? "OK";
  const ref = merchantReference;
  logger.info(`${status} ${logLine}${ref ? ` ref=${ref}` : ""}`);
  return res
    .status(status)
    .json({ message: logLine, merchantReference: ref, ...data });
};
