import Book from "./book.model.js";

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildBrowseFilter = ({
  search,
  category,
  minPrice,
  maxPrice,
}) => {
  const filter = { isDeleted: false };

  if (search) {
    const searchRegex = new RegExp(escapeRegex(search), "i");
    filter.$or = [{ title: searchRegex }, { author: searchRegex }];
  }

  if (category) {
    filter.category = category;
  }

  if (minPrice !== undefined || maxPrice !== undefined) {
    filter.price = {};

    if (minPrice !== undefined) {
      filter.price.$gte = minPrice;
    }

    if (maxPrice !== undefined) {
      filter.price.$lte = maxPrice;
    }
  }

  return filter;
};

const getSort = (sort = "newest") => {
  const sortOptions = {
    price_asc: { price: 1, createdAt: -1 },
    price_desc: { price: -1, createdAt: -1 },
    newest: { createdAt: -1 },
    oldest: { createdAt: 1 },
  };

  return sortOptions[sort];
};

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

const findActiveByIdForBrowse = (id) =>
  Book.findOne({ _id: id, isDeleted: false });

const countBrowse = (query) => Book.countDocuments(buildBrowseFilter(query));

const findBrowsePage = ({ page, limit, ...query }) =>
  Book.find(buildBrowseFilter(query))
    .sort(getSort(query.sort))
    .skip((page - 1) * limit)
    .limit(limit);

export {
  countBrowse,
  create,
  findActiveById,
  findActiveByIdForBrowse,
  findByNormalizedTitleAndAuthor,
  findByNormalizedTitleAndAuthorExcludingId,
  findBrowsePage,
  softDeleteById,
  updateById,
};