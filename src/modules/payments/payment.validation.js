import Joi from "joi";
import { orderIdSchema } from "../orders/order.validation.js";

const paymentSchema = Joi.object({
  orderId: orderIdSchema.extract("id"),
  cardNumber: Joi.string()
    .pattern(/^\d{16}$/)
    .required()
    .messages({
      "string.pattern.base": "Card number must contain exactly 16 digits",
    }),
}).unknown(false);

export { paymentSchema };