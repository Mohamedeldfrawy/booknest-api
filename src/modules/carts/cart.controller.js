import {
  addCartItem,
  getCart,
  removeCartItem,
  updateCartItem,
} from "./cart.service.js";

const getCartController = async (req, res) => {
  const cart = await getCart(req.user.userId);

  return res.status(200).json({
    status: "success",
    data: cart,
  });
};

const addCartItemController = async (req, res) => {
  const cart = await addCartItem(
    req.user.userId,
    req.body.bookId,
    req.body.quantity,
  );

  return res.status(200).json({
    status: "success",
    data: cart,
  });
};

const updateCartItemController = async (req, res) => {
  const cart = await updateCartItem(
    req.user.userId,
    req.params.bookId,
    req.body.quantity,
  );

  return res.status(200).json({
    status: "success",
    data: cart,
  });
};

const removeCartItemController = async (req, res) => {
  const cart = await removeCartItem(req.user.userId, req.params.bookId);

  return res.status(200).json({
    status: "success",
    data: cart,
  });
};

export {
  addCartItemController,
  getCartController,
  removeCartItemController,
  updateCartItemController,
};