import Book from "./book.model.js";

const findByNormalizedTitleAndAuthor = (normalizedTitle, normalizedAuthor) =>
  Book.findOne({ normalizedTitle, normalizedAuthor });

const findActiveById = (id) =>
  Book.findOne({ _id: id, isDeleted: false }).select(
    "+normalizedTitle +normalizedAuthor",
  );

const findByNormalizedTitleAndAuthorExcludingId = (
  normalizedTitle,
  normalizedAuthor,
  id,
) =>
  Book.findOne({
    normalizedTitle,
    normalizedAuthor,
    _id: { $ne: id },
  });

const create = (bookData) => Book.create(bookData);

const updateById = (id, bookData) =>
  Book.findOneAndUpdate(
    { _id: id, isDeleted: false },
    { $set: bookData },
    { new: true, runValidators: true },
  );

const softDeleteById = (id) =>
  Book.findOneAndUpdate(
    { _id: id, isDeleted: false },
    { $set: { isDeleted: true, deletedAt: new Date() } },
    { new: true },
  );

export {
  create,
  findActiveById,
  findByNormalizedTitleAndAuthor,
  findByNormalizedTitleAndAuthorExcludingId,
  softDeleteById,
  updateById,
};