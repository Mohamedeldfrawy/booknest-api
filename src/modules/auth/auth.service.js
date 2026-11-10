import bcrypt from "bcrypt";
import AppError from "../../errors/AppError.js";
import ERROR_CODES from "../../errors/error-codes.js";
import { generateToken } from "./token.service.js";
import { findByEmailWithPassword } from "../users/user.repository.js";

const invalidCredentialsError = () =>
  new AppError(
    "Invalid email or password",
    401,
    ERROR_CODES.INVALID_CREDENTIALS,
  );

const login = async ({ email, password }) => {
  const user = await findByEmailWithPassword(email);

  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw invalidCredentialsError();
  }

  return {
    user,
    token: generateToken({ id: user._id, role: user.role }),
  };
};

export { login };