import assert from "node:assert/strict";
import bcrypt from "bcrypt";
import http from "node:http";
import { after, before, beforeEach, test } from "node:test";
import app from "../../src/app.js";
import User from "../../src/modules/users/user.model.js";
import {
  clearTestDatabase,
  connectTestDatabase,
  disconnectTestDatabase,
} from "../setup/database.js";

const adminCredentials = {
  name: "Integration Admin",
  email: "integration.admin@example.com",
  password: "AdminPassword123",
};
const customerCredentials = {
  name: "Integration Customer",
  email: "books.customer@example.com",
  password: "CustomerPassword123",
};

const firstBook = {
  title: "Clean Code",
  author: "Robert Martin",
  description: "Software craftsmanship",
  price: 100,
  category: "programming",
  stock: 5,
};
const secondBook = {
  title: "A Brief History",
  author: "Jane Historian",
  description: "A history book",
  price: 200,
  category: "history",
  stock: 0,
};

let server;
let baseUrl;
let adminToken;
let customerToken;

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

const bearer = (token) => ({ authorization: `Bearer ${token}` });

const login = async ({ email, password }) => {
  const result = await jsonRequest(
    "/api/users/login",
    { email, password },
    { method: "POST" },
  );

  assert.equal(result.response.status, 200);
  return result.body.data.token;
};

before(async () => {
  await connectTestDatabase();
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(async () => {
  await clearTestDatabase();
  const passwordHash = await bcrypt.hash(adminCredentials.password, 4);

  await User.create({
    name: adminCredentials.name,
    email: adminCredentials.email,
    password: passwordHash,
    role: "admin",
  });
  await User.create({
    name: customerCredentials.name,
    email: customerCredentials.email,
    password: await bcrypt.hash(customerCredentials.password, 4),
    role: "customer",
  });

  adminToken = await login(adminCredentials);
  customerToken = await login(customerCredentials);
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  await disconnectTestDatabase();
});

test("admin can create and update a book", async () => {
  const created = await jsonRequest("/api/books", firstBook, {
    method: "POST",
    headers: bearer(adminToken),
  });
  const bookId = created.body.data.book.id;
  const updated = await jsonRequest(
    `/api/books/${bookId}`,
    { price: 120, stock: 8 },
    {
      method: "PATCH",
      headers: bearer(adminToken),
    },
  );

  assert.equal(created.response.status, 201);
  assert.equal(created.body.data.book.title, firstBook.title);
  assert.equal(updated.response.status, 200);
  assert.equal(updated.body.data.book.price, 120);
  assert.equal(updated.body.data.book.stock, 8);
});

test("customers cannot manage books and duplicate books are rejected", async () => {
  const forbidden = await jsonRequest("/api/books", firstBook, {
    method: "POST",
    headers: bearer(customerToken),
  });
  const created = await jsonRequest("/api/books", firstBook, {
    method: "POST",
    headers: bearer(adminToken),
  });
  const duplicate = await jsonRequest(
    "/api/books",
    { ...firstBook, title: "  clean code  ", author: "robert martin" },
    {
      method: "POST",
      headers: bearer(adminToken),
    },
  );

  assert.equal(forbidden.response.status, 403);
  assert.equal(created.response.status, 201);
  assert.equal(duplicate.response.status, 409);
});

test("public browsing supports search, filtering, sorting, and pagination", async () => {
  await jsonRequest("/api/books", firstBook, {
    method: "POST",
    headers: bearer(adminToken),
  });
  await jsonRequest("/api/books", secondBook, {
    method: "POST",
    headers: bearer(adminToken),
  });

  const result = await request(
    "/api/books?search=clean&category=programming&minPrice=100&maxPrice=100&sort=price_asc&page=1&limit=1",
  );

  assert.equal(result.response.status, 200);
  assert.equal(result.body.data.length, 1);
  assert.equal(result.body.data[0].title, "Clean Code");
  assert.equal(result.body.pagination.total, 1);
  assert.equal(result.body.pagination.totalPages, 1);
});

test("out-of-stock books remain public and invalid browse filters fail", async () => {
  await jsonRequest("/api/books", secondBook, {
    method: "POST",
    headers: bearer(adminToken),
  });

  const publicBooks = await request("/api/books?category=history");
  const invalid = await request("/api/books?category=unknown");

  assert.equal(publicBooks.response.status, 200);
  assert.equal(publicBooks.body.data[0].stock, 0);
  assert.equal(publicBooks.body.data[0].availability, "Out of Stock");
  assert.equal(invalid.response.status, 400);
});

test("soft-deleted books are excluded from public reads", async () => {
  const created = await jsonRequest("/api/books", firstBook, {
    method: "POST",
    headers: bearer(adminToken),
  });
  const bookId = created.body.data.book.id;

  const deleted = await request(`/api/books/${bookId}`, {
    method: "DELETE",
    headers: bearer(adminToken),
  });
  const list = await request("/api/books");
  const details = await request(`/api/books/${bookId}`);

  assert.equal(deleted.response.status, 200);
  assert.equal(list.body.data.length, 0);
  assert.equal(details.response.status, 404);
});

test("invalid book data and invalid IDs are rejected", async () => {
  const invalidBook = await jsonRequest(
    "/api/books",
    { ...firstBook, price: 0, stock: -1, extra: true },
    {
      method: "POST",
      headers: bearer(adminToken),
    },
  );
  const invalidId = await request("/api/books/not-an-id", {
    headers: bearer(adminToken),
  });

  assert.equal(invalidBook.response.status, 400);
  assert.equal(invalidId.response.status, 400);
});
