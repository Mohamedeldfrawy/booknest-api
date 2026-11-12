import Cart from "./cart.model.js";

const findByUserId = (userId, session) => {
  const query = Cart.findOne({ userId });

  return session ? query.session(session) : query;
};

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

const deleteByUserId = (userId, session) => {
  const query = Cart.deleteOne({ userId });

  return session ? query.session(session) : query;
};

export {
  createCart,
  addItemIfAbsent,
  deleteByUserId,
  deleteIfEmpty,
  findByUserId,
  incrementItemIfWithinStock,
  removeItem,
  setItemQuantityIfPresent,
};