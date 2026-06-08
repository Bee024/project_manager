import assert from "node:assert/strict";
import test from "node:test";
import app from "../src/app.js";

test("express app imports successfully", () => {
  assert.equal(typeof app, "function");
});

test("cors allows production frontend preflight with credentials", async (t) => {
  const originalCorsOrigin = process.env.CORS_ORIGIN;
  process.env.CORS_ORIGIN = "http://localhost:3000";

  const server = app.listen(0);
  await new Promise((resolve) => {
    server.once("listening", resolve);
  });

  t.after(async () => {
    if (originalCorsOrigin === undefined) {
      delete process.env.CORS_ORIGIN;
    } else {
      process.env.CORS_ORIGIN = originalCorsOrigin;
    }

    await new Promise((resolve) => {
      server.close(resolve);
    });
  });

  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/api/v1/auth/login`, {
    method: "OPTIONS",
    headers: {
      Origin: "https://manager-alpha-taupe.vercel.app",
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "Content-Type",
    },
  });

  assert.equal(response.status, 204);
  assert.equal(
    response.headers.get("access-control-allow-origin"),
    "https://manager-alpha-taupe.vercel.app",
  );
  assert.equal(
    response.headers.get("access-control-allow-credentials"),
    "true",
  );
});
