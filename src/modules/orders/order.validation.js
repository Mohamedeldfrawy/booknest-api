import mongoose from "mongoose";
import Joi from "joi";

const orderIdSchema = Joi.object({
  id: Joi.string()
    .custom((value, helpers) => {
      if (!mongoose.isValidObjectId(value)) {
        return helpers.error("any.invalid");
      }

      return value;
    })
    .messages({
      "any.invalid": "Invalid order ID",
    })
    .required(),
});

export { orderIdSchema };