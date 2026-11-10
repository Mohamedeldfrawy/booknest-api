import assert from "node:assert/strict";
import { mock, test } from "node:test";
import User from "../../src/modules/users/user.model.js";
import authorize from "../../src/middleware/authorize.js";
import { getProfile, updateProfile } from "../../src/modules/users/user.service.js";
import { updateProfileSchema } from "../../src/modules/users/user.validation.js";

const createNext = () => {
  const next = (error) => {
    next.error = error;
  };

  return next;
};

test("profile validation accepts only a trimmed name", () => {
  const valid = updateProfileSchema.validate({ name: "  Mohamed  " });
  const invalid = updateProfileSchema.validate({
    name: " ",
    email: "changed@example.com",
  });

  assert.equal(valid.error, undefined);
  assert.equal(valid.value.name, "Mohamed");
  assert.ok(invalid.error);
  assert.match(invalid.error.message, /name|email/i);
});

test("profile validation rejects protected fields", () => {
  const result = updateProfileSchema.validate({
    name: "Mohamed",
    email: "changed@example.com",
    password: "changed123",
    role: "admin",
    _id: "other-user",
  });

  assert.ok(result.error);
  assert.match(result.error.message, /not allowed/);
});

test("profile service reads and updates the authenticated user ID", async () => {
  const user = {
    _id: "507f1f77bcf86cd799439011",
    name: "Mohamed",
    email: "mohamed@example.com",
    role: "customer",
  };
  const findById = mock.method(User, "findById", async (id) => {
    assert.equal(id, user._id);
    return user;
  });
  const findByIdAndUpdate = mock.method(User, "findByIdAndUpdate", async (id, changes, options) => {
    assert.equal(id, user._id);
    assert.deepEqual(changes, { name: "Updated" });
    assert.deepEqual(options, { new: true, runValidators: true });
    return { ...user, name: changes.name };
  });

  try {
    assert.equal(await getProfile(user._id), user);
    assert.equal((await updateProfile(user._id, { name: "Updated" })).name, "Updated");
  } finally {
    findById.mock.restore();
    findByIdAndUpdate.mock.restore();
  }
});

test("authorize allows admins and rejects customers", () => {
  const adminNext = createNext();
  authorize("admin")({ user: { role: "admin" } }, {}, adminNext);
  assert.equal(adminNext.error, undefined);

  const customerNext = createNext();
  authorize("admin")({ user: { role: "customer" } }, {}, customerNext);
  assert.equal(customerNext.error.statusCode, 403);
  assert.equal(customerNext.error.code, "FORBIDDEN");
});
