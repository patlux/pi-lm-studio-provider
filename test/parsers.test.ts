import assert from "node:assert/strict";
import test from "node:test";
import { dedupeModels, parseOpenAIModels, parseRestV0Models, parseRestV1Models } from "../src/lm-studio/parsers.ts";

test("parses LM Studio REST v1 chat models", () => {
  const models = parseRestV1Models({
    models: [
      {
        key: "qwen3",
        display_name: "Qwen 3",
        type: "llm",
        publisher: "Alibaba",
        architecture: "qwen3",
        quantization: { name: "Q4_K_M" },
        params_string: "32B",
        format: "gguf",
        loaded_instances: [{ config: { context_length: 65536 } }],
        max_context_length: 131072,
        capabilities: {
          vision: false,
          trained_for_tool_use: true,
          reasoning: { allowed_options: ["off", "low", "high"] },
        },
      },
      { key: "embedding", type: "embedding" },
    ],
  });

  assert.equal(models.length, 1);
  assert.deepEqual(models[0], {
    id: "qwen3",
    displayName: "Qwen 3",
    publisher: "Alibaba",
    architecture: "qwen3",
    quantization: "Q4_K_M",
    params: "32B",
    format: "gguf",
    loaded: true,
    contextWindow: 65536,
    maxContextLength: 131072,
    vision: false,
    toolUse: true,
    reasoningAllowed: ["off", "low", "high"],
    source: "rest-v1",
  });
});

test("parses LM Studio REST v0 models", () => {
  const models = parseRestV0Models({
    data: [
      {
        id: "vision-model",
        type: "vlm",
        state: "loaded",
        capabilities: ["vision", "tool_use"],
        loaded_context_length: 4096,
      },
    ],
  });

  assert.equal(models[0]?.vision, true);
  assert.equal(models[0]?.toolUse, true);
  assert.equal(models[0]?.loaded, true);
  assert.equal(models[0]?.contextWindow, 4096);
});

test("parses OpenAI-compatible model lists and skips embeddings", () => {
  const models = parseOpenAIModels({ data: [{ id: "chat-a", owned_by: "local" }, { id: "text-embed" }] });

  assert.equal(models.length, 1);
  assert.equal(models[0]?.id, "chat-a");
  assert.equal(models[0]?.toolUse, true);
});

test("deduplicates models by id while keeping first-seen order", () => {
  const models = parseOpenAIModels({ data: [{ id: "a" }, { id: "a" }, { id: "b" }] });

  assert.deepEqual(
    dedupeModels(models).map((model) => model.id),
    ["a", "b"],
  );
});
