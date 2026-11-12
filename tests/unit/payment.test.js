import assert from "node:assert/strict";
import { mock, test } from "node:test";
import app from "../../src/app.js";
import Order from "../../src/modules/orders/order.model.js";
import { paymentSchema } from "../../src/modules/payments/payment.validation.js";
import { processPayment } from "../../src/modules/payments/payment.service.js";

const userId = "507f1f77bcf86cd799439011";
const orderId = "507f1f77bcf86cd799439012";

const pendingOrder = (overrides = {}) => ({
  _id: orderId,
  userId,
  status: "pending",
  ...overrides,
});

const mockPaymentOrder = (order = pendingOrder()) => {
  const findOne = mock.method(Order, "findOne", async () => order);
  const findOneAndUpdate = mock.method(
    Order,
    "findOneAndUpdate",
    async () => ({ ...order, status: "paid" }),
  );

  return {
    findOne,
    findOneAndUpdate,
  };
};

test("payment validation accepts a 16-digit numeric card", () => {
  const { error, value } = paymentSchema.validate({
    orderId,
    cardNumber: "1234567890123456",
  });

  assert.equal(error, undefined);
  assert.deepEqual(value, {
    orderId,
    cardNumber: "1234567890123456",
  });
});

test("payment validation rejects invalid card length", () => {
  const { error } = paymentSchema.validate({
    orderId,
    cardNumber: "123456789012345",
  });

  assert.ok(error);
});

test("payment validation rejects non-numeric cards", () => {
  const { error } = paymentSchema.validate({
    orderId,
    cardNumber: "12345678901234ab",
  });

  assert.ok(error);
});

test("payment validation rejects unknown fields", () => {
  const { error } = paymentSchema.validate({
    orderId,
    cardNumber: "1234567890123456",
    userId,
  });

  assert.ok(error);
});

test("a valid card succeeds and changes the order to paid", async () => {
  const { findOne, findOneAndUpdate } = mockPaymentOrder();

  try {
    const result = await processPayment(
      orderId,
      userId,
      "1234567890123456",
    );

    assert.deepEqual(result, {
      orderId,
      paymentStatus: "succeeded",
      orderStatus: "paid",
    });
    assert.deepEqual(findOneAndUpdate.mock.calls[0].arguments[0], {
      _id: orderId,
      userId,
      status: "pending",
    });
    assert.deepEqual(findOneAndUpdate.mock.calls[0].arguments[1], {
      $set: { status: "paid" },
    });
    assert.equal(findOne.mock.calls.length, 2);
  } finally {
    findOne.mock.restore();
    findOneAndUpdate.mock.restore();
  }
});

test("a card ending in 0000 fails and leaves the order pending", async () => {
  const { findOne, findOneAndUpdate } = mockPaymentOrder();

  try {
    const result = await processPayment(
      orderId,
      userId,
      "1234567890120000",
    );

    assert.deepEqual(result, {
      orderId,
      paymentStatus: "failed",
      orderStatus: "pending",
    });
    assert.equal(findOneAndUpdate.mock.calls.length, 0);
  } finally {
    findOne.mock.restore();
    findOneAndUpdate.mock.restore();
  }
});

test("a customer can pay their own order", async () => {
  const { findOne, findOneAndUpdate } = mockPaymentOrder();

  try {
    await processPayment(orderId, userId, "1234567890123456");
    assert.deepEqual(findOne.mock.calls[0].arguments[0], {
      _id: orderId,
      userId,
    });
  } finally {
    findOne.mock.restore();
    findOneAndUpdate.mock.restore();
  }
});

test("a customer cannot pay another customer's order", async () => {
  const findOne = mock.method(Order, "findOne", async () => null);
  const findOneAndUpdate = mock.method(Order, "findOneAndUpdate");

  try {
    await assert.rejects(
      processPayment(orderId, userId, "1234567890123456"),
      (error) => error.statusCode === 404 && error.code === "ORDER_NOT_FOUND",
    );
    assert.equal(findOneAndUpdate.mock.calls.length, 0);
  } finally {
    findOne.mock.restore();
    findOneAndUpdate.mock.restore();
  }
});

test("an admin can pay their own order", async () => {
  const { findOne, findOneAndUpdate } = mockPaymentOrder();

  try {
    const result = await processPayment(
      orderId,
      userId,
      "1234567890123456",
    );
    assert.equal(result.orderStatus, "paid");
  } finally {
    findOne.mock.restore();
    findOneAndUpdate.mock.restore();
  }
});

test("an admin cannot pay another customer's order", async () => {
  const findOne = mock.method(Order, "findOne", async () => null);
  const findOneAndUpdate = mock.method(Order, "findOneAndUpdate");

  try {
    await assert.rejects(
      processPayment(orderId, userId, "1234567890123456"),
      (error) => error.statusCode === 404 && error.code === "ORDER_NOT_FOUND",
    );
    assert.equal(findOneAndUpdate.mock.calls.length, 0);
  } finally {
    findOne.mock.restore();
    findOneAndUpdate.mock.restore();
  }
});

test("a nonexistent order returns 404", async () => {
  const findOne = mock.method(Order, "findOne", async () => null);

  try {
    await assert.rejects(
      processPayment(orderId, userId, "1234567890123456"),
      (error) => error.statusCode === 404,
    );
  } finally {
    findOne.mock.restore();
  }
});

for (const status of ["paid", "cancelled", "shipped"]) {
  test(`a ${status} order cannot be paid`, async () => {
    const findOne = mock.method(
      Order,
      "findOne",
      async () => pendingOrder({ status }),
    );

    try {
      await assert.rejects(
        processPayment(orderId, userId, "1234567890123456"),
        (error) =>
          error.statusCode === 409 &&
          error.code === "ORDER_PAYMENT_CONFLICT",
      );
    } finally {
      findOne.mock.restore();
    }
  });
}

test("only one concurrent successful payment wins the conditional update", async () => {
  const findOne = mock.method(Order, "findOne", async () => pendingOrder());
  let updateCalls = 0;
  const findOneAndUpdate = mock.method(
    Order,
    "findOneAndUpdate",
    async () => {
      updateCalls += 1;
      return updateCalls === 1 ? pendingOrder({ status: "paid" }) : null;
    },
  );

  try {
    const results = await Promise.allSettled([
      processPayment(orderId, userId, "1234567890123456"),
      processPayment(orderId, userId, "1234567890123456"),
    ]);

    assert.equal(
      results.filter((result) => result.status === "fulfilled").length,
      1,
    );
    assert.equal(
      results.filter(
        (result) =>
          result.status === "rejected" &&
          result.reason.code === "ORDER_PAYMENT_CONFLICT",
      ).length,
      1,
    );
    assert.equal(updateCalls, 2);
  } finally {
    findOne.mock.restore();
    findOneAndUpdate.mock.restore();
  }
});

test("payment endpoint requires authentication", async () => {
  const server = app.listen(0);

  try {
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/api/payments`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          orderId,
          cardNumber: "1234567890123456",
        }),
      },
    );

    assert.equal(response.status, 401);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("payment endpoint rejects invalid authentication", async () => {
  const originalSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "test-secret";
  const server = app.listen(0);

  try {
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/api/payments`,
      {
        method: "POST",
        headers: {
          authorization: "Bearer invalid-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          orderId,
          cardNumber: "1234567890123456",
        }),
      },
    );

    assert.equal(response.status, 401);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    process.env.JWT_SECRET = originalSecret;
  }
});
