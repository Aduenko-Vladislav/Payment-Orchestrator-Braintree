import crypto from "crypto";
import logger from "../../logger/winstonLogging.js";

export function verifyHmac(req, res, next) {
  try {
    const provided = (req.get("X-Signature") || "").trim();
    if (!provided) {
      logger.warn(`[HMAC] Missing X-Signature for ${req.originalUrl}`);
      return res.status(401).json({ error: "Missing X-Signature" });
    }

    const secret = process.env.CALLBACK_SECRET;
    if (!secret) {
      logger.error("[HMAC] Server misconfigured: CALLBACK_SECRET missing");
      return res
        .status(500)
        .json({ error: "Server misconfigured: no CALLBACK_SECRET" });
    }

    const raw = req.rawBody;
    if (!raw) {
      logger.error("[HMAC] Raw body not found");
      return res.status(400).json({ error: "Raw body not found" });
    }

    const computed = crypto
      .createHmac("sha256", secret)
      .update(raw)
      .digest("hex");

    const ok = crypto.timingSafeEqual(
      Buffer.from(provided, "hex"),
      Buffer.from(computed, "hex")
    );

    if (!ok) {
      logger.warn(`[HMAC] Invalid signature for ${req.originalUrl}`);
      return res.status(401).json({ error: "Invalid signature" });
    }
    logger.info(
      `[HMAC] Signature verified successfully for ${req.originalUrl}`
    );
    next();
  } catch (err) {
    logger.error(`[HMAC] Verification failed: ${err.message}`);
    return res.status(401).json({ error: "Invalid signature format" });
  }
}
