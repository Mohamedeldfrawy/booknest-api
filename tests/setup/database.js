
import "dotenv/config";
import mongoose from "mongoose";
import { db } from "../../src/config/database.js";

const TEST_DATABASE_NAME = "booknest_test";

export const connectTestDatabase = async () => {
  const uri = process.env.MONGODB_TEST_URI;

  if (!uri) {
    throw new Error("MONGODB_TEST_URI is not defined.");
  }

  let databaseName;

  try {
    const parsedUri = new URL(uri);

    databaseName = decodeURIComponent(
      parsedUri.pathname.replace(/^\/+/, ""),
    );
  } catch {
    throw new Error("MONGODB_TEST_URI is invalid.");
  }

  if (databaseName !== TEST_DATABASE_NAME) {
    throw new Error(
      `Refusing to connect: expected ${TEST_DATABASE_NAME}, received ${databaseName || "no database name"}.`,
    );
  }

  await db(uri);

  if (mongoose.connection.name !== TEST_DATABASE_NAME) {
    await mongoose.disconnect();
    throw new Error("Connected database is not the test database.");
  }

  console.log("Test database connected successfully.");
};

export const clearTestDatabase = async () => {
  if (
    mongoose.connection.readyState !== 1 ||
    mongoose.connection.name !== TEST_DATABASE_NAME
  ) {
    throw new Error(
      "Refusing to clear data: connection is not using the test database.",
    );
  }

  const collections = await mongoose.connection.db.collections();

  for (const collection of collections) {
    if (!collection.collectionName.startsWith("system.")) {
      await collection.deleteMany({});
    }
  }
};

export const disconnectTestDatabase = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
};
