import assert from "node:assert/strict";
import { mock, test } from "node:test";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../../src/modules/users/user.model.js";
import registerSchema from "../../src/modules/users/user.validation.js";
import { register } from "../../src/modules/users/user.service.js";
import { toPublicUser } from "../../src/modules/users/user.mapper.js";

test("registration validation normalizes valid input", () => {
  const { error, value } = registerSchema.validate({
    name: "Mohamed",
    email: "  MOHAMED@example.com ",
    password: "strong123",
  });

  assert.equal(error, undefined);
  assert.deepEqual(value, {
    name: "Mohamed",
    email: "mohamed@example.com",
    password: "strong123",
  });
});

test("registration validation rejects roles and weak passwords", () => {
  const { error } = registerSchema.validate({
    name: "Mohamed",
    email: "mohamed@example.com",
    password: "weak",
    role: "admin",
  });

  assert.ok(error);
  assert.match(error.message, /password|role/i);
});

test("public user mapper excludes password data", () => {
  const publicUser = toPublicUser({
    _id: "507f1f77bcf86cd799439011",
    name: "Mohamed",
    email: "mohamed@example.com",
    role: "customer",
    password: "hashed-password",
  });

  assert.deepEqual(publicUser, {
    id: "507f1f77bcf86cd799439011",
    name: "Mohamed",
    email: "mohamed@example.com",
    role: "customer",
  });
  assert.equal("password" in publicUser, false);
});

test("registration hashes the password, assigns customer, and creates a JWT", async () => {
  const originalSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "test-secret";

  const findByEmail = mock.method(User, "findOne", async () => null);
  const create = mock.method(User, "create", async (userData) => ({
    ...userData,
    _id: "507f1f77bcf86cd799439011",
  }));

  try {
    const result = await register({
      name: "Mohamed",
      email: "mohamed@example.com",
      password: "strong123",
    });
    const payload = jwt.verify(result.token, process.env.JWT_SECRET);

    assert.equal(result.user.role, "customer");
    assert.notEqual(result.user.password, "strong123");
    assert.equal(await bcrypt.compare("strong123", result.user.password), true);
    assert.equal(payload.id, "507f1f77bcf86cd799439011");
    assert.equal(payload.role, "customer");
    assert.equal(findByEmail.mock.calls.length, 1);
    assert.equal(create.mock.calls.length, 1);
  } finally {
    findByEmail.mock.restore();
    create.mock.restore();
    process.env.JWT_SECRET = originalSecret;
  }
});

test("registration maps an existing email to a conflict error", async () => {
  const findByEmail = mock.method(User, "findOne", async () => ({ _id: "existing" }));

  try {
    await assert.rejects(
      register({
        name: "Mohamed",
        email: "mohamed@example.com",
        password: "strong123",
      }),
      (error) =>
        error.statusCode === 409 && error.code === "USER_ALREADY_EXISTS",
    );
  } finally {
    findByEmail.mock.restore();
  }
});

test("registration maps a unique-index race to a conflict error", async () => {
  const findByEmail = mock.method(User, "findOne", async () => null);
  const create = mock.method(User, "create", async () => {
    const error = new Error("duplicate key");
    error.code = 11000;
    error.keyPattern = { email: 1 };
    throw error;
  });

  try {
    await assert.rejects(
      register({
        name: "Mohamed",
        email: "mohamed@example.com",
        password: "strong123",
      }),
      (error) =>
        error.statusCode === 409 && error.code === "USER_ALREADY_EXISTS",
    );
  } finally {
    findByEmail.mock.restore();
    create.mock.restore();
  }
});
