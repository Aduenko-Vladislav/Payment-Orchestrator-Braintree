import express from "express";
import dotenv from "dotenv";
import logger from "./src/logger/winstonLogging.js";
import { errorHandler } from "./src/middleware/errors/errors.js";
import { validator } from "./src/middleware/validation.js";
import { paymentSchema } from "./src/validation/PaymentSchema.js";
import { refundSchema } from "./src/validation/refundSchema.js";
import { callbackSchema } from "./src/validation/callbackSchema.js";
import { verifyHmac } from "./src/middleware/security/verifySignature.js";
import { createPaymentHandler } from "./src/handlers/paymentHandler.js";
import { createRefundHandler } from "./src/handlers/refundHandler.js";
import { createCallbackHandler } from "./src/handlers/callbackHandler.js";
import { createStatusHandler } from "./src/handlers/statusHandler.js";

dotenv.config();

const app = express();
app.use(
  express.json({
    limit: "1mb",
    verify: (req, _res, buf) => {
      req.rawBody = Buffer.from(buf);
    },
  })
);

const PORT = Number(process.env.PORT);
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL;

const store = new Map();

// Starts a Sale
app.post(
  "/merchant/payments",
  validator(paymentSchema),
  createPaymentHandler(PUBLIC_BASE_URL)
);

// Starts a Refund
app.post(
  "/merchant/refunds",
  validator(refundSchema),
  createRefundHandler(PUBLIC_BASE_URL)
);

// Webhook
app.post(
  "/merchant/callback",
  verifyHmac,
  validator(callbackSchema),
  createCallbackHandler(store)
);
//check Status
app.get("/merchant/status/:merchantReference", createStatusHandler(store));

// Healthcheck
app.get("/health", (_req, res) => res.json({ ok: true }));

app.use(errorHandler);
app.listen(PORT, () => logger.info(`Merchant Service running on :${PORT}`));
