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

const toPublicBrowseBook = (book) => ({
  id: book._id.toString(),
  title: book.title,
  author: book.author,
  description: book.description,
  price: book.price,
  category: book.category,
  stock: book.stock,
  availability: book.stock > 0 ? "In Stock" : "Out of Stock",
  createdAt: book.createdAt,
});

export { toPublicBook, toPublicBrowseBook };
