import Joi from "joi";

const strongPassword = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

const registerSchema = Joi.object({
  name: Joi.string().trim().required(),
  email: Joi.string().trim().lowercase().email().required(),
  password: Joi.string()
    .pattern(strongPassword)
    .required()
    .messages({
      "string.pattern.base":
        "Password must be at least 8 characters and contain at least one letter and one number",
    }),
}).unknown(false);

const updateProfileSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required(),
}).unknown(false);

export { updateProfileSchema };
export default registerSchema;