import "dotenv/config";
import bcrypt from "bcrypt";
import Joi from "joi";
import mongoose from "mongoose";
import { pathToFileURL } from "node:url";
import { db } from "../config/database.js";
import User from "../modules/users/user.model.js";
import { BCRYPT_ROUNDS } from "../modules/users/user.service.js";

const adminConfigSchema = Joi.object({
  name: Joi.string().trim().required(),
  email: Joi.string().trim().lowercase().email().required(),
  password: Joi.string()
    .pattern(/^(?=.*[A-Za-z])(?=.*\d).{8,}$/)
    .required(),
}).unknown(false);

const getAdminConfig = () => {
  const { error, value } = adminConfigSchema.validate({
    name: process.env.ADMIN_NAME,
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
  });

  if (error) {
    throw new Error(`Invalid admin seed configuration: ${error.message}`);
  }

  return value;
};

const seedAdmin = async (config) => {
  const existingUser = await User.findOne({ email: config.email });

  if (existingUser) {
    if (existingUser.role === "admin") {
      return { created: false, user: existingUser };
    }

    throw new Error(
      "The admin email already belongs to a customer; no user was promoted",
    );
  }

  const passwordHash = await bcrypt.hash(config.password, BCRYPT_ROUNDS);

  try {
    const user = await User.create({
      name: config.name,
      email: config.email,
      password: passwordHash,
      role: "admin",
    });

    return { created: true, user };
  } catch (error) {
    if (error?.code === 11000 && error?.keyPattern?.email) {
      const user = await User.findOne({ email: config.email });

      if (user?.role === "admin") {
        return { created: false, user };
      }

      throw new Error(
        "The admin email already belongs to a customer; no user was promoted",
      );
    }

    throw error;
  }
};

const run = async () => {
  const config = getAdminConfig();

  try {
    await db();
    const result = await seedAdmin(config);
    const message = result.created
      ? "Admin account created successfully"
      : "Admin account already exists";

    console.log(`${message}: ${result.user.email}`);
  } finally {
    await mongoose.disconnect();
  }
};

const isMainModule =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  run().catch((error) => {
    console.error("Admin seed failed:", error.message);
    process.exitCode = 1;
  });
}

export { getAdminConfig, seedAdmin };