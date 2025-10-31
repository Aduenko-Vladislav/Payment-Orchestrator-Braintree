import Joi from "joi";

export const refundSchema = Joi.object({
  transactionId: Joi.string().trim().required().messages({
    "string.empty": `"transactionId" is required`,
  }),

  amount: Joi.string()
    .pattern(/^\d+(\.\d{1,2})?$/)
    .required()
    .messages({
      "string.empty": `"amount" is required`,
      "string.pattern.base": `"amount" must be a string (max 2 decimals)`,
    }),

  merchantReference: Joi.string().trim().required().messages({
    "string.empty": `"merchantReference" is required`,
  }),

  idempotencyKey: Joi.string().guid({ version: "uuidv4" }).required().messages({
    "string.guid": `"idempotencyKey" must be a valid UUIDv4`,
    "any.required": `"idempotencyKey" is required`,
  }),

  callbackUrl: Joi.string()
    .uri({ scheme: ["http", "https"] })
    .required()
    .messages({
      "string.uri": `"callbackUrl" must be a valid http/https URL`,
    }),
});
