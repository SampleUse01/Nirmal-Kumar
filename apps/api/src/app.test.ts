import assert from "node:assert/strict";
import { after, before, test } from "node:test";

process.env.NODE_ENV = "test";
process.env.PORT = "4000";
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/workforce-test";
process.env.WEB_ORIGIN = "http://localhost:5173,http://192.168.1.46:5173";
process.env.JWT_ACCESS_SECRET = "a".repeat(32);
process.env.JWT_REFRESH_SECRET = "b".repeat(32);

const { app } = await import("./app.js");
const server = app.listen(0);
const serverReady = new Promise<void>((resolve, reject) => {
  server.once("listening", resolve);
  server.once("error", reject);
});

before(() => serverReady);

after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

async function baseUrl() {
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("The test server did not start.");
  return `http://127.0.0.1:${address.port}`;
}

test("health endpoint reports API availability and database readiness", async () => {
  const response = await fetch(`${await baseUrl()}/api/health`);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    status: "degraded",
    database: "disconnected",
    message: "The API is running, but the database is unavailable. Check the API logs."
  });
});

test("state-changing requests require the configured browser origin", async () => {
  const url = `${await baseUrl()}/api/not-found`;
  const rejected = await fetch(url, { method: "POST" });
  assert.equal(rejected.status, 403);

  const accepted = await fetch(url, {
    method: "POST",
    headers: { Origin: "http://localhost:5173" }
  });
  assert.equal(accepted.status, 404);

  const lanOrigin = "http://192.168.1.46:5173";
  const acceptedLanRequest = await fetch(url, {
    method: "POST",
    headers: { Origin: lanOrigin }
  });
  assert.equal(acceptedLanRequest.status, 404);
  assert.equal(acceptedLanRequest.headers.get("access-control-allow-origin"), lanOrigin);
});
