import assert from "node:assert/strict";
import http from "node:http";
import { after, before, beforeEach, test } from "node:test";
import app from "../../src/app.js";
import User from "../../src/modules/users/user.model.js";
import {
  clearTestDatabase,
  connectTestDatabase,
  disconnectTestDatabase,
} from "../setup/database.js";

const user = {
  name: "Integration Customer",
  email: "integration.customer@example.com",
  password: "Password123",
};

let server;
let baseUrl;

const request = async (path, options = {}) => {
  const response = await fetch(`${baseUrl}${path}`, options);
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  return { response, body };
};

const jsonRequest = (path, body, options = {}) =>
  request(path, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers || {}),
    },
    body: JSON.stringify(body),
  });

before(async () => {
  await connectTestDatabase();
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(async () => {
  await clearTestDatabase();
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  await disconnectTestDatabase();
});

test("registration persists a customer with a hash and hides sensitive fields", async () => {
  const { response, body } = await jsonRequest("/api/users/register", user, {
    method: "POST",
  });
  const storedUser = await User.findOne({ email: user.email }).select(
    "+password",
  );

  assert.equal(response.status, 201);
  assert.equal(body.status, "success");
  assert.equal(body.data.user.email, user.email);
  assert.equal(body.data.user.role, "customer");
  assert.equal("password" in body.data.user, false);
  assert.ok(storedUser);
  assert.notEqual(storedUser.password, user.password);
  assert.equal(storedUser.role, "customer");
});

test("registration rejects role injection and duplicate emails", async () => {
  const first = await jsonRequest(
    "/api/users/register",
    { ...user, role: "admin" },
    { method: "POST" },
  );
  const second = await jsonRequest(
    "/api/users/register",
    user,
    { method: "POST" },
  );

  assert.equal(first.response.status, 400);
  assert.equal(second.response.status, 201);

  const duplicate = await jsonRequest(
    "/api/users/register",
    user,
    { method: "POST" },
  );

  assert.equal(duplicate.response.status, 409);
});

test("login returns a token and profile endpoints enforce ownership", async () => {
  const registration = await jsonRequest(
    "/api/users/register",
    user,
    { method: "POST" },
  );
  const token = registration.body.data.token;

  const login = await jsonRequest(
    "/api/users/login",
    { email: user.email, password: user.password },
    { method: "POST" },
  );
  const profile = await request("/api/users/me", {
    headers: { authorization: `Bearer ${token}` },
  });
  const update = await jsonRequest(
    "/api/users/me",
    { name: "Updated Customer" },
    {
      method: "PATCH",
      headers: { authorization: `Bearer ${token}` },
    },
  );
  const updatedUser = await User.findOne({ email: user.email });

  assert.equal(login.response.status, 200);
  assert.ok(login.body.data.token);
  assert.equal(profile.response.status, 200);
  assert.equal(profile.body.data.user.name, user.name);
  assert.equal(update.response.status, 200);
  assert.equal(update.body.data.user.name, "Updated Customer");
  assert.equal(updatedUser.name, "Updated Customer");
});

test("profile rejects protected fields and missing authentication", async () => {
  await jsonRequest(
    "/api/users/register",
    user,
    { method: "POST" },
  );

  const protectedUpdate = await jsonRequest(
    "/api/users/me",
    { name: "Changed", role: "admin" },
    { method: "PATCH" },
  );
  const unauthenticated = await request("/api/users/me");

  assert.equal(protectedUpdate.response.status, 401);
  assert.equal(unauthenticated.response.status, 401);
});

test("invalid authentication is rejected", async () => {
  const result = await request("/api/users/me", {
    headers: { authorization: "Bearer invalid-token" },
  });

  assert.equal(result.response.status, 401);
});
