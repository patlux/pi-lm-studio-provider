import assert from "node:assert/strict";
import test from "node:test";
import { createProviderConfig, maxTokensFor, modelDisplayName, thinkingLevelMap, toProviderModel } from "../src/pi/provider.ts";
import type { LmStudioModelSummary } from "../src/lm-studio/types.ts";

const baseModel: LmStudioModelSummary = {
  id: "qwen3",
  displayName: "Qwen 3",
  loaded: true,
  contextWindow: 32768,
  vision: true,
  toolUse: true,
  quantization: "Q4_K_M",
  reasoningAllowed: ["off", "low", "high"],
  source: "rest-v1",
};

test("caps max output tokens at half the context window", () => {
  assert.equal(maxTokensFor(1024), 1024);
  assert.equal(maxTokensFor(8192), 4096);
  assert.equal(maxTokensFor(128000), 16384);
});

test("formats model display names with capability tags", () => {
  assert.equal(modelDisplayName(baseModel), "Qwen 3 (Q4_K_M, loaded, vision, tools, reasoning off/low/high)");
});

test("maps reasoning options onto Pi thinking levels", () => {
  assert.deepEqual(thinkingLevelMap(["low", "high"]), {
    off: null,
    medium: null,
    minimal: "low",
    xhigh: "high",
  });
});

test("converts LM Studio summaries into Pi provider models", () => {
  const providerModel = toProviderModel(baseModel);

  assert.equal(providerModel.id, "qwen3");
  assert.deepEqual(providerModel.input, ["text", "image"]);
  assert.equal(providerModel.reasoning, true);
  assert.equal(providerModel.contextWindow, 32768);
  assert.equal(providerModel.maxTokens, 16384);
});

test("creates a provider config", () => {
  const provider = createProviderConfig({
    rootBaseUrl: "http://lm.local",
    openAiBaseUrl: "http://lm.local/v1",
    sourceUrl: "http://lm.local/api/v1/models",
    models: [baseModel],
  });

  assert.equal(provider.name, "LM Studio (local)");
  assert.equal(provider.baseUrl, "http://lm.local/v1");
  assert.equal(provider.models?.length, 1);
});
