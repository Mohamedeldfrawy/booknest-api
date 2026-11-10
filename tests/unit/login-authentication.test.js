import assert from "node:assert/strict";
import { mock, test } from "node:test";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../../src/modules/users/user.model.js";
import { login } from "../../src/modules/auth/auth.service.js";
import authenticate from "../../src/middleware/authenticate.js";

const createRequest = (authorization) => ({
  get: () => authorization,
});

const createNext = () => {
  const next = (error) => {
    next.error = error;
  };

  return next;
};

test("login returns a token and user after valid credentials", async () => {
  const originalSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "test-secret";
  const passwordHash = await bcrypt.hash("correct123", 4);
  const findOne = mock.method(User, "findOne", () => ({
    select: async () => ({
      _id: "507f1f77bcf86cd799439011",
      name: "Mohamed",
      email: "mohamed@example.com",
      role: "customer",
      password: passwordHash,
    }),
  }));

  try {
    const result = await login({
      email: "mohamed@example.com",
      password: "correct123",
    });
    const payload = jwt.verify(result.token, process.env.JWT_SECRET);

    assert.equal(result.user.email, "mohamed@example.com");
    assert.equal(payload.id, "507f1f77bcf86cd799439011");
    assert.equal(payload.role, "customer");
  } finally {
    findOne.mock.restore();
    process.env.JWT_SECRET = originalSecret;
  }
});

test("login returns the same generic error for unknown email and wrong password", async () => {
  const passwordHash = await bcrypt.hash("correct123", 4);
  const findOne = mock.method(User, "findOne");

  try {
    findOne.mock.mockImplementation(() => ({
      select: async () => null,
    }));

    await assert.rejects(
      login({ email: "missing@example.com", password: "wrong123" }),
      (error) =>
        error.statusCode === 401 &&
        error.code === "INVALID_CREDENTIALS" &&
        error.message === "Invalid email or password",
    );

    findOne.mock.mockImplementation(() => ({
      select: async () => ({
        _id: "507f1f77bcf86cd799439011",
        password: passwordHash,
        role: "customer",
      }),
    }));

    await assert.rejects(
      login({ email: "existing@example.com", password: "wrong123" }),
      (error) =>
        error.statusCode === 401 &&
        error.code === "INVALID_CREDENTIALS" &&
        error.message === "Invalid email or password",
    );
  } finally {
    findOne.mock.restore();
  }
});

test("authentication rejects missing and malformed authorization headers", async () => {
  for (const header of [undefined, "Basic token", "Bearer", "Bearer token extra"]) {
    const next = createNext();
    await authenticate(createRequest(header), {}, next);

    assert.equal(next.error.statusCode, 401);
    assert.equal(next.error.code, "AUTHENTICATION_REQUIRED");
    assert.equal(next.error.message, "Authentication required");
  }
});

test("authentication verifies the token and loads the current user", async () => {
  const originalSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "test-secret";
  const token = jwt.sign(
    { id: "507f1f77bcf86cd799439011", role: "admin" },
    process.env.JWT_SECRET,
    { expiresIn: "1d" },
  );
  const findById = mock.method(User, "findById", async () => ({
    _id: "507f1f77bcf86cd799439011",
    role: "customer",
  }));
  const request = createRequest(`Bearer ${token}`);
  const next = createNext();

  try {
    await authenticate(request, {}, next);

    assert.equal(next.error, undefined);
    assert.deepEqual(request.user, {
      userId: "507f1f77bcf86cd799439011",
      role: "customer",
    });
  } finally {
    findById.mock.restore();
    process.env.JWT_SECRET = originalSecret;
  }
});

test("authentication rejects invalid, expired, and unknown-user tokens", async () => {
  const originalSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "test-secret";
  const expiredToken = jwt.sign(
    { id: "507f1f77bcf86cd799439011", role: "customer" },
    process.env.JWT_SECRET,
    { expiresIn: -1 },
  );
  const findById = mock.method(User, "findById", async () => null);

  try {
    for (const token of ["not-a-token", expiredToken]) {
      const next = createNext();
      await authenticate(createRequest(`Bearer ${token}`), {}, next);

      assert.equal(next.error.statusCode, 401);
      assert.equal(next.error.code, "AUTHENTICATION_REQUIRED");
    }

    const validToken = jwt.sign(
      { id: "507f1f77bcf86cd799439011", role: "customer" },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
    );
    const next = createNext();
    await authenticate(createRequest(`Bearer ${validToken}`), {}, next);

    assert.equal(next.error.statusCode, 401);
    assert.equal(next.error.code, "AUTHENTICATION_REQUIRED");
  } finally {
    findById.mock.restore();
    process.env.JWT_SECRET = originalSecret;
  }
});

test("authentication rejects inactive users", async () => {
  const originalSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "test-secret";
  const token = jwt.sign(
    { id: "507f1f77bcf86cd799439011", role: "customer" },
    process.env.JWT_SECRET,
    { expiresIn: "1d" },
  );
  const findById = mock.method(User, "findById", async () => ({
    _id: "507f1f77bcf86cd799439011",
    role: "customer",
    isActive: false,
  }));
  const next = createNext();

  try {
    await authenticate(createRequest(`Bearer ${token}`), {}, next);

    assert.equal(next.error.statusCode, 401);
    assert.equal(next.error.code, "AUTHENTICATION_REQUIRED");
  } finally {
    findById.mock.restore();
    process.env.JWT_SECRET = originalSecret;
  }
});
