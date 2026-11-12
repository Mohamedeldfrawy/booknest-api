import assert from "node:assert/strict";
import bcrypt from "bcrypt";
import http from "node:http";
import { after, before, beforeEach, test } from "node:test";
import app from "../../src/app.js";
import Book from "../../src/modules/books/book.model.js";
import Cart from "../../src/modules/carts/cart.model.js";
import User from "../../src/modules/users/user.model.js";
import Order from "../../src/modules/orders/order.model.js";
import { cancelOrder } from "../../src/modules/orders/order.service.js";
import {
  clearTestDatabase,
  connectTestDatabase,
  disconnectTestDatabase,
} from "../setup/database.js";

const customer = {
  name: "Order Customer",
  email: "order.customer@example.com",
  password: "CustomerPassword123",
};
const secondCustomer = {
  name: "Second Order Customer",
  email: "order.second@example.com",
  password: "CustomerPassword123",
};

let server;
let baseUrl;
let customerId;
let customerToken;
let secondCustomerToken;

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
    title: "Order Book",
    author: "Order Author",
    description: "Book for order integration tests",
    price: 100,
    category: "programming",
    stock: 5,
    ...overrides,
  };

  return Book.create({
    ...data,
    normalizedTitle: data.title.trim().toLowerCase(),
    normalizedAuthor: data.author.trim().toLowerCase(),
  });
};

const createCart = (bookId, quantity) =>
  Cart.create({
    userId: customerId,
    items: [{ bookId, quantity }],
  });

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
  customerId = createdCustomer._id;
  customerToken = await login(customer);
  secondCustomerToken = await login(secondCustomer);
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  await disconnectTestDatabase();
});

test("checkout creates snapshots, deducts stock, and clears the cart", async () => {
  const book = await createBook({ price: 125, stock: 4 });
  await createCart(book._id, 2);

  const checkout = await request("/api/orders", {
    method: "POST",
    headers: bearer(customerToken),
  });
  const order = await Order.findOne({ userId: customerId });
  const storedBook = await Book.findById(book._id);
  const storedCart = await Cart.findOne({ userId: customerId });

  assert.equal(checkout.response.status, 201);
  assert.equal(checkout.body.data.order.status, "pending");
  assert.equal(checkout.body.data.order.items[0].price, 125);
  assert.equal(checkout.body.data.order.items[0].subtotal, 250);
  assert.equal(checkout.body.data.order.totalPrice, 250);
  assert.equal(storedBook.stock, 2);
  assert.ok(order);
  assert.equal(storedCart, null);

  await Book.updateOne({ _id: book._id }, { $set: { price: 200 } });
  const details = await request(`/api/orders/${order._id}`, {
    headers: bearer(customerToken),
  });

  assert.equal(details.response.status, 200);
  assert.equal(details.body.data.order.items[0].price, 125);
  assert.equal(details.body.data.order.totalPrice, 250);
});

test("insufficient stock rejects checkout without changing stock, order, or cart", async () => {
  const book = await createBook({ stock: 1 });
  await createCart(book._id, 2);

  const checkout = await request("/api/orders", {
    method: "POST",
    headers: bearer(customerToken),
  });
  const storedBook = await Book.findById(book._id);
  const storedCart = await Cart.findOne({ userId: customerId });
  const orderCount = await Order.countDocuments({ userId: customerId });

  assert.equal(checkout.response.status, 409);
  assert.equal(storedBook.stock, 1);
  assert.equal(storedCart.items[0].quantity, 2);
  assert.equal(orderCount, 0);
});

test("customers cannot access another customer's order", async () => {
  const book = await createBook({ stock: 2 });
  await createCart(book._id, 1);
  const checkout = await request("/api/orders", {
    method: "POST",
    headers: bearer(customerToken),
  });
  const orderId = checkout.body.data.order.id;

  const result = await request(`/api/orders/${orderId}`, {
    headers: bearer(secondCustomerToken),
  });

  assert.equal(result.response.status, 404);
});

test("concurrent checkout attempts create one order and never negative stock", async () => {
  const book = await createBook({ stock: 1 });
  await createCart(book._id, 1);

  const results = await Promise.all([
    request("/api/orders", {
      method: "POST",
      headers: bearer(customerToken),
    }),
    request("/api/orders", {
      method: "POST",
      headers: bearer(customerToken),
    }),
  ]);
  const storedBook = await Book.findById(book._id);
  const orderCount = await Order.countDocuments({ userId: customerId });

  assert.deepEqual(
    results.map((result) => result.response.status).sort(),
    [201, 409],
  );
  assert.equal(storedBook.stock, 0);
  assert.equal(orderCount, 1);
});

test("internal cancellation restores stock exactly once", async () => {
  const book = await createBook({ stock: 3 });
  await createCart(book._id, 2);
  const checkout = await request("/api/orders", {
    method: "POST",
    headers: bearer(customerToken),
  });
  const orderId = checkout.body.data.order.id;

  const cancelled = await cancelOrder(orderId);
  const repeated = await cancelOrder(orderId);
  const storedBook = await Book.findById(book._id);
  const storedOrder = await Order.findById(orderId);

  assert.equal(cancelled.status, "cancelled");
  assert.equal(repeated.status, "cancelled");
  assert.equal(storedBook.stock, 3);
  assert.equal(storedOrder.status, "cancelled");
});
