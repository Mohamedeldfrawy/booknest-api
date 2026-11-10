import bcrypt from "bcrypt";
import AppError from "../../errors/AppError.js";
import ERROR_CODES from "../../errors/error-codes.js";
import { generateToken } from "../auth/token.service.js";
import {
  create,
  findByEmail,
  findById,
  updateNameById,
} from "./user.repository.js";

export const BCRYPT_ROUNDS = 12;

const duplicateEmailError = () =>
  new AppError(
    "A user with this email already exists",
    409,
    ERROR_CODES.USER_ALREADY_EXISTS,
  );

const register = async ({ name, email, password }) => {
  const existingUser = await findByEmail(email);

  if (existingUser) {
    throw duplicateEmailError();
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  try {
    const user = await create({
      name,
      email,
      password: passwordHash,
      role: "customer",
    });

    return {
      user,
      token: generateToken({ id: user._id, role: user.role }),
    };
  } catch (error) {
    if (error?.code === 11000 && error?.keyPattern?.email) {
      throw duplicateEmailError();
    }

    throw error;
  }
};

const userNotFoundError = () =>
  new AppError("User profile not found", 404, ERROR_CODES.USER_NOT_FOUND);

const getProfile = async (userId) => {
  const user = await findById(userId);

  if (!user) {
    throw userNotFoundError();
  }

  return user;
};

const updateProfile = async (userId, { name }) => {
  const user = await updateNameById(userId, name);

  if (!user) {
    throw userNotFoundError();
  }

  return user;
};

export { getProfile, register, updateProfile };