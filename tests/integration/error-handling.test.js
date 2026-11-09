import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import app from "../../src/app.js";

test("undefined routes return JSON errors and do not stop the server", async () => {
  const server = http.createServer(app);

  await new Promise((resolve) => server.listen(0, resolve));

  try {
    const port = server.address().port;
    const firstResponse = await fetch(
      `http://127.0.0.1:${port}/api/does-not-exist`,
    );
    const secondResponse = await fetch(`http://127.0.0.1:${port}/`);

    assert.equal(firstResponse.status, 404);
    assert.deepEqual(await firstResponse.json(), {
      status: "error",
      code: "RESOURCE_NOT_FOUND",
      message: "Resource not found",
    });
    assert.equal(secondResponse.status, 200);
    assert.equal(await secondResponse.text(), "BookNest API is running");
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
