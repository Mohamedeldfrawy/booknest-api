import Order from "./order.model.js";

const create = (orderData, session) => {
  const order = new Order(orderData);

  return order.save({ session });
};

const findByUserId = (userId) =>
  Order.find({ userId }).sort({ createdAt: -1 });

const findAll = () => Order.find().sort({ createdAt: -1 });

const findByIdForUser = (id, userId) =>
  Order.findOne({ _id: id, userId });

const findById = (id, session) => {
  const query = Order.findById(id);

  return session ? query.session(session) : query;
};

const markCancelledForStockRestoration = (id, session) =>
  Order.findOneAndUpdate(
    {
      _id: id,
      status: { $ne: "cancelled" },
      stockRestoredAt: null,
    },
    {
      $set: {
        status: "cancelled",
        stockRestoredAt: new Date(),
      },
    },
    { new: true, session },
  );

const markPaidIfPending = (id, userId) =>
  Order.findOneAndUpdate(
    {
      _id: id,
      userId,
      status: "pending",
    },
    {
      $set: {
        status: "paid",
      },
    },
    { new: true },
  );

export {
  create,
  findAll,
  findById,
  findByIdForUser,
  findByUserId,
  markPaidIfPending,
  markCancelledForStockRestoration,
};