import assert from "node:assert/strict";
import bcrypt from "bcrypt";
import http from "node:http";
import { after, before, beforeEach, test } from "node:test";
import app from "../../src/app.js";
import Book from "../../src/modules/books/book.model.js";
import Cart from "../../src/modules/carts/cart.model.js";
import User from "../../src/modules/users/user.model.js";
import {
  clearTestDatabase,
  connectTestDatabase,
  disconnectTestDatabase,
} from "../setup/database.js";

const customer = {
  name: "Cart Customer",
  email: "cart.customer@example.com",
  password: "CustomerPassword123",
};
const secondCustomer = {
  name: "Second Cart Customer",
  email: "cart.second@example.com",
  password: "CustomerPassword123",
};

let server;
let baseUrl;
let customerToken;
let secondCustomerToken;
let customerId;
let book;

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

const createBook = async (overrides = {}) => {
  const data = {
    title: "Cart Book",
    author: "Cart Author",
    description: "Book for cart integration tests",
    price: 80,
    category: "programming",
    stock: 4,
    ...overrides,
  };
  const normalized = {
    ...data,
    normalizedTitle: data.title.trim().toLowerCase(),
    normalizedAuthor: data.author.trim().toLowerCase(),
  };

  return Book.create(normalized);
};

before(async () => {
  await connectTestDatabase();
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(async () => {
  await clearTestDatabase();
  const createdCustomer = await User.create({
    ...customer,
    password: await bcrypt.hash(customer.password, 4),
    role: "customer",
  });
  await User.create({
    ...secondCustomer,
    password: await bcrypt.hash(secondCustomer.password, 4),
    role: "customer",
  });
  customerToken = await login(customer);
  secondCustomerToken = await login(secondCustomer);
  customerId = createdCustomer._id;
  book = await createBook();
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  await disconnectTestDatabase();
});

test("cart persists added items and renders current price and availability", async () => {
  const empty = await request("/api/cart", {
    headers: bearer(customerToken),
  });
  const added = await jsonRequest(
    "/api/cart/items",
    { bookId: book._id.toString(), quantity: 2 },
    {
      method: "POST",
      headers: bearer(customerToken),
    },
  );
  const storedCart = await Cart.findOne({ userId: customerId });

  assert.equal(empty.response.status, 200);
  assert.deepEqual(empty.body.data.items, []);
  assert.equal(added.response.status, 200);
  assert.equal(added.body.data.items[0].currentPrice, 80);
  assert.equal(added.body.data.items[0].currentStock, 4);
  assert.equal(added.body.data.items[0].availability, "In Stock");
  assert.equal(added.body.data.items[0].requestedSubtotal, 160);
  assert.ok(storedCart);
  assert.equal(storedCart.items[0].quantity, 2);
});

test("cart quantity updates and item removal persist", async () => {
  const bookId = book._id.toString();
  await jsonRequest(
    "/api/cart/items",
    { bookId, quantity: 1 },
    { method: "POST", headers: bearer(customerToken) },
  );

  const updated = await jsonRequest(
    `/api/cart/items/${bookId}`,
    { quantity: 3 },
    { method: "PATCH", headers: bearer(customerToken) },
  );
  const removed = await request(`/api/cart/items/${bookId}`, {
    method: "DELETE",
    headers: bearer(customerToken),
  });
  const storedCart = await Cart.findOne({ userId: customerId });

  assert.equal(updated.response.status, 200);
  assert.equal(updated.body.data.items[0].quantity, 3);
  assert.equal(removed.response.status, 200);
  assert.deepEqual(removed.body.data.items, []);
  assert.equal(storedCart, null);
});

test("cart ownership is isolated between authenticated users", async () => {
  const add = await jsonRequest(
    "/api/cart/items",
    { bookId: book._id.toString(), quantity: 1 },
    { method: "POST", headers: bearer(customerToken) },
  );
  const secondCart = await request("/api/cart", {
    headers: bearer(secondCustomerToken),
  });

  assert.equal(add.response.status, 200);
  assert.equal(secondCart.response.status, 200);
  assert.deepEqual(secondCart.body.data.items, []);
});

test("cart rejects quantities above stock and unavailable books", async () => {
  const excessive = await jsonRequest(
    "/api/cart/items",
    { bookId: book._id.toString(), quantity: 5 },
    { method: "POST", headers: bearer(customerToken) },
  );
  const unavailable = await createBook({
    title: "Unavailable Cart Book",
    author: "Unavailable Author",
    stock: 0,
  });
  const outOfStock = await jsonRequest(
    "/api/cart/items",
    { bookId: unavailable._id.toString(), quantity: 1 },
    { method: "POST", headers: bearer(customerToken) },
  );
  const storedCart = await Cart.findOne({ userId: customer._id });

  assert.equal(excessive.response.status, 409);
  assert.equal(outOfStock.response.status, 409);
  assert.equal(storedCart, null);
});

test("soft-deleted cart books remain visible as unavailable", async () => {
  await Cart.create({
    userId: customerId,
    items: [{ bookId: book._id, quantity: 1 }],
  });
  await Book.updateOne(
    { _id: book._id },
    { $set: { isDeleted: true, deletedAt: new Date() } },
  );

  const result = await request("/api/cart", {
    headers: bearer(customerToken),
  });

  assert.equal(result.response.status, 200);
  assert.equal(result.body.data.items[0].availability, "Unavailable");
  assert.equal(result.body.data.items[0].availableQuantity, 0);
});
