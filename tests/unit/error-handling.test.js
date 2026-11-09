import assert from "node:assert/strict";
import test from "node:test";
import AppError from "../../src/errors/AppError.js";
import ERROR_CODES from "../../src/errors/error-codes.js";
import errorHandler from "../../src/middleware/error-handler.js";
import notFound from "../../src/middleware/not-found.js";

const createResponse = () => ({
  statusCode: 200,
  body: undefined,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

test("AppError stores the public error details", () => {
  const error = new AppError(
    "Resource not found",
    404,
    ERROR_CODES.RESOURCE_NOT_FOUND,
  );

  assert.equal(error.message, "Resource not found");
  assert.equal(error.statusCode, 404);
  assert.equal(error.code, ERROR_CODES.RESOURCE_NOT_FOUND);
  assert.equal(error.isOperational, true);
});

test("error handler returns standardized expected errors", () => {
  const response = createResponse();

  errorHandler(
    new AppError("Resource not found", 404, ERROR_CODES.RESOURCE_NOT_FOUND),
    { method: "GET", originalUrl: "/api/missing" },
    response,
    () => {},
  );

  assert.equal(response.statusCode, 404);
  assert.deepEqual(response.body, {
    status: "error",
    code: "RESOURCE_NOT_FOUND",
    message: "Resource not found",
  });
});

test("error handler hides unexpected error details", () => {
  const response = createResponse();
  const originalConsoleError = console.error;
  console.error = () => {};

  try {
    errorHandler(
      new Error("database credentials or stack details"),
      { method: "GET", originalUrl: "/api/test" },
      response,
      () => {},
    );
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(response.statusCode, 500);
  assert.deepEqual(response.body, {
    status: "error",
    code: "INTERNAL_SERVER_ERROR",
    message: "Internal server error",
  });
});

test("not-found middleware forwards a standardized 404 error", () => {
  let receivedError;

  notFound({}, {}, (error) => {
    receivedError = error;
  });

  assert.equal(receivedError.statusCode, 404);
  assert.equal(receivedError.code, ERROR_CODES.RESOURCE_NOT_FOUND);
});
