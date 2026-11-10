import { toPublicBook } from "./book.mapper.js";
import { toPublicBrowseBook } from "./book.mapper.js";
import {
  browseBooks,
  createBook,
  deleteBook,
  getBook,
  updateBook,
} from "./book.service.js";

const listBooksController = async (req, res) => {
  const { books, pagination } = await browseBooks(res.locals.validatedQuery);

  return res.status(200).json({
    status: "success",
    data: books.map(toPublicBrowseBook),
    pagination,
  });
};

const getBookController = async (req, res) => {
  const book = await getBook(req.params.id);

  return res.status(200).json({
    status: "success",
    data: {
      book: toPublicBrowseBook(book),
    },
  });
};

const createBookController = async (req, res) => {
  const book = await createBook(req.body);

  return res.status(201).json({
    status: "success",
    data: {
      book: toPublicBook(book),
    },
  });
};

const updateBookController = async (req, res) => {
  const book = await updateBook(req.params.id, req.body);

  return res.status(200).json({
    status: "success",
    data: {
      book: toPublicBook(book),
    },
  });
};

const deleteBookController = async (req, res) => {
  await deleteBook(req.params.id);

  return res.status(200).json({
    status: "success",
    message: "Book deleted successfully",
  });
};

export {
  createBookController,
  deleteBookController,
  getBookController,
  listBooksController,
  updateBookController,
};