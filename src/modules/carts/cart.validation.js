import mongoose from "mongoose";
import Joi from "joi";

const objectId = Joi.string()
  .custom((value, helpers) => {
    if (!mongoose.isValidObjectId(value)) {
      return helpers.error("any.invalid");
    }

    return value;
  })
  .messages({
    "any.invalid": "Invalid book ID",
  });

const quantity = Joi.number().integer().positive().required();

const addCartItemSchema = Joi.object({
  bookId: objectId.required(),
  quantity,
}).unknown(false);

const updateCartItemSchema = Joi.object({
  quantity,
}).unknown(false);

const cartItemParamsSchema = Joi.object({
  bookId: objectId.required(),
});

export {
  addCartItemSchema,
  cartItemParamsSchema,
  updateCartItemSchema,
};