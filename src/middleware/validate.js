import AppError from "../errors/AppError.js";
import ERROR_CODES from "../errors/error-codes.js";

const validate = (schema, property = "body") => (req, res, next) => {
  const { error, value } = schema.validate(req[property], {
    abortEarly: false,
  });

  if (error) {
    return next(
      new AppError(error.details.map((detail) => detail.message).join(", "), 400, ERROR_CODES.VALIDATION_ERROR),
    );
  }

  req[property] = value;
  return next();
};

export default validate;