import type { ProviderConfig, ProviderModelConfig } from "@earendil-works/pi-coding-agent";
import type { LmStudioDiscovery, LmStudioModelSummary } from "../lm-studio/types.ts";

export const PROVIDER_ID = "lm-studio";
export const PROVIDER_NAME = "LM Studio (local)";
export const DEFAULT_MAX_TOKENS = 16_384;

const ZERO_COST = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };

const OPENAI_COMPAT: NonNullable<ProviderModelConfig["compat"]> = {
  supportsStore: false,
  supportsDeveloperRole: false,
  supportsReasoningEffort: false,
  supportsUsageInStreaming: false,
  maxTokensField: "max_tokens",
  supportsStrictMode: false,
  supportsLongCacheRetention: false,
};

type ThinkingLevelMap = NonNullable<ProviderModelConfig["thinkingLevelMap"]>;

export function createProviderConfig(discovery: LmStudioDiscovery): ProviderConfig {
  return {
    name: PROVIDER_NAME,
    baseUrl: discovery.openAiBaseUrl,
    apiKey: "LM_API_TOKEN",
    api: "openai-completions",
    models: discovery.models.map(toProviderModel),
  };
}

export function toProviderModel(model: LmStudioModelSummary): ProviderModelConfig {
  const providerModel: ProviderModelConfig = {
    id: model.id,
    name: modelDisplayName(model),
    api: "openai-completions",
    reasoning: model.reasoningAllowed.length > 0,
    input: model.vision ? ["text", "image"] : ["text"],
    cost: ZERO_COST,
    contextWindow: model.contextWindow,
    maxTokens: maxTokensFor(model.contextWindow),
    compat: OPENAI_COMPAT,
  };

  if (model.reasoningAllowed.length > 0) {
    providerModel.thinkingLevelMap = thinkingLevelMap(model.reasoningAllowed);
  }

  return providerModel;
}

export function maxTokensFor(contextWindow: number): number {
  return Math.max(1024, Math.min(DEFAULT_MAX_TOKENS, Math.floor(contextWindow / 2)));
}

export function modelDisplayName(model: LmStudioModelSummary): string {
  const tags: string[] = [];

  if (model.quantization) tags.push(model.quantization);
  if (model.loaded) tags.push("loaded");
  if (model.vision) tags.push("vision");
  if (model.toolUse) tags.push("tools");
  if (model.reasoningAllowed.length > 0) tags.push(`reasoning ${model.reasoningAllowed.join("/")}`);

  return tags.length > 0 ? `${model.displayName} (${tags.join(", ")})` : model.displayName;
}

export function thinkingLevelMap(allowed: string[]): ThinkingLevelMap {
  const allowedSet = new Set(allowed);
  const map: ThinkingLevelMap = {};

  if (!allowedSet.has("off")) map.off = null;
  if (!allowedSet.has("low") && !allowedSet.has("on")) map.low = null;
  if (!allowedSet.has("medium") && !allowedSet.has("on")) map.medium = null;
  if (!allowedSet.has("high") && !allowedSet.has("on")) map.high = null;

  map.minimal = allowedSet.has("low") ? "low" : allowedSet.has("on") ? "on" : null;
  map.xhigh = allowedSet.has("high") ? "high" : allowedSet.has("on") ? "on" : null;

  return map;
}
