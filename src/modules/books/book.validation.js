import mongoose from "mongoose";
import Joi from "joi";
import BOOK_CATEGORIES from "./book.constants.js";

const nameField = Joi.string().trim().min(1).required();
const optionalNameField = Joi.string().trim().min(1);
const categoryField = Joi.string().trim().lowercase().valid(...BOOK_CATEGORIES);
const priceField = Joi.number().greater(0);
const stockField = Joi.number().integer().min(0);

const createBookSchema = Joi.object({
  title: nameField,
  author: nameField,
  description: nameField,
  price: priceField.required(),
  category: categoryField.required(),
  stock: stockField.required(),
}).unknown(false);

const updateBookSchema = Joi.object({
  title: optionalNameField,
  author: optionalNameField,
  description: optionalNameField,
  price: priceField,
  category: categoryField,
  stock: stockField,
})
  .min(1)
  .unknown(false);

const bookIdSchema = Joi.object({
  id: Joi.string()
    .custom((value, helpers) => {
      if (!mongoose.isValidObjectId(value)) {
        return helpers.error("any.invalid");
      }

      return value;
    })
    .messages({
      "any.invalid": "Invalid book ID",
    })
    .required(),
});

const browseBooksQuerySchema = Joi.object({
  search: Joi.string().trim().min(1),
  category: categoryField,
  minPrice: Joi.number().min(0),
  maxPrice: Joi.number().min(0),
  sort: Joi.string().valid(
    "price_asc",
    "price_desc",
    "newest",
    "oldest",
  ),
  page: Joi.number().integer().positive().default(1),
  limit: Joi.number().integer().positive().max(50).default(10),
}).unknown(false);

export {
  bookIdSchema,
  browseBooksQuerySchema,
  createBookSchema,
  updateBookSchema,
};