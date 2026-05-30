import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_BASE_URL, DEFAULT_TIMEOUT_MS, getHeaders, getTimeoutMs, normalizeBaseUrl } from "../src/config.ts";

test("normalizes configured LM Studio base URLs", () => {
  assert.equal(normalizeBaseUrl("http://127.0.0.1:1234/v1/"), "http://127.0.0.1:1234");
  assert.equal(normalizeBaseUrl("http://127.0.0.1:1234/api/v0"), "http://127.0.0.1:1234");
  assert.equal(normalizeBaseUrl("http://127.0.0.1:1234/api/v1"), "http://127.0.0.1:1234");
  assert.equal(normalizeBaseUrl("   "), DEFAULT_BASE_URL);
});

test("parses positive timeout values", () => {
  assert.equal(getTimeoutMs({ PI_LM_STUDIO_TIMEOUT_MS: "2000" }), 2000);
  assert.equal(getTimeoutMs({ PI_LM_STUDIO_TIMEOUT_MS: "0" }), DEFAULT_TIMEOUT_MS);
  assert.equal(getTimeoutMs({ PI_LM_STUDIO_TIMEOUT_MS: "nope" }), DEFAULT_TIMEOUT_MS);
});

test("adds an authorization header when LM_API_TOKEN is set", () => {
  assert.deepEqual(getHeaders({ LM_API_TOKEN: "secret" }), {
    Accept: "application/json",
    Authorization: "Bearer secret",
  });
});
