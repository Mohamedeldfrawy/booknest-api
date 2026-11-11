import Cart from "./cart.model.js";

const findByUserId = (userId) => Cart.findOne({ userId });

const createCart = (userId, bookId, quantity) =>
  Cart.create({
    userId,
    items: [{ bookId, quantity }],
  });

const incrementItemIfWithinStock = (userId, bookId, quantity, stock) =>
  Cart.updateOne(
    {
      userId,
      items: {
        $elemMatch: {
          bookId,
          quantity: { $lte: stock - quantity },
        },
      },
    },
    { $inc: { "items.$.quantity": quantity } },
  );

const addItemIfAbsent = (userId, bookId, quantity) =>
  Cart.updateOne(
    { userId, "items.bookId": { $ne: bookId } },
    { $push: { items: { bookId, quantity } } },
  );

const setItemQuantityIfPresent = (userId, bookId, quantity) =>
  Cart.updateOne(
    {
      userId,
      "items.bookId": bookId,
    },
    { $set: { "items.$.quantity": quantity } },
  );

const removeItem = (userId, bookId) =>
  Cart.findOneAndUpdate(
    { userId, "items.bookId": bookId },
    { $pull: { items: { bookId } } },
    { new: true },
  );

const deleteIfEmpty = (userId) =>
  Cart.deleteOne({ userId, items: { $size: 0 } });

export {
  createCart,
  addItemIfAbsent,
  deleteIfEmpty,
  findByUserId,
  incrementItemIfWithinStock,
  removeItem,
  setItemQuantityIfPresent,
};