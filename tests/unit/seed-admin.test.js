import assert from "node:assert/strict";
import { mock, test } from "node:test";
import bcrypt from "bcrypt";
import User from "../../src/modules/users/user.model.js";
import { seedAdmin } from "../../src/database/seed-admin.js";

const config = {
  name: "BookNest Admin",
  email: "admin@example.com",
  password: "admin1234",
};

test("seed creates an admin with a bcrypt password hash", async () => {
  const findOne = mock.method(User, "findOne", async () => null);
  const create = mock.method(User, "create", async (userData) => userData);

  try {
    const result = await seedAdmin(config);

    assert.equal(result.created, true);
    assert.equal(result.user.role, "admin");
    assert.notEqual(result.user.password, config.password);
    assert.equal(await bcrypt.compare(config.password, result.user.password), true);
  } finally {
    findOne.mock.restore();
    create.mock.restore();
  }
});

test("seed does not recreate an existing admin", async () => {
  const existingAdmin = {
    email: config.email,
    role: "admin",
  };
  const findOne = mock.method(User, "findOne", async () => existingAdmin);
  const create = mock.method(User, "create");

  try {
    const result = await seedAdmin(config);

    assert.equal(result.created, false);
    assert.equal(result.user, existingAdmin);
    assert.equal(create.mock.calls.length, 0);
  } finally {
    findOne.mock.restore();
    create.mock.restore();
  }
});

test("seed refuses to promote an existing customer", async () => {
  const findOne = mock.method(User, "findOne", async () => ({
    email: config.email,
    role: "customer",
  }));
  const create = mock.method(User, "create");

  try {
    await assert.rejects(
      seedAdmin(config),
      /already belongs to a customer; no user was promoted/,
    );
    assert.equal(create.mock.calls.length, 0);
  } finally {
    findOne.mock.restore();
    create.mock.restore();
  }
});
