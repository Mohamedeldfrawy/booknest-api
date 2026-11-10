import assert from "node:assert/strict";
import { mock, test } from "node:test";
import Book from "../../src/modules/books/book.model.js";
import {
  bookIdSchema,
  createBookSchema,
  updateBookSchema,
} from "../../src/modules/books/book.validation.js";
import { toPublicBook } from "../../src/modules/books/book.mapper.js";
import {
  createBook,
  deleteBook,
  updateBook,
} from "../../src/modules/books/book.service.js";

const bookInput = {
  title: "Clean Code",
  author: "Robert Martin",
  description: "A software craftsmanship book",
  price: 30,
  category: "programming",
  stock: 5,
};

test("book schema uses the shared categories and duplicate index", () => {
  assert.deepEqual(
    Book.schema.path("category").enumValues,
    createBookSchema.describe().keys.category.allow,
  );
  assert.deepEqual(Book.schema.indexes(), [
    [
      { normalizedTitle: 1, normalizedAuthor: 1 },
      { unique: true },
    ],
  ]);
});

test("book validation normalizes input and rejects invalid values", () => {
  const valid = createBookSchema.validate({
    ...bookInput,
    title: "  Clean Code ",
    category: " PROGRAMMING ",
  });
  const invalid = createBookSchema.validate({
    ...bookInput,
    price: 0,
    stock: 1.5,
    category: "unknown",
  });

  assert.equal(valid.error, undefined);
  assert.equal(valid.value.title, "Clean Code");
  assert.equal(valid.value.category, "programming");
  assert.ok(invalid.error);
});

test("book validation rejects empty updates, protected fields, and invalid IDs", () => {
  assert.ok(updateBookSchema.validate({}).error);
  assert.ok(updateBookSchema.validate({ _id: "other-id" }).error);
  assert.equal(bookIdSchema.validate({ id: "invalid-id" }).error.message, "Invalid book ID");
});

test("book creation stores normalized duplicate keys", async () => {
  const findOne = mock.method(Book, "findOne", async () => null);
  const create = mock.method(Book, "create", async (data) => ({
    ...data,
    _id: "507f1f77bcf86cd799439011",
  }));

  try {
    const result = await createBook({
      ...bookInput,
      title: " Clean Code ",
      author: " ROBERT MARTIN ",
    });

    assert.equal(result.normalizedTitle, "clean code");
    assert.equal(result.normalizedAuthor, "robert martin");
    assert.equal(create.mock.calls.length, 1);
  } finally {
    findOne.mock.restore();
    create.mock.restore();
  }
});

test("book creation rejects a duplicate including a soft-deleted book", async () => {
  const findOne = mock.method(Book, "findOne", async () => ({
    _id: "507f1f77bcf86cd799439011",
    isDeleted: true,
  }));
  const create = mock.method(Book, "create");

  try {
    await assert.rejects(
      createBook(bookInput),
      (error) =>
        error.statusCode === 409 && error.code === "BOOK_ALREADY_EXISTS",
    );
    assert.equal(create.mock.calls.length, 0);
  } finally {
    findOne.mock.restore();
    create.mock.restore();
  }
});

test("book update checks conflicts and updates only the active book", async () => {
  const currentBook = {
    _id: "507f1f77bcf86cd799439011",
    title: bookInput.title,
    author: bookInput.author,
    normalizedTitle: "clean code",
    normalizedAuthor: "robert martin",
    isDeleted: false,
  };
  const findOne = mock.method(Book, "findOne", (query) => {
    if (query._id && query.isDeleted === false) {
      return { select: async () => currentBook };
    }

    return Promise.resolve(null);
  });
  const findOneAndUpdate = mock.method(Book, "findOneAndUpdate", async (query, update) => ({
    ...currentBook,
    ...update.$set,
  }));

  try {
    const result = await updateBook(currentBook._id, { price: 35 });

    assert.equal(result.price, 35);
    assert.equal(result.normalizedTitle, "clean code");
    assert.equal(findOneAndUpdate.mock.calls.length, 1);
  } finally {
    findOne.mock.restore();
    findOneAndUpdate.mock.restore();
  }
});

test("book deletion soft-deletes without removing the document", async () => {
  const softDelete = mock.method(Book, "findOneAndUpdate", async (query, update) => ({
    _id: query._id,
    isDeleted: update.$set.isDeleted,
    deletedAt: update.$set.deletedAt,
  }));

  try {
    const result = await deleteBook("507f1f77bcf86cd799439011");

    assert.equal(result.isDeleted, true);
    assert.ok(result.deletedAt instanceof Date);
    assert.equal(softDelete.mock.calls.length, 1);
  } finally {
    softDelete.mock.restore();
  }
});

test("public book mapping excludes internal normalized duplicate keys", () => {
  const publicBook = toPublicBook({
    ...bookInput,
    _id: "507f1f77bcf86cd799439011",
    normalizedTitle: "clean code",
    normalizedAuthor: "robert martin",
    isDeleted: false,
    deletedAt: null,
  });

  assert.equal(publicBook.id, "507f1f77bcf86cd799439011");
  assert.equal("normalizedTitle" in publicBook, false);
  assert.equal("normalizedAuthor" in publicBook, false);
});
