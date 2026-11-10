import User from "./user.model.js";

const findByEmail = (email) => User.findOne({ email });

const findByEmailWithPassword = (email) =>
  User.findOne({ email }).select("+password");

const findById = (id) => User.findById(id);

const updateNameById = (id, name) =>
  User.findByIdAndUpdate(
    id,
    { name },
    { new: true, runValidators: true },
  );

const create = (userData) => User.create(userData);

export {
  findByEmail,
  findByEmailWithPassword,
  findById,
  updateNameById,
  create,
};