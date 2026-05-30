import assert from "node:assert/strict";
import test from "node:test";
import { discoverLmStudio, LmStudioDiscoveryError } from "../src/lm-studio/discovery.ts";

test("discovers models from the first endpoint that returns chat models", async () => {
  const seenUrls: string[] = [];
  const discovery = await discoverLmStudio({
    baseUrl: "http://lm.local/v1",
    fetchJson: async (url) => {
      seenUrls.push(url);
      return { data: [{ id: "local-chat" }] };
    },
  });

  assert.deepEqual(seenUrls, ["http://lm.local/api/v1/models", "http://lm.local/api/v0/models", "http://lm.local/v1/models"]);
  assert.equal(discovery.openAiBaseUrl, "http://lm.local/v1");
  assert.equal(discovery.sourceUrl, "http://lm.local/v1/models");
  assert.equal(discovery.models[0]?.id, "local-chat");
});

test("throws a discovery error with every attempted endpoint", async () => {
  await assert.rejects(
    () =>
      discoverLmStudio({
        baseUrl: "http://lm.local",
        fetchJson: async () => ({ models: [] }),
      }),
    (error: unknown) => {
      assert.ok(error instanceof LmStudioDiscoveryError);
      assert.equal(error.attempts.length, 3);
      assert.match(error.message, /no chat models found/);
      return true;
    },
  );
});
