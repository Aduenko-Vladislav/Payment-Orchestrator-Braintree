/**
 * Domain rule: one merchantReference → one payment.
 * Status merging policy:
 *  - Never downgrade SUCCESS to FAILED/PENDING
 *  - Allow upgrade FAILED/PENDING → SUCCESS
 *  - If priorities are equal or lower, keep previous state as-is
 */

export const STATUS_PRIORITY = { PENDING: 1, FAILED: 1, SUCCESS: 2 };

/**
 * @typedef {Object} PaymentState
 * @property {string} merchantReference
 * @property {"PENDING"|"FAILED"|"SUCCESS"} status
 * @property {string} [transactionId]
 * @property {string} [amount]
 * @property {string} [currency]
 * @property {string} [timestamp]
 * @property {any}    [error]
 * @property {string} [updatedAt]
 */

/**
 * Merge previous and incoming states respecting “no downgrade from SUCCESS”.
 * If no change should be applied, returns the previous object as-is (same reference).
 * If an upgrade occurs or transactionId changes, returns a new merged object.
 *
 * Why return the same object when unchanged?
 * - Callers can check `const changed = merged !== prev` to detect updates
 *   without having to re-compare fields or run extra logic.
 *
 * @param {PaymentState | undefined} prev
 * @param {PaymentState} incoming
 * @returns {PaymentState}
 */
export function mergedResult(prev, incoming) {
  if (!prev) return incoming;

  const prevP = STATUS_PRIORITY[prev.status] ?? 0;
  const inP = STATUS_PRIORITY[incoming.status] ?? 0;

 
  let mergeType;

  if (prev.status === "SUCCESS" && incoming.status !== "SUCCESS") {
    mergeType = "noDowngrade";
  } else if (inP > prevP) {
    mergeType = "upgrade";
  } else if (
    prev.status === incoming.status &&
    incoming.transactionId &&
    prev.transactionId !== incoming.transactionId
  ) {
    mergeType = "sameStatusNewTransaction";
  } else if (
    prev.status === incoming.status &&
    prev.transactionId === incoming.transactionId
  ) {
    mergeType = "sameStatusSameTransaction";
  } else {
    mergeType = "noChange";
  }

  switch (mergeType) {
    case "noDowngrade":
      // Never downgrade SUCCESS to FAILED/PENDING
      return prev;

    case "upgrade":
      // Allow upgrade FAILED/PENDING → SUCCESS
      return { ...prev, ...incoming, updatedAt: new Date().toISOString() };

    case "sameStatusNewTransaction":
      // If same status but different transactionId, it's a new transaction - update it
      return { ...prev, ...incoming, updatedAt: new Date().toISOString() };

    case "sameStatusSameTransaction": {
      // If same status and same transactionId but other fields changed, update
      const prevStr = JSON.stringify({
        amount: prev.amount,
        currency: prev.currency,
        timestamp: prev.timestamp,
      });
      const incomingStr = JSON.stringify({
        amount: incoming.amount,
        currency: incoming.currency,
        timestamp: incoming.timestamp,
      });

      if (prevStr !== incomingStr) {
        return { ...prev, ...incoming, updatedAt: new Date().toISOString() };
      }
      return prev;
    }

    case "noChange":
    default:
      return prev;
  }
}
