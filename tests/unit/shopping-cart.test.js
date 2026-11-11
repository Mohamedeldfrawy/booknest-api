import assert from "node:assert/strict";
import { mock, test } from "node:test";
import Book from "../../src/modules/books/book.model.js";
import Cart from "../../src/modules/carts/cart.model.js";
import {
  addCartItem,
  getCart,
  removeCartItem,
  updateCartItem,
} from "../../src/modules/carts/cart.service.js";

const userId = "507f1f77bcf86cd799439011";
const bookId = "507f1f77bcf86cd799439012";

const book = (overrides = {}) => ({
  _id: bookId,
  title: "Clean Code",
  author: "Robert Martin",
  description: "Software craftsmanship",
  price: 100,
  category: "programming",
  stock: 3,
  isDeleted: false,
  ...overrides,
});

const cart = (quantity = 5) => ({
  userId,
  items: [{ bookId, quantity }],
});

test("GET cart returns an empty response without creating a cart", async () => {
  const findOne = mock.method(Cart, "findOne", async () => null);
  const create = mock.method(Cart, "create");

  try {
    assert.deepEqual(await getCart(userId), {
      items: [],
      requestedTotal: 0,
      availableItemsTotal: 0,
    });
    assert.equal(create.mock.calls.length, 0);
  } finally {
    findOne.mock.restore();
    create.mock.restore();
  }
});

test("GET cart reflects current price, stock, and both totals", async () => {
  const findOne = mock.method(Cart, "findOne", async () => cart(5));
  const find = mock.method(Book, "find", async () => [book()]);

  try {
    const result = await getCart(userId);

    assert.equal(result.items[0].quantity, 5);
    assert.equal(result.items[0].currentPrice, 100);
    assert.equal(result.items[0].currentStock, 3);
    assert.equal(result.items[0].availableQuantity, 3);
    assert.equal(result.items[0].availability, "Insufficient Stock");
    assert.equal(result.items[0].requestedSubtotal, 500);
    assert.equal(result.items[0].availableSubtotal, 300);
    assert.equal(result.requestedTotal, 500);
    assert.equal(result.availableItemsTotal, 300);
  } finally {
    findOne.mock.restore();
    find.mock.restore();
  }
});

test("GET cart displays soft-deleted items as unavailable", async () => {
  const findOne = mock.method(Cart, "findOne", async () => cart(2));
  const find = mock.method(Book, "find", async () => [
    book({ isDeleted: true, price: 100 }),
  ]);

  try {
    const result = await getCart(userId);

    assert.equal(result.items[0].availability, "Unavailable");
    assert.equal(result.items[0].availableQuantity, 0);
    assert.equal(result.items[0].availableSubtotal, 0);
    assert.equal(result.requestedTotal, 200);
    assert.equal(result.availableItemsTotal, 0);
  } finally {
    findOne.mock.restore();
    find.mock.restore();
  }
});

test("adding a new book lazily creates a cart", async () => {
  let findOneCalls = 0;
  const findOne = mock.method(Cart, "findOne", async () => {
    findOneCalls += 1;
    return findOneCalls === 1
      ? null
      : { userId, items: [{ bookId, quantity: 2 }] };
  });
  const findBook = mock.method(Book, "findOne", async () => book({ stock: 5 }));
  const create = mock.method(Cart, "create", async (data) => data);
  const findBooks = mock.method(Book, "find", async () => [book({ stock: 5 })]);

  try {
    await addCartItem(userId, bookId, 2);

    assert.deepEqual(create.mock.calls[0].arguments[0], {
      userId,
      items: [{ bookId, quantity: 2 }],
    });
    assert.equal(findBook.mock.calls.length, 1);
  } finally {
    findOne.mock.restore();
    findBook.mock.restore();
    create.mock.restore();
    findBooks.mock.restore();
  }
});

test("adding an existing item increments it and rejects stock overflow", async () => {
  const findOne = mock.method(Cart, "findOne", async () => cart(2));
  const findBook = mock.method(Book, "findOne", async () => book({ stock: 5 }));
  const updateOne = mock.method(Cart, "updateOne", async () => ({
    matchedCount: 1,
  }));
  const findBooks = mock.method(Book, "find", async () => [book({ stock: 5 })]);

  try {
    await addCartItem(userId, bookId, 2);
    assert.equal(updateOne.mock.calls.length, 1);

    findOne.mock.mockImplementation(async () => cart(4));
    updateOne.mock.mockImplementation(async () => ({ matchedCount: 0 }));

    await assert.rejects(
      addCartItem(userId, bookId, 2),
      (error) =>
        error.statusCode === 409 &&
        error.code === "CART_QUANTITY_EXCEEDED",
    );
  } finally {
    findOne.mock.restore();
    findBook.mock.restore();
    updateOne.mock.restore();
    findBooks.mock.restore();
  }
});

test("adding an unavailable book or excessive quantity does not mutate the cart", async () => {
  const findBook = mock.method(Book, "findOne", async () => book({ stock: 0 }));
  const create = mock.method(Cart, "create");
  const updateOne = mock.method(Cart, "updateOne");

  try {
    await assert.rejects(
      addCartItem(userId, bookId, 1),
      (error) => error.code === "CART_OUT_OF_STOCK",
    );
    assert.equal(create.mock.calls.length, 0);
    assert.equal(updateOne.mock.calls.length, 0);
  } finally {
    findBook.mock.restore();
    create.mock.restore();
    updateOne.mock.restore();
  }
});

test("PATCH sets the final quantity and preserves the cart on stock failure", async () => {
  const findBook = mock.method(Book, "findOne", async () => book({ stock: 4 }));
  const updateOne = mock.method(Cart, "updateOne", async () => ({
    matchedCount: 1,
  }));
  const findOne = mock.method(Cart, "findOne", async () => cart(4));
  const findBooks = mock.method(Book, "find", async () => [book({ stock: 4 })]);

  try {
    const result = await updateCartItem(userId, bookId, 4);

    assert.equal(result.items[0].quantity, 4);
    assert.equal(updateOne.mock.calls.length, 1);
    assert.equal(updateOne.mock.calls[0].arguments[1].$set["items.$.quantity"], 4);

    await assert.rejects(
      updateCartItem(userId, bookId, 5),
      (error) => error.code === "CART_QUANTITY_EXCEEDED",
    );
    assert.equal(updateOne.mock.calls.length, 1);
  } finally {
    findBook.mock.restore();
    updateOne.mock.restore();
    findOne.mock.restore();
    findBooks.mock.restore();
  }
});

test("DELETE removes the last item and deletes the cart document", async () => {
  const findOneAndUpdate = mock.method(Cart, "findOneAndUpdate", async () => ({
    items: [],
  }));
  const deleteOne = mock.method(Cart, "deleteOne", async () => ({
    deletedCount: 1,
  }));

  try {
    const result = await removeCartItem(userId, bookId);

    assert.deepEqual(result, {
      items: [],
      requestedTotal: 0,
      availableItemsTotal: 0,
    });
    assert.equal(deleteOne.mock.calls.length, 1);
  } finally {
    findOneAndUpdate.mock.restore();
    deleteOne.mock.restore();
  }
});

test("DELETE returns 404 when the cart item does not exist", async () => {
  const findOneAndUpdate = mock.method(Cart, "findOneAndUpdate", async () => null);

  try {
    await assert.rejects(
      removeCartItem(userId, bookId),
      (error) =>
        error.statusCode === 404 && error.code === "CART_ITEM_NOT_FOUND",
    );
  } finally {
    findOneAndUpdate.mock.restore();
  }
});
