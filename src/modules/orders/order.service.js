import AppError from "../../errors/AppError.js";
import ERROR_CODES from "../../errors/error-codes.js";
import withTransaction from "../../database/transaction.js";
import {
  clearCartForCheckout,
  getCartForCheckout,
} from "../carts/cart.service.js";
import {
  decrementStockForCheckout,
  getActiveBooksForCheckout,
  restoreStockForOrder,
} from "../books/book.service.js";
import {
  create as createOrder,
  findAll,
  findById,
  findByIdForUser,
  findByUserId,
  markCancelledForStockRestoration,
  markPaidIfPending,
} from "./order.repository.js";

const checkoutError = (message, code) => new AppError(message, 409, code);
const orderNotFoundError = () =>
  new AppError("Order not found", 404, ERROR_CODES.ORDER_NOT_FOUND);

const checkout = (userId) =>
  withTransaction(async (session) => {
    const cart = await getCartForCheckout(userId, session);

    if (!cart || cart.items.length === 0) {
      throw checkoutError(
        "Cannot checkout with an empty cart",
        ERROR_CODES.ORDER_CART_EMPTY,
      );
    }

    const bookIds = cart.items.map((item) => item.bookId);
    const books = await getActiveBooksForCheckout(bookIds, session);
    const booksById = new Map(
      books.map((book) => [book._id.toString(), book]),
    );

    const items = cart.items.map((cartItem) => {
      const book = booksById.get(cartItem.bookId.toString());

      if (!book) {
        throw checkoutError(
          "One or more books are no longer available",
          ERROR_CODES.ORDER_BOOK_UNAVAILABLE,
        );
      }

      if (book.stock < cartItem.quantity) {
        throw checkoutError(
          "One or more books do not have sufficient stock",
          ERROR_CODES.ORDER_STOCK_UNAVAILABLE,
        );
      }

      const subtotal = book.price * cartItem.quantity;

      return {
        bookId: book._id,
        title: book.title,
        author: book.author,
        price: book.price,
        quantity: cartItem.quantity,
        subtotal,
      };
    });

    for (const item of items) {
      const updatedBook = await decrementStockForCheckout(
        item.bookId,
        item.quantity,
        session,
      );

      if (!updatedBook) {
        throw checkoutError(
          "One or more books do not have sufficient stock",
          ERROR_CODES.ORDER_STOCK_UNAVAILABLE,
        );
      }
    }

    const totalPrice = items.reduce((total, item) => total + item.subtotal, 0);
    const order = await createOrder(
      {
        userId,
        items,
        totalPrice,
        status: "pending",
      },
      session,
    );
    const clearedCart = await clearCartForCheckout(userId, session);

    if (clearedCart.deletedCount !== 1) {
      throw checkoutError(
        "Checkout could not be completed",
        ERROR_CODES.ORDER_CHECKOUT_CONFLICT,
      );
    }

    return order;
  });

const listOrders = (userId, role) =>
  role === "admin" ? findAll() : findByUserId(userId);

const getOrder = async (id, userId, role) => {
  const order = role === "admin"
    ? await findById(id)
    : await findByIdForUser(id, userId);

  if (!order) {
    throw orderNotFoundError();
  }

  return order;
};

const cancelOrder = (id) =>
  withTransaction(async (session) => {
    const order = await findById(id, session);

    if (!order) {
      throw orderNotFoundError();
    }

    if (order.status === "cancelled") {
      return order;
    }

    const cancelledOrder = await markCancelledForStockRestoration(id, session);

    if (!cancelledOrder) {
      throw new AppError(
        "Order cancellation could not be completed",
        409,
        ERROR_CODES.ORDER_CANCELLATION_CONFLICT,
      );
    }

    for (const item of cancelledOrder.items) {
      const restored = await restoreStockForOrder(
        item.bookId,
        item.quantity,
        session,
      );

      if (restored.modifiedCount !== 1) {
        throw new AppError(
          "Order cancellation could not be completed",
          409,
          ERROR_CODES.ORDER_CANCELLATION_CONFLICT,
        );
      }
    }

    return cancelledOrder;
  });

const markOrderPaid = async (id, userId) => {
  await getOrderForPayment(id, userId);

  const paidOrder = await markPaidIfPending(id, userId);

  if (!paidOrder) {
    throw new AppError(
      "Order is no longer eligible for payment",
      409,
      ERROR_CODES.ORDER_PAYMENT_CONFLICT,
    );
  }

  return paidOrder;
};

const getOrderForPayment = async (id, userId) => {
  const order = await findByIdForUser(id, userId);

  if (!order) {
    throw orderNotFoundError();
  }

  if (order.status !== "pending") {
    throw new AppError(
      "Order is not eligible for payment",
      409,
      ERROR_CODES.ORDER_PAYMENT_CONFLICT,
    );
  }

  return order;
};

export {
  cancelOrder,
  checkout,
  getOrder,
  getOrderForPayment,
  listOrders,
  markOrderPaid,
};