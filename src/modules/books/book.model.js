import mongoose from "mongoose";
import BOOK_CATEGORIES from "./book.constants.js";

const bookSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    author: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0.01,
    },
    category: {
      type: String,
      required: true,
      enum: BOOK_CATEGORIES,
      lowercase: true,
      trim: true,
    },
    stock: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: "Stock must be a non-negative integer",
      },
    },
    normalizedTitle: {
      type: String,
      required: true,
      select: false,
    },
    normalizedAuthor: {
      type: String,
      required: true,
      select: false,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      required: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

bookSchema.index(
  { normalizedTitle: 1, normalizedAuthor: 1 },
  { unique: true },
);

const Book = mongoose.model("Book", bookSchema);

export default Book;