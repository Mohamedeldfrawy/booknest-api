import assert from "node:assert/strict";
import { mock, test } from "node:test";
import Book from "../../src/modules/books/book.model.js";
import {
  browseBooksQuerySchema,
  bookIdSchema,
} from "../../src/modules/books/book.validation.js";
import { toPublicBrowseBook } from "../../src/modules/books/book.mapper.js";
import { browseBooks, getBook } from "../../src/modules/books/book.service.js";

const createBook = (overrides = {}) => ({
  _id: "507f1f77bcf86cd799439011",
  title: "Clean Code",
  author: "Robert Martin",
  description: "Software craftsmanship",
  price: 30,
  category: "programming",
  stock: 0,
  isDeleted: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

test("browse validation applies defaults and normalizes filters", () => {
  const { error, value } = browseBooksQuerySchema.validate({
    search: " clean ",
    category: " PROGRAMMING ",
    minPrice: "100",
    maxPrice: "300",
  });

  assert.equal(error, undefined);
  assert.deepEqual(value, {
    search: "clean",
    category: "programming",
    minPrice: 100,
    maxPrice: 300,
    page: 1,
    limit: 10,
  });
});

test("browse validation rejects invalid category, prices, sort, pagination, and unknown fields", () => {
  const invalid = browseBooksQuerySchema.validate({
    category: "invalid",
    minPrice: -1,
    sort: "random",
    page: 0,
    limit: 51,
    extra: "not-supported",
  });

  assert.ok(invalid.error);
});

test("browse service returns filtered pagination metadata and empty pages successfully", async () => {
  const find = mock.method(Book, "find", () => ({
    sort: () => ({
      skip: () => ({
        limit: async () => [],
      }),
    }),
  }));
  const countDocuments = mock.method(Book, "countDocuments", async () => 25);
  const query = {
    search: "clean",
    category: "programming",
    minPrice: 100,
    maxPrice: 500,
    sort: "price_asc",
    page: 4,
    limit: 10,
  };

  try {
    const result = await browseBooks(query);

    assert.deepEqual(result.books, []);
    assert.deepEqual(result.pagination, {
      total: 25,
      page: 4,
      limit: 10,
      totalPages: 3,
    });
    assert.equal(find.mock.calls.length, 1);
    assert.equal(countDocuments.mock.calls.length, 1);
  } finally {
    find.mock.restore();
    countDocuments.mock.restore();
  }
});

test("browse service returns zero total pages for no matches", async () => {
  const find = mock.method(Book, "find", () => ({
    sort: () => ({
      skip: () => ({
        limit: async () => [],
      }),
    }),
  }));
  const countDocuments = mock.method(Book, "countDocuments", async () => 0);

  try {
    const result = await browseBooks({
      page: 1,
      limit: 10,
      sort: "newest",
    });

    assert.deepEqual(result.pagination, {
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 0,
    });
  } finally {
    find.mock.restore();
    countDocuments.mock.restore();
  }
});

test("browse service rejects a reversed inclusive price range", async () => {
  await assert.rejects(
    browseBooks({
      minPrice: 300,
      maxPrice: 100,
      page: 1,
      limit: 10,
      sort: "newest",
    }),
    (error) => error.statusCode === 400 && error.code === "VALIDATION_ERROR",
  );
});

test("get book queries only active books", async () => {
  const findOne = mock.method(Book, "findOne", async (filter) => {
    assert.deepEqual(filter, {
      _id: "507f1f77bcf86cd799439011",
      isDeleted: false,
    });
    return createBook();
  });

  try {
    assert.equal(
      (await getBook("507f1f77bcf86cd799439011")).title,
      "Clean Code",
    );
  } finally {
    findOne.mock.restore();
  }
});

test("get book returns not found for missing or soft-deleted books", async () => {
  const findOne = mock.method(Book, "findOne", async () => null);

  try {
    await assert.rejects(
      getBook("507f1f77bcf86cd799439011"),
      (error) => error.statusCode === 404 && error.code === "BOOK_NOT_FOUND",
    );
  } finally {
    findOne.mock.restore();
  }
});

test("public browse mapping includes availability and excludes internal fields", () => {
  const publicBook = toPublicBrowseBook(
    createBook({
      stock: 2,
      normalizedTitle: "clean code",
      normalizedAuthor: "robert martin",
      deletedAt: null,
    }),
  );

  assert.equal(publicBook.availability, "In Stock");
  assert.equal("isDeleted" in publicBook, false);
  assert.equal("normalizedTitle" in publicBook, false);
  assert.equal("updatedAt" in publicBook, false);
});

test("invalid object IDs remain rejected for get-by-id", () => {
  assert.equal(bookIdSchema.validate({ id: "bad-id" }).error.message, "Invalid book ID");
});
