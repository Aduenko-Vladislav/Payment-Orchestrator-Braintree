import { describe, test, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";

import { validator } from "../../middleware/validation.js";
import { saleSchema } from "../../validation/saleSchema.js";
import { refundSchema } from "../../validation/refundSchema.js";
import { errorHandler } from "../../middleware/errors/errors.js";
import { handleSale } from "../../handlers/saleHandler.js";
import { handleRefund } from "../../handlers/refundHandler.js";
import { postWebhook } from "../../utils/webhook.js";

vi.mock("../../logger/winstonLogging.js", () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));
vi.mock("../../utils/webhook.js", () => ({
  postWebhook: vi.fn(async (_url, _body) => {}),
}));

let redisStore = new Map();

vi.mock("../../storage/redisClient.js", () => {
  return {
    getRedisClient: async () => ({
      get: async (k) => redisStore.get(k),
      set: async (k, v, options) => {
        redisStore.set(k, v);
      },
      exists: async (k) => (redisStore.has(k) ? 1 : 0),
      del: async (k) => (redisStore.delete(k) ? 1 : 0),
    }),
  };
});

let btBehavior = { mode: "ok" };
let mockSaleFn;
let mockRefundFn;

vi.mock("../../braintree/client.js", () => ({
  gateway: {
    transaction: {
      get sale() {
        return mockSaleFn;
      },
      get refund() {
        return mockRefundFn;
      },
    },
  },
}));

function buildApp() {
  const app = express();
  app.use(express.json());
  app.post("/orchestrator/sale", validator(saleSchema), handleSale);
  app.post("/orchestrator/refund", validator(refundSchema), handleRefund);
  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.use(errorHandler);
  return app;
}

describe("Orchestrator Integration Tests", () => {
  const app = buildApp();

  beforeEach(() => {
    vi.clearAllMocks();
    redisStore = new Map();
    btBehavior.mode = "ok";

    mockSaleFn = vi.fn(async () => {
      if (btBehavior.mode === "ok")
        return {
          success: true,
          transaction: {
            id: "bt_sale_1",
            status: "submitted_for_settlement",
          },
        };
      if (btBehavior.mode === "decline")
        return {
          success: false,
          message: "Declined by bank",
          transaction: {
            processorResponseCode: "2001",
            processorResponseText: "Card declined",
          },
        };
      if (btBehavior.mode === "pending")
        return {
          success: true,
          transaction: {
            id: "bt_sale_pending",
            status: "settlement_pending",
          },
        };
      if (btBehavior.mode === "settling")
        return {
          success: true,
          transaction: {
            id: "bt_sale_settling",
            status: "settling",
          },
        };
      if (btBehavior.mode === "failed_no_transaction")
        return {
          success: false,
          message: "Transaction failed without transaction object",
        };
      if (btBehavior.mode === "exception") throw new Error("Provider error");
      return {
        success: true,
        transaction: {
          id: "bt_sale_1",
          status: "submitted_for_settlement",
        },
      };
    });

    mockRefundFn = vi.fn(async () => {
      if (btBehavior.mode === "ok")
        return {
          success: true,
          transaction: {
            id: "bt_refund_1",
            status: "submitted_for_settlement",
          },
        };
      if (btBehavior.mode === "decline")
        return {
          success: false,
          message: "Refund declined",
          transaction: {
            processorResponseCode: "2002",
            processorResponseText: "Refund not allowed",
          },
        };
      if (btBehavior.mode === "pending")
        return {
          success: true,
          transaction: {
            id: "bt_refund_pending",
            status: "settlement_pending",
          },
        };
      if (btBehavior.mode === "settling")
        return {
          success: true,
          transaction: {
            id: "bt_refund_settling",
            status: "settling",
          },
        };
      if (btBehavior.mode === "failed_no_transaction")
        return {
          success: false,
          message: "Refund failed without transaction object",
        };
      if (btBehavior.mode === "exception")
        throw new Error("Refund provider error");
      return {
        success: true,
        transaction: {
          id: "bt_refund_1",
          status: "submitted_for_settlement",
        },
      };
    });
  });

  describe("Health endpoint", () => {
    test("GET /health returns ok", async () => {
      const res = await request(app).get("/health");
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true });
    });
  });

  describe("SALE endpoint", () => {
    const validSalePayload = {
      amount: "65.00",
      currency: "EUR",
      paymentMethodNonce: "fake-valid-nonce",
      merchantReference: "order_101",
      idempotencyKey: "00000000-0000-4000-8000-000000000001",
      callbackUrl: "http://localhost/callback",
    };

    test("SALE happy path → webhook SUCCESS", async () => {
      const res = await request(app)
        .post("/orchestrator/sale")
        .send(validSalePayload);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true });
      expect(postWebhook).toHaveBeenCalledTimes(1);

      const [url, body] = postWebhook.mock.calls[0];
      expect(url).toBe(validSalePayload.callbackUrl);
      expect(body.status).toBe("SUCCESS");
      expect(body.transactionId).toBe("bt_sale_1");
      expect(body.operation).toBe("sale");
      expect(body.merchantReference).toBe("order_101");
      expect(body.amount).toBe("65.00");
      expect(body.currency).toBe("EUR");
      expect(body.provider).toBe("braintree");
      expect(body.error).toBeNull();
      expect(body.timestamp).toBeDefined();
    });

    test("SALE with pending status → webhook PENDING", async () => {
      btBehavior.mode = "pending";

      const res = await request(app)
        .post("/orchestrator/sale")
        .send(validSalePayload);

      expect(res.status).toBe(200);
      expect(postWebhook).toHaveBeenCalledTimes(1);

      const [_url, body] = postWebhook.mock.calls[0];
      expect(body.status).toBe("PENDING");
      expect(body.transactionId).toBe("bt_sale_pending");
      expect(body.error).toBeNull();
    });

    test("SALE with settling status → webhook PENDING", async () => {
      btBehavior.mode = "settling";

      const res = await request(app)
        .post("/orchestrator/sale")
        .send(validSalePayload);

      expect(res.status).toBe(200);
      expect(postWebhook).toHaveBeenCalledTimes(1);

      const [_url, body] = postWebhook.mock.calls[0];
      expect(body.status).toBe("PENDING");
      expect(body.transactionId).toBe("bt_sale_settling");
    });

    test("SALE decline → webhook FAILED", async () => {
      btBehavior.mode = "decline";

      const res = await request(app)
        .post("/orchestrator/sale")
        .send(validSalePayload);

      expect(res.status).toBe(200);
      expect(postWebhook).toHaveBeenCalledTimes(1);

      const [_url, body] = postWebhook.mock.calls[0];
      expect(body.status).toBe("FAILED");
      expect(body.error).toBeDefined();
      expect(body.error.code).toBe("2001");
      expect(body.error.message).toBe("Card declined");
    });

    test("SALE failed without transaction → webhook FAILED", async () => {
      btBehavior.mode = "failed_no_transaction";

      const res = await request(app)
        .post("/orchestrator/sale")
        .send(validSalePayload);

      expect(res.status).toBe(200);
      expect(postWebhook).toHaveBeenCalledTimes(1);

      const [_url, body] = postWebhook.mock.calls[0];
      expect(body.status).toBe("FAILED");
      expect(body.error.code).toBe("BT_ERROR");
      expect(body.error.message).toBe(
        "Transaction failed without transaction object"
      );
    });

    test("SALE provider exception → webhook FAILED with EXCEPTION", async () => {
      btBehavior.mode = "exception";

      const res = await request(app)
        .post("/orchestrator/sale")
        .send(validSalePayload);

      expect(res.status).toBe(200);
      expect(postWebhook).toHaveBeenCalledTimes(1);

      const [_url, body] = postWebhook.mock.calls[0];
      expect(body.status).toBe("FAILED");
      expect(body.error.code).toBe("EXCEPTION");
      expect(body.error.message).toBe("Provider error");
    });

    test("SALE idempotency - returns cached result", async () => {
      const firstRes = await request(app)
        .post("/orchestrator/sale")
        .send(validSalePayload);

      expect(firstRes.status).toBe(200);
      expect(firstRes.body).toEqual({ ok: true });
      expect(firstRes.body.idempotent).toBeUndefined();
      expect(postWebhook).toHaveBeenCalledTimes(1);

      const secondRes = await request(app)
        .post("/orchestrator/sale")
        .send(validSalePayload);

      expect(secondRes.status).toBe(200);
      expect(secondRes.body).toEqual({ ok: true, idempotent: true });
      expect(postWebhook).toHaveBeenCalledTimes(2);

      const [_url, cachedBody] = postWebhook.mock.calls[1];
      expect(cachedBody.status).toBe("SUCCESS");
    });

    test("SALE validation - missing required field", async () => {
      const invalidPayload = {
        amount: "65.0",
        currency: "EUR",
        merchantReference: "order_101",
        idempotencyKey: "00000000-0000-4000-8000-000000000001",
        callbackUrl: "http://localhost/callback",
      };

      const res = await request(app)
        .post("/orchestrator/sale")
        .send(invalidPayload);

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe(400);
      expect(postWebhook).not.toHaveBeenCalled();
    });

    test("SALE validation - invalid UUID", async () => {
      const invalidPayload = {
        ...validSalePayload,
        idempotencyKey: "invalid-uuid",
      };

      const res = await request(app)
        .post("/orchestrator/sale")
        .send(invalidPayload);

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
      expect(postWebhook).not.toHaveBeenCalled();
    });

    test("SALE validation - invalid amount format", async () => {
      const invalidPayload = {
        ...validSalePayload,
        amount: "65.123",
      };

      const res = await request(app)
        .post("/orchestrator/sale")
        .send(invalidPayload);

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
      expect(postWebhook).not.toHaveBeenCalled();
    });

    test("SALE validation - invalid callback URL", async () => {
      const invalidPayload = {
        ...validSalePayload,
        callbackUrl: "not-a-url",
      };

      const res = await request(app)
        .post("/orchestrator/sale")
        .send(invalidPayload);

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
      expect(postWebhook).not.toHaveBeenCalled();
    });

    test("SALE with default currency", async () => {
      const payloadWithoutCurrency = {
        ...validSalePayload,
        currency: undefined,
      };

      const res = await request(app)
        .post("/orchestrator/sale")
        .send(payloadWithoutCurrency);

      expect(res.status).toBe(200);
      expect(postWebhook).toHaveBeenCalledTimes(1);

      const [_url, body] = postWebhook.mock.calls[0];
      expect(body.currency).toBe("EUR");
    });

    test("SALE with lowercase currency converts to uppercase", async () => {
      const payload = {
        ...validSalePayload,
        currency: "usd",
      };

      const res = await request(app).post("/orchestrator/sale").send(payload);

      expect(res.status).toBe(200);
      const [_url, body] = postWebhook.mock.calls[0];
      expect(body.currency).toBe("USD");
    });

    test("SALE with amount as number string", async () => {
      const payload = {
        ...validSalePayload,
        amount: "100.00",
      };

      const res = await request(app).post("/orchestrator/sale").send(payload);

      expect(res.status).toBe(200);
      const [_url, body] = postWebhook.mock.calls[0];
      expect(body.amount).toBe("100.00");
    });
  });

  describe("REFUND endpoint", () => {
    const validRefundPayload = {
      transactionId: "bt_sale_1",
      amount: "10",
      merchantReference: "order_102",
      idempotencyKey: "00000000-0000-4000-8000-000000000002",
      callbackUrl: "http://localhost/callback",
    };

    test("REFUND happy path → webhook SUCCESS", async () => {
      const res = await request(app)
        .post("/orchestrator/refund")
        .send(validRefundPayload);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true });
      expect(postWebhook).toHaveBeenCalledTimes(1);

      const [url, body] = postWebhook.mock.calls[0];
      expect(url).toBe(validRefundPayload.callbackUrl);
      expect(body.status).toBe("SUCCESS");
      expect(body.transactionId).toBe("bt_refund_1");
      expect(body.operation).toBe("refund");
      expect(body.merchantReference).toBe("order_102");
      expect(body.amount).toBe("10");
      expect(body.currency).toBe("EUR");
      expect(body.provider).toBe("braintree");
      expect(body.error).toBeNull();
      expect(body.timestamp).toBeDefined();
    });

    test("REFUND with pending status → webhook PENDING", async () => {
      btBehavior.mode = "pending";

      const res = await request(app)
        .post("/orchestrator/refund")
        .send(validRefundPayload);

      expect(res.status).toBe(200);
      expect(postWebhook).toHaveBeenCalledTimes(1);

      const [_url, body] = postWebhook.mock.calls[0];
      expect(body.status).toBe("PENDING");
      expect(body.transactionId).toBe("bt_refund_pending");
      expect(body.error).toBeNull();
    });

    test("REFUND with settling status → webhook PENDING", async () => {
      btBehavior.mode = "settling";

      const res = await request(app)
        .post("/orchestrator/refund")
        .send(validRefundPayload);

      expect(res.status).toBe(200);
      expect(postWebhook).toHaveBeenCalledTimes(1);

      const [_url, body] = postWebhook.mock.calls[0];
      expect(body.status).toBe("PENDING");
      expect(body.transactionId).toBe("bt_refund_settling");
    });

    test("REFUND decline → webhook FAILED", async () => {
      btBehavior.mode = "decline";

      const res = await request(app)
        .post("/orchestrator/refund")
        .send(validRefundPayload);

      expect(res.status).toBe(200);
      expect(postWebhook).toHaveBeenCalledTimes(1);

      const [_url, body] = postWebhook.mock.calls[0];
      expect(body.status).toBe("FAILED");
      expect(body.error).toBeDefined();
      expect(body.error.code).toBe("2002");
      expect(body.error.message).toBe("Refund not allowed");
    });

    test("REFUND failed without transaction → webhook FAILED", async () => {
      btBehavior.mode = "failed_no_transaction";

      const res = await request(app)
        .post("/orchestrator/refund")
        .send(validRefundPayload);

      expect(res.status).toBe(200);
      expect(postWebhook).toHaveBeenCalledTimes(1);

      const [_url, body] = postWebhook.mock.calls[0];
      expect(body.status).toBe("FAILED");
      expect(body.error.code).toBe("BT_ERROR");
      expect(body.error.message).toBe(
        "Refund failed without transaction object"
      );
    });

    test("REFUND provider exception → webhook FAILED with EXCEPTION", async () => {
      btBehavior.mode = "exception";

      const res = await request(app)
        .post("/orchestrator/refund")
        .send(validRefundPayload);

      expect(res.status).toBe(200);
      expect(postWebhook).toHaveBeenCalledTimes(1);

      const [_url, body] = postWebhook.mock.calls[0];
      expect(body.status).toBe("FAILED");
      expect(body.error.code).toBe("EXCEPTION");
      expect(body.error.message).toBe("Refund provider error");
    });

    test("REFUND idempotency - returns cached result", async () => {
      const firstRes = await request(app)
        .post("/orchestrator/refund")
        .send(validRefundPayload);

      expect(firstRes.status).toBe(200);
      expect(firstRes.body).toEqual({ ok: true });
      expect(firstRes.body.idempotent).toBeUndefined();
      expect(postWebhook).toHaveBeenCalledTimes(1);

      const secondRes = await request(app)
        .post("/orchestrator/refund")
        .send(validRefundPayload);

      expect(secondRes.status).toBe(200);
      expect(secondRes.body).toEqual({ ok: true, idempotent: true });
      expect(postWebhook).toHaveBeenCalledTimes(2);

      const [_url, cachedBody] = postWebhook.mock.calls[1];
      expect(cachedBody.status).toBe("SUCCESS");
    });

    test("REFUND validation - missing required field", async () => {
      const invalidPayload = {
        amount: "10",
        merchantReference: "order_102",
        idempotencyKey: "00000000-0000-4000-8000-000000000002",
        callbackUrl: "http://localhost/callback",
      };

      const res = await request(app)
        .post("/orchestrator/refund")
        .send(invalidPayload);

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe(400);
      expect(postWebhook).not.toHaveBeenCalled();
    });

    test("REFUND validation - invalid UUID", async () => {
      const invalidPayload = {
        ...validRefundPayload,
        idempotencyKey: "not-a-uuid",
      };

      const res = await request(app)
        .post("/orchestrator/refund")
        .send(invalidPayload);

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
      expect(postWebhook).not.toHaveBeenCalled();
    });

    test("REFUND validation - invalid amount format", async () => {
      const invalidPayload = {
        ...validRefundPayload,
        amount: "10.999",
      };

      const res = await request(app)
        .post("/orchestrator/refund")
        .send(invalidPayload);

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
      expect(postWebhook).not.toHaveBeenCalled();
    });

    test("REFUND validation - invalid callback URL", async () => {
      const invalidPayload = {
        ...validRefundPayload,
        callbackUrl: "ftp://invalid",
      };

      const res = await request(app)
        .post("/orchestrator/refund")
        .send(invalidPayload);

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
      expect(postWebhook).not.toHaveBeenCalled();
    });

    test("REFUND always uses EUR currency", async () => {
      const res = await request(app)
        .post("/orchestrator/refund")
        .send(validRefundPayload);

      expect(res.status).toBe(200);
      const [_url, body] = postWebhook.mock.calls[0];
      expect(body.currency).toBe("EUR");
    });
  });

  describe("Error handling", () => {
    test("404 for unknown route", async () => {
      const res = await request(app).post("/orchestrator/unknown");

      expect(res.status).toBe(404);
    });

    test("Invalid JSON body returns 400", async () => {
      const res = await request(app)
        .post("/orchestrator/sale")
        .set("Content-Type", "application/json")
        .send("{ invalid json }");

      expect(res.status).toBe(400);
    });
  });
});
