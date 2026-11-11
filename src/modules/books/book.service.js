import AppError from "../../errors/AppError.js";
import ERROR_CODES from "../../errors/error-codes.js";
import {
  create,
  countBrowse,
  findActiveById,
  findActiveByIdForBrowse,
  findByIdsForCart,
  findByNormalizedTitleAndAuthor,
  findByNormalizedTitleAndAuthorExcludingId,
  findBrowsePage,
  softDeleteById,
  updateById,
} from "./book.repository.js";

const normalizeDuplicateValue = (value) => value.trim().toLowerCase();

const duplicateBookError = () =>
  new AppError(
    "A book with this title and author already exists",
    409,
    ERROR_CODES.BOOK_ALREADY_EXISTS,
  );

const bookNotFoundError = () =>
  new AppError("Book not found", 404, ERROR_CODES.BOOK_NOT_FOUND);

const getDuplicateKeys = ({ title, author }) => ({
  normalizedTitle: normalizeDuplicateValue(title),
  normalizedAuthor: normalizeDuplicateValue(author),
});

const isDuplicateKeyError = (error) =>
  error?.code === 11000 &&
  error?.keyPattern?.normalizedTitle &&
  error?.keyPattern?.normalizedAuthor;

const createBook = async (bookData) => {
  const duplicateKeys = getDuplicateKeys(bookData);
  const existingBook = await findByNormalizedTitleAndAuthor(
    duplicateKeys.normalizedTitle,
    duplicateKeys.normalizedAuthor,
  );

  if (existingBook) {
    throw duplicateBookError();
  }

  try {
    return await create({ ...bookData, ...duplicateKeys });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw duplicateBookError();
    }

    throw error;
  }
};

const updateBook = async (id, bookData) => {
  const currentBook = await findActiveById(id);

  if (!currentBook) {
    throw bookNotFoundError();
  }

  const nextBookData = { ...bookData };
  const duplicateKeys = getDuplicateKeys({
    title: bookData.title ?? currentBook.title,
    author: bookData.author ?? currentBook.author,
  });

  const conflictingBook = await findByNormalizedTitleAndAuthorExcludingId(
    duplicateKeys.normalizedTitle,
    duplicateKeys.normalizedAuthor,
    id,
  );

  if (conflictingBook) {
    throw duplicateBookError();
  }

  try {
    return await updateById(id, { ...nextBookData, ...duplicateKeys });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw duplicateBookError();
    }

    throw error;
  }
};

const deleteBook = async (id) => {
  const deletedBook = await softDeleteById(id);

  if (!deletedBook) {
    throw bookNotFoundError();
  }

  return deletedBook;
};

const browseBooks = async (query) => {
  if (
    query.minPrice !== undefined &&
    query.maxPrice !== undefined &&
    query.minPrice > query.maxPrice
  ) {
    throw new AppError(
      "Minimum price cannot be greater than maximum price",
      400,
      ERROR_CODES.VALIDATION_ERROR,
    );
  }

  const [books, total] = await Promise.all([
    findBrowsePage(query),
    countBrowse(query),
  ]);
  const totalPages = total === 0 ? 0 : Math.ceil(total / query.limit);

  return {
    books,
    pagination: {
      total,
      page: query.page,
      limit: query.limit,
      totalPages,
    },
  };
};

const getBook = async (id) => {
  const book = await findActiveByIdForBrowse(id);

  if (!book) {
    throw bookNotFoundError();
  }

  return book;
};

const getActiveBookForCart = (id) => findActiveByIdForBrowse(id);

const getBooksForCart = (ids) => findByIdsForCart(ids);

export {
  browseBooks,
  createBook,
  deleteBook,
  getActiveBookForCart,
  getBooksForCart,
  getBook,
  updateBook,
};