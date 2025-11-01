/**
 * Universal mapper function that determines transaction status based on input parameters
 * @param {Object} params - Transaction parameters
 * @param {string} params.merchantReference - Merchant reference ID
 * @param {string} params.operation - Operation type (e.g., "sale", "refund", "void")
 * @param {number|string} params.amount - Transaction amount (will be formatted as string with 2 decimals)
 * @param {string} [params.currency="EUR"] - Currency code (defaults to "EUR")
 * @param {string|number} [params.transactionId] - Provider transaction ID
 * @param {string} [params.status] - Explicit status ("SUCCESS", "FAILED", "PENDING"). If not provided, will be determined automatically
 * @param {string|number} [params.code] - Error code (presence indicates FAILED status)
 * @param {string} [params.message] - Error message (presence indicates FAILED status)
 * @param {string} [params.provider="braintree"] - Payment provider name
 * @returns {Object} Standardized transaction response
 */
export function mapTransaction({
  merchantReference,
  operation,
  amount,
  currency,
  transactionId,
  status,
  code,
  message,
  provider = "braintree",
}) {
  let finalStatus = status;
  if (!finalStatus) {
    if (code || message) {
      finalStatus = "FAILED";
    } else if (transactionId) {
      finalStatus = "SUCCESS";
    } else {
      finalStatus = "FAILED";
    }
  }

  finalStatus = finalStatus.toUpperCase();

  const baseResponse = {
    merchantReference,
    provider: String(provider),
    operation,
    status: finalStatus,
    transactionId: transactionId ? String(transactionId) : "",
    amount: typeof amount === "number" ? amount.toFixed(2) : String(amount),
    currency: String(currency || "EUR").toUpperCase(),
    timestamp: new Date().toISOString(),
    error: null,
  };

  if (finalStatus === "FAILED") {
    baseResponse.error = {
      code: String(code || "ERROR"),
      message: String(message || ""),
    };
  }

  return baseResponse;
}
