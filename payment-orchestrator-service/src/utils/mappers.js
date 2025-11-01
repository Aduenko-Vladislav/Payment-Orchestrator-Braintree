/**
 * Maps successful transaction response to standardized format
 * @param {Object} params - Transaction parameters
 * @param {string} params.merchantReference - Merchant reference ID
 * @param {string} params.operation - Operation type (e.g., "sale", "refund", "void")
 * @param {number|string} params.amount - Transaction amount (will be formatted as string with 2 decimals)
 * @param {string} [params.currency="EUR"] - Currency code (defaults to "EUR")
 * @param {string|number} params.transactionId - Provider transaction ID
 * @returns {Object} Standardized success response
 */
export function mapSuccess({
  merchantReference,
  operation,
  amount,
  currency,
  transactionId,
}) {
  return {
    merchantReference,
    provider: "braintree",
    operation,
    status: "SUCCESS",
    transactionId: String(transactionId),
    amount: typeof amount === "number" ? amount.toFixed(2) : String(amount),
    currency: String(currency || "EUR").toUpperCase(),
    timestamp: new Date().toISOString(),
    error: null,
  };
}

/**
 * Maps failed transaction response to standardized format
 * @param {Object} params - Transaction parameters
 * @param {string} params.merchantReference - Merchant reference ID
 * @param {string} params.operation - Operation type (e.g., "sale", "refund", "void")
 * @param {number|string} params.amount - Transaction amount (will be formatted as string with 2 decimals)
 * @param {string} [params.currency="EUR"] - Currency code (defaults to "EUR")
 * @param {string|number} [params.code="ERROR"] - Error code
 * @param {string} [params.message=""] - Error message
 * @returns {Object} Standardized failure response
 */
export function mapFailure({
  merchantReference,
  operation,
  amount,
  currency,
  code,
  message,
}) {
  return {
    merchantReference,
    provider: "braintree",
    operation,
    status: "FAILED",
    transactionId: "",
    amount: typeof amount === "number" ? amount.toFixed(2) : String(amount),
    currency: String(currency || "EUR").toUpperCase(),
    timestamp: new Date().toISOString(),
    error: { code: String(code || "ERROR"), message: String(message || "") },
  };
}

export function mapPending({
  merchantReference,
  operation,
  amount,
  currency,
  transactionId,
}) {
  return {
    merchantReference,
    provider: "braintree",
    operation,
    status: "PANDING",
    transactionId: String(transactionId),
    amount: typeof amount === "number" ? amount.toFixed(2) : String(amount),
    currency: String(currency || "EUR").toUpperCase(),
    timestamp: new Date().toISOString(),
    error: null,
  };
}
