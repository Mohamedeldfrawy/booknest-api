const toPublicOrder = (order) => ({
  id: order._id.toString(),
  items: order.items.map((item) => ({
    bookId: item.bookId.toString(),
    title: item.title,
    author: item.author,
    price: item.price,
    quantity: item.quantity,
    subtotal: item.subtotal,
  })),
  totalPrice: order.totalPrice,
  status: order.status,
  createdAt: order.createdAt,
  updatedAt: order.updatedAt,
});

export { toPublicOrder };
