import { createError } from "./errors/errors.js";

export function validator(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      throw createError(400, error.details.map((d) => d.message).join(";"));
    }
    req.body = value;
    next();
  };
}
