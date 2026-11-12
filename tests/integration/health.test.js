import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import app from "../../src/app.js";

test("health endpoint returns an OK response", async () => {
  const server = http.createServer(app);

  await new Promise((resolve) => server.listen(0, resolve));

  try {
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/health`,
    );

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "ok" });
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
