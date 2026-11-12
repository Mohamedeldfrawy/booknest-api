import AppError from "../../errors/AppError.js";
import ERROR_CODES from "../../errors/error-codes.js";
import {
  getActiveBookForCart,
  getBooksForCart,
} from "../books/book.service.js";
import {
  addItemIfAbsent,
  createCart,
  deleteByUserId,
  deleteIfEmpty,
  findByUserId,
  incrementItemIfWithinStock,
  removeItem,
  setItemQuantityIfPresent,
} from "./cart.repository.js";

const emptyCart = () => ({
  items: [],
  requestedTotal: 0,
  availableItemsTotal: 0,
});

const bookNotFoundError = () =>
  new AppError("Book not found", 404, ERROR_CODES.BOOK_NOT_FOUND);

const cartItemNotFoundError = () =>
  new AppError(
    "Cart item not found",
    404,
    ERROR_CODES.CART_ITEM_NOT_FOUND,
  );

const stockError = (message, code) => new AppError(message, 409, code);

const getCartItemQuantity = (cart, bookId) =>
  cart?.items.find((item) => item.bookId.toString() === bookId.toString())
    ?.quantity;

const mapCart = async (cart) => {
  if (!cart) {
    return emptyCart();
  }

  const books = await getBooksForCart(cart.items.map((item) => item.bookId));
  const booksById = new Map(
    books.map((book) => [book._id.toString(), book]),
  );
  let requestedTotal = 0;
  let availableItemsTotal = 0;

  const items = cart.items.map((item) => {
    const book = booksById.get(item.bookId.toString());
    const unavailable = !book || book.isDeleted;
    const currentPrice = book?.price ?? 0;
    const currentStock = book?.stock ?? 0;
    const availableQuantity = unavailable
      ? 0
      : Math.min(item.quantity, currentStock);
    const availability = unavailable
      ? "Unavailable"
      : currentStock === 0
        ? "Out of Stock"
        : currentStock < item.quantity
          ? "Insufficient Stock"
          : "In Stock";
    const requestedSubtotal = currentPrice * item.quantity;
    const availableSubtotal = currentPrice * availableQuantity;

    requestedTotal += requestedSubtotal;
    availableItemsTotal += availableSubtotal;

    return {
      book: book
        ? {
            id: book._id.toString(),
            title: book.title,
            author: book.author,
            description: book.description,
            price: book.price,
            category: book.category,
          }
        : null,
      quantity: item.quantity,
      currentPrice,
      currentStock,
      availableQuantity,
      availability,
      requestedSubtotal,
      availableSubtotal,
    };
  });

  return { items, requestedTotal, availableItemsTotal };
};

const getCart = async (userId) => mapCart(await findByUserId(userId));

const getCartForCheckout = (userId, session) =>
  findByUserId(userId, session);

const clearCartForCheckout = (userId, session) =>
  deleteByUserId(userId, session);

const addCartItem = async (userId, bookId, quantity) => {
  const book = await getActiveBookForCart(bookId);

  if (!book) {
    throw bookNotFoundError();
  }

  if (book.stock === 0) {
    throw stockError("Book is out of stock", ERROR_CODES.CART_OUT_OF_STOCK);
  }

  if (quantity > book.stock) {
    throw stockError(
      "Requested quantity exceeds available stock",
      ERROR_CODES.CART_QUANTITY_EXCEEDED,
    );
  }

  let cart = await findByUserId(userId);

  if (!cart) {
    try {
      cart = await createCart(userId, bookId, quantity);
    } catch (error) {
      if (error?.code !== 11000) {
        throw error;
      }

      cart = await findByUserId(userId);
    }

    if (cart?.items.length === 0) {
      await addItemIfAbsent(userId, bookId, quantity);
    }
  } else {
    const incremented = await incrementItemIfWithinStock(
      userId,
      bookId,
      quantity,
      book.stock,
    );

    if (incremented.matchedCount === 0) {
      const currentQuantity = getCartItemQuantity(cart, bookId);

      if (currentQuantity !== undefined) {
        throw stockError(
          "Requested quantity exceeds available stock",
          ERROR_CODES.CART_QUANTITY_EXCEEDED,
        );
      }

      await addItemIfAbsent(userId, bookId, quantity);
    }
  }

  return getCart(userId);
};

const updateCartItem = async (userId, bookId, quantity) => {
  const book = await getActiveBookForCart(bookId);

  if (!book) {
    throw bookNotFoundError();
  }

  if (book.stock === 0) {
    throw stockError("Book is out of stock", ERROR_CODES.CART_OUT_OF_STOCK);
  }

  if (quantity > book.stock) {
    throw stockError(
      "Requested quantity exceeds available stock",
      ERROR_CODES.CART_QUANTITY_EXCEEDED,
    );
  }

  const updated = await setItemQuantityIfPresent(userId, bookId, quantity);

  if (updated.matchedCount === 0) {
    throw cartItemNotFoundError();
  }

  return getCart(userId);
};

const removeCartItem = async (userId, bookId) => {
  const cart = await removeItem(userId, bookId);

  if (!cart) {
    throw cartItemNotFoundError();
  }

  if (cart.items.length === 0) {
    await deleteIfEmpty(userId);
    return emptyCart();
  }

  return mapCart(cart);
};

export {
  addCartItem,
  clearCartForCheckout,
  getCart,
  getCartForCheckout,
  removeCartItem,
  updateCartItem,
};