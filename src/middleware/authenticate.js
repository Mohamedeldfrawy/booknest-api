import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import AppError from "../errors/AppError.js";
import ERROR_CODES from "../errors/error-codes.js";
import { findById } from "../modules/users/user.repository.js";

const authenticationError = () =>
  new AppError(
    "Authentication required",
    401,
    ERROR_CODES.AUTHENTICATION_REQUIRED,
  );

const getToken = (authorizationHeader) => {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token, ...extraParts] = authorizationHeader.split(" ");

  if (
    scheme !== "Bearer" ||
    !token ||
    extraParts.length > 0
  ) {
    return null;
  }

  return token;
};

const authenticate = async (req, res, next) => {
  const token = getToken(req.get("Authorization"));

  if (!token) {
    return next(authenticationError());
  }

  let payload;

  try {
    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is not configured");
    }

    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
      return next(authenticationError());
    }

    return next(error);
  }

  if (
    !payload ||
    typeof payload !== "object" ||
    typeof payload.id !== "string" ||
    !mongoose.isValidObjectId(payload.id)
  ) {
    return next(authenticationError());
  }

  const user = await findById(payload.id);

  if (!user || user.isActive === false) {
    return next(authenticationError());
  }

  req.user = {
    userId: user._id.toString(),
    role: user.role,
  };

  return next();
};

export default authenticate;