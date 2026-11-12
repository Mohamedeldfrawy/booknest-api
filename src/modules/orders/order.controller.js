import { toPublicOrder } from "./order.mapper.js";
import { checkout, getOrder, listOrders } from "./order.service.js";

const createOrderController = async (req, res) => {
  const order = await checkout(req.user.userId);

  return res.status(201).json({
    status: "success",
    data: {
      order: toPublicOrder(order),
    },
  });
};

const listOrdersController = async (req, res) => {
  const orders = await listOrders(req.user.userId, req.user.role);

  return res.status(200).json({
    status: "success",
    data: {
      orders: orders.map(toPublicOrder),
    },
  });
};

const getOrderController = async (req, res) => {
  const order = await getOrder(
    req.params.id,
    req.user.userId,
    req.user.role,
  );

  return res.status(200).json({
    status: "success",
    data: {
      order: toPublicOrder(order),
    },
  });
};

export {
  createOrderController,
  getOrderController,
  listOrdersController,
};