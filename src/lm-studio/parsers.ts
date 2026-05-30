import { getArray, getBoolean, getNumber, getString, isRecord, type JsonRecord } from "./json.ts";
import type { DiscoverySource, LmStudioModelSummary } from "./types.ts";

export const DEFAULT_CONTEXT_WINDOW = 128_000;

export function parseRestV1Models(payload: unknown): LmStudioModelSummary[] {
  return parseModels(payload, parseRestV1Model, "models");
}

export function parseRestV0Models(payload: unknown): LmStudioModelSummary[] {
  return parseModels(payload, parseRestV0Model, "data");
}

export function parseOpenAIModels(payload: unknown): LmStudioModelSummary[] {
  return parseModels(payload, parseOpenAIModel, "data");
}

export function dedupeModels(models: LmStudioModelSummary[]): LmStudioModelSummary[] {
  const seen = new Set<string>();
  const result: LmStudioModelSummary[] = [];

  for (const model of models) {
    if (seen.has(model.id)) continue;

    seen.add(model.id);
    result.push(model);
  }

  return result;
}

function parseModels(
  payload: unknown,
  parser: (model: unknown) => LmStudioModelSummary | undefined,
  collectionKey: string,
): LmStudioModelSummary[] {
  if (!isRecord(payload)) return [];

  return getArray(payload, collectionKey).flatMap((item) => {
    const parsed = parser(item);
    return parsed ? [parsed] : [];
  });
}

function parseRestV1Model(model: unknown): LmStudioModelSummary | undefined {
  if (!isRecord(model)) return undefined;

  const type = getString(model, "type");
  const id = getString(model, "key");
  if (!id || !isChatModelType(type)) return undefined;

  const loadedInstances = getArray(model, "loaded_instances");
  const quantization = model.quantization;
  const capabilities = model.capabilities;
  const quantizationName = isRecord(quantization) ? getString(quantization, "name") : undefined;
  const vision = isRecord(capabilities) ? getBoolean(capabilities, "vision") === true : false;
  const toolUse = isRecord(capabilities) ? getBoolean(capabilities, "trained_for_tool_use") === true : false;

  return createModelSummary({
    id,
    displayName: getString(model, "display_name") || id,
    publisher: getString(model, "publisher"),
    architecture: getString(model, "architecture"),
    quantization: quantizationName,
    params: getString(model, "params_string"),
    format: getString(model, "format"),
    loaded: loadedInstances.length > 0,
    contextWindow: selectedContextLength(model, loadedInstances),
    maxContextLength: getNumber(model, "max_context_length"),
    vision,
    toolUse,
    reasoningAllowed: parseReasoning(capabilities),
    source: "rest-v1",
  });
}

function parseRestV0Model(model: unknown): LmStudioModelSummary | undefined {
  if (!isRecord(model)) return undefined;

  const type = getString(model, "type");
  const id = getString(model, "id");
  if (!id || !isChatModelType(type)) return undefined;

  const capabilities = getArray(model, "capabilities").filter((value) => typeof value === "string");
  const loaded = getString(model, "state") === "loaded";

  return createModelSummary({
    id,
    displayName: id,
    publisher: getString(model, "publisher"),
    architecture: getString(model, "arch"),
    quantization: getString(model, "quantization"),
    loaded,
    contextWindow: getNumber(model, "loaded_context_length") || getNumber(model, "max_context_length") || DEFAULT_CONTEXT_WINDOW,
    maxContextLength: getNumber(model, "max_context_length"),
    vision: type === "vlm" || capabilities.includes("vision"),
    toolUse: capabilities.includes("tool_use"),
    reasoningAllowed: [],
    format: getString(model, "compatibility_type"),
    source: "rest-v0",
  });
}

function parseOpenAIModel(model: unknown): LmStudioModelSummary | undefined {
  if (!isRecord(model)) return undefined;

  const id = getString(model, "id");
  if (!id || id.toLowerCase().includes("embed")) return undefined;

  return createModelSummary({
    id,
    displayName: id,
    publisher: getString(model, "owned_by"),
    loaded: false,
    contextWindow: DEFAULT_CONTEXT_WINDOW,
    vision: false,
    toolUse: true,
    reasoningAllowed: [],
    source: "openai-v1",
  });
}

function createModelSummary(input: LmStudioModelSummary): LmStudioModelSummary {
  return input;
}

function isChatModelType(type: string | undefined): type is "llm" | "vlm" {
  return type === "llm" || type === "vlm";
}

function selectedContextLength(model: JsonRecord, loadedInstances: unknown[]): number {
  const loadedContextLengths = loadedInstances
    .filter(isRecord)
    .map((instance) => {
      const config = instance.config;
      return isRecord(config) ? getNumber(config, "context_length") : undefined;
    })
    .filter((value) => value !== undefined);

  if (loadedContextLengths.length > 0) {
    return Math.max(...loadedContextLengths);
  }

  return getNumber(model, "loaded_context_length") || getNumber(model, "max_context_length") || DEFAULT_CONTEXT_WINDOW;
}

function parseReasoning(capabilities: unknown): string[] {
  if (!isRecord(capabilities)) return [];

  const reasoning = capabilities.reasoning;
  if (!isRecord(reasoning)) return [];

  return getArray(reasoning, "allowed_options").filter((value) => typeof value === "string");
}
