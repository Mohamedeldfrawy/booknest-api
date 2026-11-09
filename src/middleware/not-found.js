import AppError from "../errors/AppError.js";
import ERROR_CODES from "../errors/error-codes.js";

const notFound = (req, res, next) => {
  next(new AppError("Resource not found", 404, ERROR_CODES.RESOURCE_NOT_FOUND));
};

export default notFound;