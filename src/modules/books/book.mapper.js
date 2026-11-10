const toPublicBook = (book) => ({
  id: book._id.toString(),
  title: book.title,
  author: book.author,
  description: book.description,
  price: book.price,
  category: book.category,
  stock: book.stock,
  isDeleted: book.isDeleted,
  deletedAt: book.deletedAt,
  createdAt: book.createdAt,
  updatedAt: book.updatedAt,
});

export { toPublicBook };
