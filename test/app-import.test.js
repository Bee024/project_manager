import assert from "node:assert/strict";
import test from "node:test";
import app from "../src/app.js";

test("express app imports successfully", () => {
  assert.equal(typeof app, "function");
});
