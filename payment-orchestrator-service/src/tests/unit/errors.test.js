import { describe, test, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import { errorHandler } from "../../middleware/errors/errors.js";
import { validator } from "../../middleware/validation.js";
import { saleSchema } from "../../validation/saleSchema.js";
import { refundSchema } from "../../validation/refundSchema.js";
import logger from "../../logger/winstonLogging.js";

vi.mock("../../logger/winstonLogging.js", () => ({
  default: {
    error: vi.fn(),
  },
}));

describe("validation middleware with saleSchema and refundSchema", () => {
  let app;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
  });

  describe("/orchestrator/sale validation", () => {
    test("returns 400 when required fields are missing", async () => {
      app.post("/orchestrator/sale", validator(saleSchema), (req, res) => {
        res.json({ ok: true });
      });
      app.use(errorHandler);

      const res = await request(app).post("/orchestrator/sale").send({});

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(400);
      expect(res.body.error.message).toContain("amount");
      expect(res.body.error.message).toContain("paymentMethodNonce");
      expect(res.body.error.message).toContain("merchantReference");
      expect(res.body.error.message).toContain("idempotencyKey");
      expect(res.body.error.message).toContain("callbackUrl");
      expect(res.body.error.message).toMatch(/;.*;/);

      expect(logger.error).toHaveBeenCalledTimes(2);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("HTTP 400:")
      );
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("[POST] /orchestrator/sale → 400:")
      );
    });

    test("returns 400 when amount is invalid format", async () => {
      app.post("/orchestrator/sale", validator(saleSchema), (req, res) => {
        res.json({ ok: true });
      });
      app.use(errorHandler);

      const res = await request(app).post("/orchestrator/sale").send({
        amount: "invalid",
        currency: "EUR",
        paymentMethodNonce: "fake-nonce",
        merchantReference: "order_1",
        idempotencyKey: "00000000-0000-4000-8000-000000000001",
        callbackUrl: "https://example.com/callback",
      });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(400);
      expect(res.body.error.message).toContain("amount");
      expect(res.body.error.message).toContain(
        "must be a string like (max 2 decimals)"
      );
    });

    test("returns 400 when amount has more than 2 decimals", async () => {
      app.post("/orchestrator/sale", validator(saleSchema), (req, res) => {
        res.json({ ok: true });
      });
      app.use(errorHandler);

      const res = await request(app).post("/orchestrator/sale").send({
        amount: "10.999",
        currency: "EUR",
        paymentMethodNonce: "fake-nonce",
        merchantReference: "order_1",
        idempotencyKey: "00000000-0000-4000-8000-000000000001",
        callbackUrl: "https://example.com/callback",
      });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(400);
      expect(res.body.error.message).toContain("amount");
    });

    test("returns 400 when currency is not 3 letters", async () => {
      app.post("/orchestrator/sale", validator(saleSchema), (req, res) => {
        res.json({ ok: true });
      });
      app.use(errorHandler);

      const res = await request(app).post("/orchestrator/sale").send({
        amount: "10.50",
        currency: "EU",
        paymentMethodNonce: "fake-nonce",
        merchantReference: "order_1",
        idempotencyKey: "00000000-0000-4000-8000-000000000001",
        callbackUrl: "https://example.com/callback",
      });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(400);
      expect(res.body.error.message).toContain("currency");
      expect(res.body.error.message).toContain("must be ISO 4217 (3 letters)");
    });

    test("returns 400 when idempotencyKey is not a valid UUIDv4", async () => {
      app.post("/orchestrator/sale", validator(saleSchema), (req, res) => {
        res.json({ ok: true });
      });
      app.use(errorHandler);

      const res = await request(app).post("/orchestrator/sale").send({
        amount: "10.50",
        currency: "EUR",
        paymentMethodNonce: "fake-nonce",
        merchantReference: "order_1",
        idempotencyKey: "not-a-uuid",
        callbackUrl: "https://example.com/callback",
      });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(400);
      expect(res.body.error.message).toContain("idempotencyKey");
      expect(res.body.error.message).toContain("must be a valid UUIDv4");
    });

    test("returns 400 when callbackUrl is not a valid URL", async () => {
      app.post("/orchestrator/sale", validator(saleSchema), (req, res) => {
        res.json({ ok: true });
      });
      app.use(errorHandler);

      const res = await request(app).post("/orchestrator/sale").send({
        amount: "10.50",
        currency: "EUR",
        paymentMethodNonce: "fake-nonce",
        merchantReference: "order_1",
        idempotencyKey: "00000000-0000-4000-8000-000000000001",
        callbackUrl: "not-a-url",
      });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(400);
      expect(res.body.error.message).toContain("callbackUrl");
      expect(res.body.error.message).toContain("must be a valid uri");
    });

    test("returns 400 when callbackUrl uses invalid scheme", async () => {
      app.post("/orchestrator/sale", validator(saleSchema), (req, res) => {
        res.json({ ok: true });
      });
      app.use(errorHandler);

      const res = await request(app).post("/orchestrator/sale").send({
        amount: "10.50",
        currency: "EUR",
        paymentMethodNonce: "fake-nonce",
        merchantReference: "order_1",
        idempotencyKey: "00000000-0000-4000-8000-000000000001",
        callbackUrl: "ftp://example.com/callback",
      });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(400);
      expect(res.body.error.message).toContain("callbackUrl");
    });

    test("passes validation for valid sale request", async () => {
      app.post("/orchestrator/sale", validator(saleSchema), (req, res) => {
        res.json({ validated: true, body: req.body });
      });
      app.use(errorHandler);

      const res = await request(app).post("/orchestrator/sale").send({
        amount: "65.50",
        currency: "EUR",
        paymentMethodNonce: "fake-valid-nonce",
        merchantReference: "order_101",
        idempotencyKey: "00000000-0000-4000-8000-000000000001",
        callbackUrl: "https://example.com/callback",
      });

      expect(res.status).toBe(200);
      expect(res.body.validated).toBe(true);
      expect(logger.error).not.toHaveBeenCalled();
    });
  });

  describe("/orchestrator/refund validation", () => {
    test("returns 400 when required fields are missing", async () => {
      app.post("/orchestrator/refund", validator(refundSchema), (req, res) => {
        res.json({ ok: true });
      });
      app.use(errorHandler);

      const res = await request(app).post("/orchestrator/refund").send({});

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(400);
      expect(res.body.error.message).toContain("transactionId");
      expect(res.body.error.message).toContain("amount");
      expect(res.body.error.message).toContain("merchantReference");
      expect(res.body.error.message).toContain("idempotencyKey");
      expect(res.body.error.message).toContain("callbackUrl");
      expect(res.body.error.message).toMatch(/;.*;/); // Multiple errors joined by semicolon

      expect(logger.error).toHaveBeenCalledTimes(2);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("HTTP 400:")
      );
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("[POST] /orchestrator/refund → 400:")
      );
    });

    test("returns 400 when transactionId is missing", async () => {
      app.post("/orchestrator/refund", validator(refundSchema), (req, res) => {
        res.json({ ok: true });
      });
      app.use(errorHandler);

      const res = await request(app).post("/orchestrator/refund").send({
        amount: "10.50",
        merchantReference: "order_1",
        idempotencyKey: "00000000-0000-4000-8000-000000000001",
        callbackUrl: "https://example.com/callback",
      });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(400);
      expect(res.body.error.message).toContain("transactionId");
      expect(res.body.error.message).toContain("required");
    });

    test("returns 400 when amount is invalid format", async () => {
      app.post("/orchestrator/refund", validator(refundSchema), (req, res) => {
        res.json({ ok: true });
      });
      app.use(errorHandler);

      const res = await request(app).post("/orchestrator/refund").send({
        transactionId: "bt_txn_123",
        amount: "invalid",
        merchantReference: "order_1",
        idempotencyKey: "00000000-0000-4000-8000-000000000001",
        callbackUrl: "https://example.com/callback",
      });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(400);
      expect(res.body.error.message).toContain("amount");
      expect(res.body.error.message).toContain(
        "must be a string (max 2 decimals)"
      );
    });

    test("returns 400 when idempotencyKey is not a valid UUIDv4", async () => {
      app.post("/orchestrator/refund", validator(refundSchema), (req, res) => {
        res.json({ ok: true });
      });
      app.use(errorHandler);

      const res = await request(app).post("/orchestrator/refund").send({
        transactionId: "bt_txn_123",
        amount: "10.50",
        merchantReference: "order_1",
        idempotencyKey: "invalid-uuid",
        callbackUrl: "https://example.com/callback",
      });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(400);
      expect(res.body.error.message).toContain("idempotencyKey");
      expect(res.body.error.message).toContain("must be a valid UUIDv4");
    });

    test("passes validation for valid refund request", async () => {
      app.post("/orchestrator/refund", validator(refundSchema), (req, res) => {
        res.json({ validated: true, body: req.body });
      });
      app.use(errorHandler);

      const res = await request(app).post("/orchestrator/refund").send({
        transactionId: "bt_txn_123",
        amount: "10.50",
        merchantReference: "order_102",
        idempotencyKey: "00000000-0000-4000-8000-000000000002",
        callbackUrl: "http://localhost/callback",
      });

      expect(res.status).toBe(200);
      expect(res.body.validated).toBe(true);
      expect(logger.error).not.toHaveBeenCalled();
    });
  });
});
