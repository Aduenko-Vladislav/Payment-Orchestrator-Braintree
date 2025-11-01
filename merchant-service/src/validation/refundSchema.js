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
      "string.pattern.base": `"amount" must be like "12" or "12.34" (max 2 decimals)`,
    }),
  merchantReference: Joi.string().trim().required().messages({
    "string.empty": `"merchantReference" is required`,
  }),
});
