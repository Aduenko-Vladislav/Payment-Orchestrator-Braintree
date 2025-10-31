/**
 * Maps successful transaction response to standardized format
 * @param {Object} params - Transaction parameters
 * @param {string} params.merchantReference - Merchant reference ID
 * @param {string} params.operation - Operation type (e.g., "sale", "refund")
 * @param {number} params.amount - Transaction amount
 * @param {string} params.currency - Currency code (defaults to "EUR")
 * @param {string} params.transactionId - Provider transaction ID
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
    transactionId,
    amount,
    currency: currency || "EUR",
    error: null,
  };
}

/**
 * Maps failed transaction response to standardized format
 * @param {Object} params - Transaction parameters
 * @param {string} params.merchantReference - Merchant reference ID
 * @param {string} params.operation - Operation type (e.g., "sale", "refund")
 * @param {number} params.amount - Transaction amount
 * @param {string} params.currency - Currency code (defaults to "EUR")
 * @param {string} params.code - Error code
 * @param {string} params.message - Error message
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
    transactionId: null,
    amount,
    currency: currency || "EUR",
    error: { code, message },
  };
}
