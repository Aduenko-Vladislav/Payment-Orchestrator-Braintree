# Payment Orchestrator (Braintree Integration)

This project implements a **two-service payment orchestration system** that simulates real-world payment flows with **Braintree Sandbox**, **Redis**, **webhooks**, and **idempotency**.

---

## 🧩 Architecture Overview

```
Client ──▶ Merchant Service ──▶ Payment Orchestrator ──▶ Braintree API
              ▲                     │
              │◀────── Webhook ◀────┘
              │
        GET /merchant/status/:merchantReference?operation=sale|refund
```

### Services

| Service | Description |
|----------|-------------|
| **Merchant Service (MS)** | Simulates a merchant backend. Initiates payments/refunds, receives webhooks from the orchestrator, stores results in Redis, and provides `/merchant/status/:merchantReference` for polling. |
| **Payment Orchestrator (POS)** | Integrates with Braintree. Executes sale/refund operations, handles idempotency, normalizes responses, and sends webhooks to the merchant. |

---

## ⚙️ Requirements

- Node.js 18+
- Redis 7+
- Braintree Sandbox credentials

---

## 🚀 Local Setup

### 1. Environment Configuration

**`payment-orchestrator-service/.env`**
```
PORT=3002
BRAINTREE_MERCHANT_ID=your_merchant_id
BRAINTREE_PUBLIC_KEY=your_public_key
BRAINTREE_PRIVATE_KEY=your_private_key
CALLBACK_SECRET=supersecret
REDIS_USERNAME
REDIS_PASSWORD
REDIS_HOST
REDIS_PORT
```

**`merchant-service/.env`**
```
PORT=3001
ORCHESTRATOR_URL=http://localhost:3002
PUBLIC_BASE_URL=http://localhost:3001
CALLBACK_SECRET=supersecret
REDIS_USERNAME
REDIS_PASSWORD
REDIS_HOST
REDIS_PORT
```

### 2. Install and start

```bash
# Orchestrator
cd payment-orchestrator-service
npm install
npm run dev

# Merchant Service
cd ../merchant-service
npm install
npm run dev
```

**Expected logs:**
```
[info]: Orchestrator (POS) running on :3002
[info]: Merchant Service running on :3001
```

---

## 💳 Payment Flow

### 1. Start a Sale
```bash
curl -X POST http://localhost:3001/merchant/pay  
     -H "Content-Type: application/json"  
     -d '{
          "amount": "70.00",
          "currency": "EUR",
          "paymentMethodNonce": "fake-valid-nonce",
          "merchantReference": "order_7"
         }'
```
→ Response: `{ "ok": true }`

Result will arrive asynchronously via webhook.

---

### 2. Start a Refund
```bash
curl -X POST http://localhost:3001/merchant/refund  
     -H "Content-Type: application/json"   
     -d '{
          "transactionId": "braintree_txn_id_here",
          "amount": "70.00",
          "merchantReference": "order_7"
        }'
```
→ Response: `{ "ok": true }`

---

### 3. Check Transaction Status
```bash
# Sale
curl "http://localhost:3001/merchant/status/order_7?operation=sale"

# Refund
curl "http://localhost:3001/merchant/status/order_7?operation=refund"
```

✅ **Success Example**
```json
{
  "merchantReference": "order_7",
  "operation": "sale",
  "status": "SUCCESS",
  "transactionId": "4jn86yph",
  "amount": "70.00",
  "currency": "EUR",
  "provider": "braintree",
  "timestamp": "2025-11-02T11:54:35.000Z",
  "error": null
}
```

🕓 **Pending Example**
```json
{
  "merchantReference": "order_7",
  "operation": "sale",
  "status": "PENDING",
  "message": "Result not available yet. Try again later."
}
```
<img src="https://www.svgrepo.com/show/354202/postman-icon.svg" width="20" height="20" /> **Link to POSTMAN Collecttion**
```
https://adyenko-job-1345914.postman.co/workspace/Vladislav-Aduenko's-Workspace~b2ea1a18-07a9-4865-8371-2394bca6dbbd/collection/49706189-9d33c98a-ea5f-4257-98ce-b3141d18b9f7?action=share&creator=49706189
```
---

## 🔐 Webhook Security

- POS signs every webhook with **HMAC-SHA256(CALLBACK_SECRET)**.
- MS verifies the signature in the `X-Signature` header.
- If verification fails → HTTP `401 Unauthorized`.

---

## ♻️ Idempotency

- Each request includes a unique `idempotencyKey`.
- POS stores results in Redis under:
  ```
  idempotency:<operation>:<idempotencyKey>
  ```
- Repeated requests with the same key will **not** hit Braintree again.  
  The cached result is resent via webhook.  
  TTL: 24 hours.

---

## 🧠 Redis Storage Schema

| Service | Key Pattern | Example | Purpose |
|----------|-------------|----------|----------|
| **POS** | `idempotency:<operation>:<key>` | `idempotency:sale:46f6f152` | Cache of normalized results |
| **MS** | `<operation>:<merchantReference>` | `refund:order_7` | Last known result for a merchant operation |

---

## 🧰 API Summary

| Method | Endpoint | Description |
|---------|-----------_-|-------------|
| `POST` | `/merchant/pay` | Start a sale transaction |
| `POST` | `/merchant/refund` | Start a refund transaction |
| `GET` | `/merchant/status/:merchantReference?operation=sale|refund` | Check transaction status |
| `POST` | `/merchant/callback` | Receive webhook from Orchestrator |
| `POST` | `/orchestrator/sale` | Create sale via Braintree |
| `POST` | `/orchestrator/refund` | Create refund via Braintree |

---

## 🧾 Typical Logs

**Payment Orchestrator**
```
[info]: Sale request received: ref=order_7, amount=70.00
[info]: Braintree sale success: txn=4jn86yph
[info]: Stored result for idempotency key: b2dd5756 operation=sale
[info]: Webhook sent successfully to http://localhost:3001/merchant/callback
```

**Merchant Service**
```
[info]: 202 Sale started ref=order_7 idemKey=b2dd5756
[info]: [HMAC] Signature verified successfully for /merchant/callback
[info]: Callback received: ref=order_7 operation=sale status=SUCCESS
```

---

## 🧪 Testing

```bash
npm run test
```

Covers:
- Response mappers (POS)
- Idempotency handler
- Status handler (MS)
- Merge logic for transaction results

---

## 🧩 Common Error Cases

| Scenario | Status | Example Message |
|-----------|---------|----------------|
| Duplicate Sale | FAILED | `Gateway Rejected: duplicate` |
| Invalid Refund | FAILED | `Transaction has already been fully refunded. Refund amount is too large.` |
| Pending Settlement | PENDING | `settlement_pending` or `settling` |

---

## 🧱 Tech Stack

- **Node.js + Express**
- **Redis** (for cache/idempotency)
- **Braintree Sandbox**
- **Joi** (validation)
- **Winston** (logging)
- **axios / axios-retry**
- **HMAC signature verification**

---

## 🧩 Development Notes

- Unified response schema:
  ```json
  {
    "merchantReference": "...",
    "operation": "sale",
    "amount": "70.00",
    "currency": "EUR",
    "transactionId": "...",
    "status": "SUCCESS",
    "provider": "braintree",
    "timestamp": "ISO",
    "error": null
  }
  ```
- Asynchronous processing via webhooks.
- Resilient to retries (idempotency).
- Safe HMAC verification on callback.

---
