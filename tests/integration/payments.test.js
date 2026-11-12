import assert from "node:assert/strict";
import bcrypt from "bcrypt";
import http from "node:http";
import { after, before, beforeEach, test } from "node:test";
import app from "../../src/app.js";
import Book from "../../src/modules/books/book.model.js";
import Cart from "../../src/modules/carts/cart.model.js";
import Order from "../../src/modules/orders/order.model.js";
import User from "../../src/modules/users/user.model.js";
import {
  clearTestDatabase,
  connectTestDatabase,
  disconnectTestDatabase,
} from "../setup/database.js";

const customer = {
  name: "Payment Customer",
  email: "payment.customer@example.com",
  password: "CustomerPassword123",
};
const secondCustomer = {
  name: "Second Payment Customer",
  email: "payment.second@example.com",
  password: "CustomerPassword123",
};
const admin = {
  name: "Payment Admin",
  email: "payment.admin@example.com",
  password: "AdminPassword123",
};

let server;
let baseUrl;
let customerId;
let customerToken;
let secondCustomerToken;
let adminId;
let adminToken;

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

const createPendingOrder = async (userId, token, suffix) => {
  const bookData = {
    title: `Payment Book ${suffix}`,
    author: `Payment Author ${suffix}`,
    description: "Book for payment integration tests",
    price: 90,
    category: "business",
    stock: 2,
  };
  const book = await Book.create({
    ...bookData,
    normalizedTitle: bookData.title.toLowerCase(),
    normalizedAuthor: bookData.author.toLowerCase(),
  });
  await Cart.create({
    userId,
    items: [{ bookId: book._id, quantity: 1 }],
  });

  const result = await request("/api/orders", {
    method: "POST",
    headers: bearer(token),
  });

  assert.equal(result.response.status, 201);
  return result.body.data.order.id;
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
  const createdAdmin = await User.create({
    ...admin,
    password: await bcrypt.hash(admin.password, 4),
    role: "admin",
  });

  customerId = createdCustomer._id;
  adminId = createdAdmin._id;
  customerToken = await login(customer);
  secondCustomerToken = await login(secondCustomer);
  adminToken = await login(admin);
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  await disconnectTestDatabase();
});

test("valid payment changes a customer's pending order to paid", async () => {
  const orderId = await createPendingOrder(customerId, customerToken, "success");

  const result = await jsonRequest(
    "/api/payments",
    { orderId, cardNumber: "1234567890123456" },
    { method: "POST", headers: bearer(customerToken) },
  );
  const order = await Order.findById(orderId);

  assert.equal(result.response.status, 200);
  assert.equal(result.body.data.paymentStatus, "succeeded");
  assert.equal(result.body.data.orderStatus, "paid");
  assert.equal(order.status, "paid");
});

test("failed payment returns success HTTP processing with order still pending", async () => {
  const orderId = await createPendingOrder(customerId, customerToken, "failed");

  const result = await jsonRequest(
    "/api/payments",
    { orderId, cardNumber: "1234567890120000" },
    { method: "POST", headers: bearer(customerToken) },
  );
  const order = await Order.findById(orderId);

  assert.equal(result.response.status, 200);
  assert.equal(result.body.data.paymentStatus, "failed");
  assert.equal(result.body.data.orderStatus, "pending");
  assert.equal(order.status, "pending");
});

test("payment validation rejects invalid cards", async () => {
  const orderId = await createPendingOrder(customerId, customerToken, "invalid");

  const result = await jsonRequest(
    "/api/payments",
    { orderId, cardNumber: "not-a-card" },
    { method: "POST", headers: bearer(customerToken) },
  );

  assert.equal(result.response.status, 400);
});

test("customers cannot pay another customer's order", async () => {
  const orderId = await createPendingOrder(customerId, customerToken, "owner");

  const result = await jsonRequest(
    "/api/payments",
    { orderId, cardNumber: "1234567890123456" },
    { method: "POST", headers: bearer(secondCustomerToken) },
  );

  assert.equal(result.response.status, 404);
  assert.equal((await Order.findById(orderId)).status, "pending");
});

test("admins can pay their own orders but not another customer's order", async () => {
  const adminOrderId = await createPendingOrder(adminId, adminToken, "admin");
  const ownPayment = await jsonRequest(
    "/api/payments",
    { orderId: adminOrderId, cardNumber: "1234567890123456" },
    { method: "POST", headers: bearer(adminToken) },
  );
  const customerOrderId = await createPendingOrder(
    customerId,
    customerToken,
    "admin-owner",
  );
  const otherPayment = await jsonRequest(
    "/api/payments",
    { orderId: customerOrderId, cardNumber: "1234567890123456" },
    { method: "POST", headers: bearer(adminToken) },
  );

  assert.equal(ownPayment.response.status, 200);
  assert.equal(ownPayment.body.data.orderStatus, "paid");
  assert.equal(otherPayment.response.status, 404);
});

test("paid, cancelled, and shipped orders are not eligible for payment", async () => {
  for (const [status, suffix] of [
    ["paid", "paid"],
    ["cancelled", "cancelled"],
    ["shipped", "shipped"],
  ]) {
    const orderId = await createPendingOrder(
      customerId,
      customerToken,
      suffix,
    );
    await Order.updateOne({ _id: orderId }, { $set: { status } });

    const result = await jsonRequest(
      "/api/payments",
      { orderId, cardNumber: "1234567890123456" },
      { method: "POST", headers: bearer(customerToken) },
    );

    assert.equal(result.response.status, 409);
    assert.equal((await Order.findById(orderId)).status, status);
  }
});
