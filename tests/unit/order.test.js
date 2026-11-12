import assert from "node:assert/strict";
import mongoose from "mongoose";
import { mock, test } from "node:test";
import Book from "../../src/modules/books/book.model.js";
import Cart from "../../src/modules/carts/cart.model.js";
import Order from "../../src/modules/orders/order.model.js";
import {
  cancelOrder,
  checkout,
  getOrder,
  listOrders,
} from "../../src/modules/orders/order.service.js";
import { toPublicOrder } from "../../src/modules/orders/order.mapper.js";

const userId = "507f1f77bcf86cd799439011";
const firstBookId = "507f1f77bcf86cd799439012";
const secondBookId = "507f1f77bcf86cd799439013";
const orderId = "507f1f77bcf86cd799439014";

const createSession = () => {
  let committed = false;
  let rolledBack = false;
  const session = {
    withTransaction: async (operation) => {
      try {
        const result = await operation(session);
        committed = true;
        return result;
      } catch (error) {
        rolledBack = true;
        throw error;
      }
    },
    endSession: mock.fn(async () => {}),
  };

  return {
    session,
    wasCommitted: () => committed,
    wasRolledBack: () => rolledBack,
  };
};

const createBook = (id, overrides = {}) => ({
  _id: id,
  title: id === firstBookId ? "Clean Code" : "Domain-Driven Design",
  author: id === firstBookId ? "Robert Martin" : "Eric Evans",
  price: id === firstBookId ? 100 : 150,
  stock: 5,
  isDeleted: false,
  ...overrides,
});

const createCart = () => ({
  userId,
  items: [
    { bookId: firstBookId, quantity: 2 },
    { bookId: secondBookId, quantity: 1 },
  ],
});

test("Order schema preserves snapshots and restricts statuses", () => {
  assert.deepEqual(Order.schema.path("status").enumValues, [
    "pending",
    "paid",
    "shipped",
    "cancelled",
  ]);
  assert.equal(Order.schema.path("items").schema.path("price").options.required, true);
  assert.equal(Order.schema.path("items").schema.path("subtotal").options.required, true);
  assert.equal(Order.schema.path("stockRestoredAt").options.select, false);
});

test("checkout creates snapshots, deducts stock, and clears the cart transactionally", async () => {
  const transaction = createSession();
  const startSession = mock.method(
    mongoose,
    "startSession",
    async () => transaction.session,
  );
  const findOne = mock.method(Cart, "findOne", () => ({
    session: async () => createCart(),
  }));
  const find = mock.method(Book, "find", () => ({
    session: async () => [
      createBook(firstBookId, { price: 100 }),
      createBook(secondBookId, { price: 150 }),
    ],
  }));
  const findOneAndUpdate = mock.method(
    Book,
    "findOneAndUpdate",
    async (filter) => createBook(filter._id),
  );
  const save = mock.method(Order.prototype, "save", async function saveOrder() {
    return this;
  });
  const deleteOne = mock.method(Cart, "deleteOne", () => ({
    session: async () => ({ deletedCount: 1 }),
  }));

  try {
    const order = await checkout(userId);
    const savedOrder = save.mock.calls[0].this;

    assert.equal(order.status, "pending");
    assert.equal(savedOrder.totalPrice, 350);
    assert.deepEqual(
      savedOrder.items.map((item) => ({
        title: item.title,
        author: item.author,
        price: item.price,
        quantity: item.quantity,
        subtotal: item.subtotal,
      })),
      [
        {
          title: "Clean Code",
          author: "Robert Martin",
          price: 100,
          quantity: 2,
          subtotal: 200,
        },
        {
          title: "Domain-Driven Design",
          author: "Eric Evans",
          price: 150,
          quantity: 1,
          subtotal: 150,
        },
      ],
    );
    assert.equal(findOneAndUpdate.mock.calls.length, 2);
    assert.equal(deleteOne.mock.calls.length, 1);
    assert.equal(transaction.wasCommitted(), true);
    assert.equal(startSession.mock.calls.length, 1);
  } finally {
    startSession.mock.restore();
    findOne.mock.restore();
    find.mock.restore();
    findOneAndUpdate.mock.restore();
    save.mock.restore();
    deleteOne.mock.restore();
  }
});

test("checkout rejects an empty cart without mutating books or orders", async () => {
  const transaction = createSession();
  const startSession = mock.method(
    mongoose,
    "startSession",
    async () => transaction.session,
  );
  const findOne = mock.method(Cart, "findOne", () => ({
    session: async () => ({ userId, items: [] }),
  }));
  const findOneAndUpdate = mock.method(Book, "findOneAndUpdate");
  const save = mock.method(Order.prototype, "save");
  const deleteOne = mock.method(Cart, "deleteOne");

  try {
    await assert.rejects(
      checkout(userId),
      (error) => error.statusCode === 409 && error.code === "ORDER_CART_EMPTY",
    );
    assert.equal(findOneAndUpdate.mock.calls.length, 0);
    assert.equal(save.mock.calls.length, 0);
    assert.equal(deleteOne.mock.calls.length, 0);
    assert.equal(transaction.wasRolledBack(), true);
  } finally {
    startSession.mock.restore();
    findOne.mock.restore();
    findOneAndUpdate.mock.restore();
    save.mock.restore();
    deleteOne.mock.restore();
  }
});

test("checkout rolls back when any book has insufficient stock", async () => {
  const transaction = createSession();
  const startSession = mock.method(
    mongoose,
    "startSession",
    async () => transaction.session,
  );
  const findOne = mock.method(Cart, "findOne", () => ({
    session: async () => createCart(),
  }));
  const find = mock.method(Book, "find", () => ({
    session: async () => [
      createBook(firstBookId, { stock: 5 }),
      createBook(secondBookId, { stock: 1 }),
    ],
  }));
  let deductionCount = 0;
  const findOneAndUpdate = mock.method(
    Book,
    "findOneAndUpdate",
    async () => {
      deductionCount += 1;
      return deductionCount === 1 ? createBook(firstBookId, { stock: 3 }) : null;
    },
  );
  const save = mock.method(Order.prototype, "save");
  const deleteOne = mock.method(Cart, "deleteOne");

  try {
    await assert.rejects(
      checkout(userId),
      (error) =>
        error.statusCode === 409 &&
        error.code === "ORDER_STOCK_UNAVAILABLE",
    );
    assert.equal(findOneAndUpdate.mock.calls.length, 2);
    assert.equal(save.mock.calls.length, 0);
    assert.equal(deleteOne.mock.calls.length, 0);
    assert.equal(transaction.wasRolledBack(), true);
  } finally {
    startSession.mock.restore();
    findOne.mock.restore();
    find.mock.restore();
    findOneAndUpdate.mock.restore();
    save.mock.restore();
    deleteOne.mock.restore();
  }
});

test("customers list only their own orders while admins list all orders", async () => {
  const find = mock.method(Order, "find", () => ({
    sort: async () => ["all-orders"],
  }));
  const findOne = mock.method(Order, "findOne", async () => "customer-order");

  try {
    assert.deepEqual(await listOrders(userId, "admin"), ["all-orders"]);
    assert.equal(find.mock.calls[0].arguments[0], undefined);
    assert.deepEqual(await listOrders(userId, "customer"), ["all-orders"]);
    assert.deepEqual(find.mock.calls[1].arguments[0], { userId });
    assert.equal(await getOrder(orderId, userId, "customer"), "customer-order");
    assert.equal(findOne.mock.calls[0].arguments[0].userId, userId);
  } finally {
    find.mock.restore();
    findOne.mock.restore();
  }
});

test("customers cannot access another customer's order", async () => {
  const findOne = mock.method(Order, "findOne", async () => null);

  try {
    await assert.rejects(
      getOrder(orderId, userId, "customer"),
      (error) => error.statusCode === 404 && error.code === "ORDER_NOT_FOUND",
    );
  } finally {
    findOne.mock.restore();
  }
});

test("public order mapping returns preserved snapshots and hides restoration internals", () => {
  const publicOrder = toPublicOrder({
    _id: orderId,
    items: [
      {
        bookId: firstBookId,
        title: "Clean Code",
        author: "Robert Martin",
        price: 80,
        quantity: 2,
        subtotal: 160,
      },
    ],
    totalPrice: 160,
    status: "pending",
    stockRestoredAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });

  assert.equal(publicOrder.items[0].price, 80);
  assert.equal(publicOrder.totalPrice, 160);
  assert.equal("stockRestoredAt" in publicOrder, false);
});

test("cancellation restores stock once and repeated calls do not restore again", async () => {
  const transaction = createSession();
  const startSession = mock.method(
    mongoose,
    "startSession",
    async () => transaction.session,
  );
  const order = {
    _id: orderId,
    status: "pending",
    items: [{ bookId: firstBookId, quantity: 2 }],
  };
  const cancelledOrder = {
    ...order,
    status: "cancelled",
  };
  let findByIdCalls = 0;
  const findById = mock.method(Order, "findById", () => ({
    session: async () => {
      findByIdCalls += 1;
      return findByIdCalls === 1 ? order : cancelledOrder;
    },
  }));
  const findOneAndUpdate = mock.method(
    Order,
    "findOneAndUpdate",
    async () => cancelledOrder,
  );
  const updateOne = mock.method(Book, "updateOne", async () => ({
    modifiedCount: 1,
  }));

  try {
    await cancelOrder(orderId);
    await cancelOrder(orderId);

    assert.equal(findOneAndUpdate.mock.calls.length, 1);
    assert.equal(updateOne.mock.calls.length, 1);
    assert.equal(transaction.wasCommitted(), true);
  } finally {
    startSession.mock.restore();
    findById.mock.restore();
    findOneAndUpdate.mock.restore();
    updateOne.mock.restore();
  }
});
