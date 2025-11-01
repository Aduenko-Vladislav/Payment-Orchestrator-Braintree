import Joi from "joi";

export const paymentSchema = Joi.object({
  amount: Joi.string()
    .pattern(/^\d+(\.\d{1,2})?$/)
    .required()
    .messages({
      "string.empty": `"amount" is required`,
      "string.pattern.base": `"amount" must be like "12" or "12.34" (max 2 decimals)`,
    }),
  currency: Joi.string().uppercase().length(3).default("EUR").messages({
    "string.length": `"currency" must be ISO 4217 (3 letters)`,
  }),
  paymentMethodNonce: Joi.string().trim().required().messages({
    "string.empty": `"paymentMethodNonce" is required`,
  }),
  merchantReference: Joi.string().trim().required().messages({
    "string.empty": `"merchantReference" is required`,
  }),
});