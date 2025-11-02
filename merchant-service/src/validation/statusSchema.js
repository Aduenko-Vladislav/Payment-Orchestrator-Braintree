import Joi from "joi";

export const statusParamsSchema = Joi.object({
  merchantReference: Joi.string()
    .trim()
    .min(1)
    .required()
    .messages({
      "any.required": `"merchantReference" is required in URL params`,
      "string.base": `"merchantReference" must be a string`,
      "string.empty": `"merchantReference" cannot be empty`,
      "string.min": `"merchantReference" cannot be empty`,
    }),
});

export const statusQuerySchema = Joi.object({
  operation: Joi.string()
    .valid("sale", "refund")
    .required()
    .messages({
      "any.only": `"operation" must be either 'sale' or 'refund'`,
      "any.required": `"operation" query parameter is required`,
      "string.base": `"operation" must be a string`,
      "string.empty": `"operation" cannot be empty`,
    }),
});
