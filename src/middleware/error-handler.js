import AppError from "../errors/AppError.js";
import ERROR_CODES from "../errors/error-codes.js";

const isProduction = process.env.NODE_ENV === "production";

const errorHandler = (error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      status: "error",
      code: error.code,
      message: error.message,
    });
  }

  if (!isProduction) {
    console.error(error);
  } else {
    console.error(`${req.method} ${req.originalUrl}`, error);
  }

  return res.status(500).json({
    status: "error",
    code: ERROR_CODES.INTERNAL_SERVER_ERROR,
    message: "Internal server error",
  });
};

export default errorHandler;