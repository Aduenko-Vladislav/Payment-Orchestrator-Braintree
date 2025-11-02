import { describe, test, expect } from "vitest";
import { mapTransaction } from "../../utils/mappers.js";

const isIso = (s) => !Number.isNaN(Date.parse(s));

describe("mapTransaction()", () => {
  describe("Status determination (automatic)", () => {
    test("maps SUCCESS when transactionId is provided", () => {
      const out = mapTransaction({
        merchantReference: "order_123",
        operation: "sale",
        amount: 10,
        currency: "eur",
        transactionId: "bt_1",
      });

      expect(out.status).toBe("SUCCESS");
      expect(out.transactionId).toBe("bt_1");
      expect(out.error).toBeNull();
      expect(isIso(out.timestamp)).toBe(true);
    });

    test("maps FAILED when code is provided", () => {
      const out = mapTransaction({
        merchantReference: "order_456",
        operation: "refund",
        amount: 12.3,
        code: "DECLINED",
        transactionId: "bt_2",
      });

      expect(out.status).toBe("FAILED");
      expect(out.error).toEqual({
        code: "DECLINED",
        message: "",
      });
    });

    test("maps FAILED when message is provided", () => {
      const out = mapTransaction({
        merchantReference: "order_789",
        operation: "sale",
        amount: 50,
        message: "Insufficient funds",
        transactionId: "bt_3",
      });

      expect(out.status).toBe("FAILED");
      expect(out.error).toEqual({
        code: "ERROR",
        message: "Insufficient funds",
      });
    });

    test("maps FAILED when both code and message are provided", () => {
      const out = mapTransaction({
        merchantReference: "order_456",
        operation: "refund",
        amount: "12.3",
        code: "DECLINED",
        message: "Insufficient funds",
      });

      expect(out.status).toBe("FAILED");
      expect(out.error).toEqual({
        code: "DECLINED",
        message: "Insufficient funds",
      });
    });

    test("maps FAILED when no transactionId, code, or message provided", () => {
      const out = mapTransaction({
        merchantReference: "order_999",
        operation: "sale",
        amount: 100,
      });

      expect(out.status).toBe("FAILED");
      expect(out.transactionId).toBe("");
      expect(out.error).toEqual({
        code: "ERROR",
        message: "",
      });
    });
  });

  describe("Explicit status", () => {
    test("uses explicit SUCCESS status", () => {
      const out = mapTransaction({
        merchantReference: "order_111",
        operation: "sale",
        amount: 10,
        status: "SUCCESS",
      });

      expect(out.status).toBe("SUCCESS");
      expect(out.error).toBeNull();
    });

    test("uses explicit FAILED status", () => {
      const out = mapTransaction({
        merchantReference: "order_222",
        operation: "refund",
        amount: 20,
        status: "FAILED",
      });

      expect(out.status).toBe("FAILED");
      expect(out.error).toEqual({
        code: "ERROR",
        message: "",
      });
    });

    test("uses explicit PENDING status", () => {
      const out = mapTransaction({
        merchantReference: "order_333",
        operation: "sale",
        amount: 30,
        status: "PENDING",
      });

      expect(out.status).toBe("PENDING");
      expect(out.error).toBeNull();
    });

    test("converts lowercase status to uppercase", () => {
      const out = mapTransaction({
        merchantReference: "order_444",
        operation: "sale",
        amount: 40,
        status: "success",
      });

      expect(out.status).toBe("SUCCESS");
    });

    test("converts mixed case status to uppercase", () => {
      const out = mapTransaction({
        merchantReference: "order_555",
        operation: "sale",
        amount: 50,
        status: "FaIlEd",
      });

      expect(out.status).toBe("FAILED");
    });
  });

  describe("Amount formatting", () => {
    test("formats number amount with 2 decimals", () => {
      const out = mapTransaction({
        merchantReference: "order_666",
        operation: "sale",
        amount: 10,
        transactionId: "bt_4",
      });

      expect(out.amount).toBe("10.00");
    });

    test("formats decimal number amount with 2 decimals", () => {
      const out = mapTransaction({
        merchantReference: "order_777",
        operation: "sale",
        amount: 12.3,
        transactionId: "bt_5",
      });

      expect(out.amount).toBe("12.30");
    });

    test("keeps string amount as is", () => {
      const out = mapTransaction({
        merchantReference: "order_888",
        operation: "sale",
        amount: "12.3",
        transactionId: "bt_6",
      });

      expect(out.amount).toBe("12.3");
    });

    test("handles amount with more than 2 decimals as string", () => {
      const out = mapTransaction({
        merchantReference: "order_999",
        operation: "sale",
        amount: "12.345",
        transactionId: "bt_7",
      });

      expect(out.amount).toBe("12.345");
    });
  });

  describe("Currency handling", () => {
    test("defaults to EUR when currency not provided", () => {
      const out = mapTransaction({
        merchantReference: "order_1111",
        operation: "sale",
        amount: 10,
        transactionId: "bt_8",
      });

      expect(out.currency).toBe("EUR");
    });

    test("converts lowercase currency to uppercase", () => {
      const out = mapTransaction({
        merchantReference: "order_2222",
        operation: "sale",
        amount: 10,
        currency: "usd",
        transactionId: "bt_9",
      });

      expect(out.currency).toBe("USD");
    });

    test("handles mixed case currency", () => {
      const out = mapTransaction({
        merchantReference: "order_3333",
        operation: "sale",
        amount: 10,
        currency: "GbP",
        transactionId: "bt_10",
      });

      expect(out.currency).toBe("GBP");
    });
  });

  describe("Provider handling", () => {
    test("defaults to braintree when provider not provided", () => {
      const out = mapTransaction({
        merchantReference: "order_4444",
        operation: "sale",
        amount: 10,
        transactionId: "bt_11",
      });

      expect(out.provider).toBe("braintree");
    });

    test("uses custom provider", () => {
      const out = mapTransaction({
        merchantReference: "order_5555",
        operation: "sale",
        amount: 10,
        provider: "stripe",
        transactionId: "bt_12",
      });

      expect(out.provider).toBe("stripe");
    });

    test("converts provider to string", () => {
      const out = mapTransaction({
        merchantReference: "order_6666",
        operation: "sale",
        amount: 10,
        provider: 123,
        transactionId: "bt_13",
      });

      expect(out.provider).toBe("123");
    });
  });

  describe("TransactionId handling", () => {
    test("handles string transactionId", () => {
      const out = mapTransaction({
        merchantReference: "order_7777",
        operation: "sale",
        amount: 10,
        transactionId: "bt_14",
      });

      expect(out.transactionId).toBe("bt_14");
    });

    test("converts number transactionId to string", () => {
      const out = mapTransaction({
        merchantReference: "order_8888",
        operation: "sale",
        amount: 10,
        transactionId: 12345,
      });

      expect(out.transactionId).toBe("12345");
    });

    test("uses empty string when transactionId is not provided", () => {
      const out = mapTransaction({
        merchantReference: "order_9999",
        operation: "sale",
        amount: 10,
        status: "SUCCESS",
      });

      expect(out.transactionId).toBe("");
    });
  });

  describe("Error handling for FAILED status", () => {
    test("sets error with code and message when both provided", () => {
      const out = mapTransaction({
        merchantReference: "order_err1",
        operation: "sale",
        amount: 10,
        status: "FAILED",
        code: "CARD_DECLINED",
        message: "Card was declined",
      });

      expect(out.error).toEqual({
        code: "CARD_DECLINED",
        message: "Card was declined",
      });
    });

    test("sets default error code when code not provided", () => {
      const out = mapTransaction({
        merchantReference: "order_err2",
        operation: "sale",
        amount: 10,
        status: "FAILED",
        message: "Some error",
      });

      expect(out.error).toEqual({
        code: "ERROR",
        message: "Some error",
      });
    });

    test("sets empty message when message not provided", () => {
      const out = mapTransaction({
        merchantReference: "order_err3",
        operation: "sale",
        amount: 10,
        status: "FAILED",
        code: "TIMEOUT",
      });

      expect(out.error).toEqual({
        code: "TIMEOUT",
        message: "",
      });
    });

    test("sets default code and empty message when neither provided", () => {
      const out = mapTransaction({
        merchantReference: "order_err4",
        operation: "sale",
        amount: 10,
        status: "FAILED",
      });

      expect(out.error).toEqual({
        code: "ERROR",
        message: "",
      });
    });

    test("converts error code to string", () => {
      const out = mapTransaction({
        merchantReference: "order_err5",
        operation: "sale",
        amount: 10,
        status: "FAILED",
        code: 404,
      });

      expect(out.error.code).toBe("404");
    });

    test("converts error message to string", () => {
      const out = mapTransaction({
        merchantReference: "order_err6",
        operation: "sale",
        amount: 10,
        status: "FAILED",
        message: 500,
      });

      expect(out.error.message).toBe("500");
    });
  });

  describe("Base fields", () => {
    test("preserves merchantReference", () => {
      const out = mapTransaction({
        merchantReference: "order_special_123",
        operation: "sale",
        amount: 10,
        transactionId: "bt_15",
      });

      expect(out.merchantReference).toBe("order_special_123");
    });

    test("preserves operation", () => {
      const out = mapTransaction({
        merchantReference: "order_123",
        operation: "refund",
        amount: 10,
        transactionId: "bt_16",
      });

      expect(out.operation).toBe("refund");
    });

    test("always includes timestamp in ISO format", () => {
      const out1 = mapTransaction({
        merchantReference: "order_1",
        operation: "sale",
        amount: 10,
        transactionId: "bt_17",
      });

      const out2 = mapTransaction({
        merchantReference: "order_2",
        operation: "sale",
        amount: 20,
        transactionId: "bt_18",
      });

      expect(isIso(out1.timestamp)).toBe(true);
      expect(isIso(out2.timestamp)).toBe(true);
      expect(out1.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe("Edge cases", () => {
    test("handles explicit status overriding transactionId presence", () => {
      const out = mapTransaction({
        merchantReference: "order_edge1",
        operation: "sale",
        amount: 10,
        transactionId: "bt_19",
        status: "FAILED",
      });

      expect(out.status).toBe("FAILED");
      expect(out.error).toBeTruthy();
    });

    test("handles explicit status overriding code/message presence", () => {
      const out = mapTransaction({
        merchantReference: "order_edge2",
        operation: "sale",
        amount: 10,
        code: "DECLINED",
        message: "Error",
        status: "SUCCESS",
      });

      expect(out.status).toBe("SUCCESS");
      expect(out.error).toBeNull();
    });

    test("handles all fields together", () => {
      const out = mapTransaction({
        merchantReference: "order_complete",
        operation: "refund",
        amount: 99.99,
        currency: "USD",
        transactionId: "txn_12345",
        status: "SUCCESS",
        provider: "paypal",
      });

      expect(out).toEqual({
        merchantReference: "order_complete",
        provider: "paypal",
        operation: "refund",
        status: "SUCCESS",
        transactionId: "txn_12345",
        amount: "99.99",
        currency: "USD",
        timestamp: out.timestamp,
        error: null,
      });
      expect(isIso(out.timestamp)).toBe(true);
    });
  });
});
