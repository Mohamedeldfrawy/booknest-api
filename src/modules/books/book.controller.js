import { toPublicBook } from "./book.mapper.js";
import { createBook, deleteBook, updateBook } from "./book.service.js";

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
  updateBookController,
};