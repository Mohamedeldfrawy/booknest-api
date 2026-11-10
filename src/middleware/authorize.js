import AppError from "../errors/AppError.js";
import ERROR_CODES from "../errors/error-codes.js";

const authorize = (...allowedRoles) => (req, res, next) => {
  if (!req.user) {
    return next(
      new AppError(
        "Authentication required",
        401,
        ERROR_CODES.AUTHENTICATION_REQUIRED,
      ),
    );
  }

  if (!allowedRoles.includes(req.user.role)) {
    return next(
      new AppError(
        "You do not have permission to perform this action",
        403,
        ERROR_CODES.FORBIDDEN,
      ),
    );
  }

  return next();
};

export default authorize;