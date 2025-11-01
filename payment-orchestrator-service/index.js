import express from "express";
import dotenv from "dotenv";
import { errorHandler } from "./src/middleware/errors/errors.js";
import { validator } from "./src/middleware/validation.js";
import { saleSchema } from "./src/validation/saleSchema.js";
import { refundSchema } from "./src/validation/refundSchema.js";
import { handleSale } from "./src/handlers/saleHandler.js";
import { handleRefund } from "./src/handlers/refundHandler.js";
import logger from "./src/logger/winstonLogging.js";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = Number(process.env.PORT || 3002);

app.post("/orchestrator/sale", validator(saleSchema), handleSale);

app.post("/orchestrator/refund", validator(refundSchema), handleRefund);

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use(errorHandler);
app.listen(PORT, () => logger.info(`Orchestrator (POS) running on :${PORT}`));
