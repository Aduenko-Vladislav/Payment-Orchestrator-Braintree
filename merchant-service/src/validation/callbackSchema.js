import Joi from "joi";

export const callbackSchema = Joi.object({
  merchantReference: Joi.string().trim().required(),
  operation: Joi.string().valid("sale", "refund", "void").required(),
  status: Joi.string().valid("SUCCESS", "FAILED", "PENDING").required(),
  amount: Joi.string()
    .pattern(/^\d+(\.\d{1,2})?$/)
    .required(),
  currency: Joi.string().uppercase().required(),
  transactionId: Joi.alternatives().conditional("status", {
    is: "SUCCESS",
    then: Joi.string().trim().required(),  
    otherwise: Joi.string().allow("", null).optional(), 
  }),
  timestamp: Joi.string().isoDate().required(),
  
}).unknown(true);
