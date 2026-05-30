import { Text } from "@earendil-works/pi-tui";

const PROVIDER_ID = "lm-studio";
const PROVIDER_NAME = "LM Studio (local)";
const DEFAULT_BASE_URL = "http://127.0.0.1:1234";
const DEFAULT_TIMEOUT_MS = 1500;
const DEFAULT_CONTEXT_WINDOW = 128000;
const DEFAULT_MAX_TOKENS = 16384;
const ZERO_COST = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
const OPENAI_COMPAT = {
  supportsStore: false,
  supportsDeveloperRole: false,
  supportsReasoningEffort: false,
  supportsUsageInStreaming: false,
  maxTokensField: "max_tokens",
  supportsStrictMode: false,
  supportsLongCacheRetention: false,
};

let lastDiscovery;
let lastError;

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function getString(record, key) {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}

function getNumber(record, key) {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function getBoolean(record, key) {
  const value = record[key];
  return typeof value === "boolean" ? value : undefined;
}

function getArray(record, key) {
  const value = record[key];
  return Array.isArray(value) ? value : [];
}

function normalizeBaseUrl() {
  const raw = process.env.PI_LM_STUDIO_BASE_URL || process.env.LM_STUDIO_BASE_URL || DEFAULT_BASE_URL;
  let value = raw.trim().replace(/\/+$/, "");

  for (const suffix of ["/api/v1", "/api/v0", "/v1"]) {
    if (value.endsWith(suffix)) {
      value = value.slice(0, -suffix.length);
      break;
    }
  }

  return value || DEFAULT_BASE_URL;
}

function getTimeoutMs() {
  const raw = Number(process.env.PI_LM_STUDIO_TIMEOUT_MS || "");
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TIMEOUT_MS;
}

function getHeaders() {
  const headers = { Accept: "application/json" };
  const token = process.env.LM_API_TOKEN;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getTimeoutMs());

  try {
    const response = await fetch(url, {
      headers: getHeaders(),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      const detail = body ? `: ${body.slice(0, 200)}` : "";
      throw new Error(`${response.status} ${response.statusText}${detail}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function isChatModelType(type) {
  return type === "llm" || type === "vlm";
}

function selectedContextLength(model, loadedInstances) {
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

function parseReasoning(capabilities) {
  if (!isRecord(capabilities)) return [];

  const reasoning = capabilities.reasoning;
  if (!isRecord(reasoning)) return [];

  return getArray(reasoning, "allowed_options").filter((value) => typeof value === "string");
}

function parseRestV1Model(model) {
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

  return {
    id,
    displayName: getString(model, "display_name") || id,
    publisher: getString(model, "publisher"),
    architecture: getString(model, "architecture"),
    quantization: quantizationName || undefined,
    params: getString(model, "params_string"),
    format: getString(model, "format"),
    loaded: loadedInstances.length > 0,
    contextWindow: selectedContextLength(model, loadedInstances),
    maxContextLength: getNumber(model, "max_context_length"),
    vision,
    toolUse,
    reasoningAllowed: parseReasoning(capabilities),
    source: "rest-v1",
  };
}

function parseRestV0Model(model) {
  if (!isRecord(model)) return undefined;

  const type = getString(model, "type");
  const id = getString(model, "id");
  if (!id || !isChatModelType(type)) return undefined;

  const capabilities = getArray(model, "capabilities").filter((value) => typeof value === "string");
  const loaded = getString(model, "state") === "loaded";

  return {
    id,
    displayName: id,
    publisher: getString(model, "publisher"),
    architecture: getString(model, "arch"),
    quantization: getString(model, "quantization"),
    params: undefined,
    format: getString(model, "compatibility_type"),
    loaded,
    contextWindow: getNumber(model, "loaded_context_length") || getNumber(model, "max_context_length") || DEFAULT_CONTEXT_WINDOW,
    maxContextLength: getNumber(model, "max_context_length"),
    vision: type === "vlm" || capabilities.includes("vision"),
    toolUse: capabilities.includes("tool_use"),
    reasoningAllowed: [],
    source: "rest-v0",
  };
}

function parseOpenAIModel(model) {
  if (!isRecord(model)) return undefined;

  const id = getString(model, "id");
  if (!id || id.toLowerCase().includes("embed")) return undefined;

  return {
    id,
    displayName: id,
    publisher: getString(model, "owned_by"),
    architecture: undefined,
    quantization: undefined,
    params: undefined,
    format: undefined,
    loaded: false,
    contextWindow: DEFAULT_CONTEXT_WINDOW,
    maxContextLength: undefined,
    vision: false,
    toolUse: true,
    reasoningAllowed: [],
    source: "openai-v1",
  };
}

function parseModels(payload, parser, key) {
  if (!isRecord(payload)) return [];

  return getArray(payload, key).flatMap((item) => {
    const parsed = parser(item);
    if (Array.isArray(parsed)) return parsed;
    return parsed === undefined ? [] : [parsed];
  });
}

async function discoverLmStudio() {
  const rootBaseUrl = normalizeBaseUrl();
  const attempts = [
    {
      url: `${rootBaseUrl}/api/v1/models`,
      parse: (payload) => parseModels(payload, parseRestV1Model, "models"),
    },
    {
      url: `${rootBaseUrl}/api/v0/models`,
      parse: (payload) => parseModels(payload, parseRestV0Model, "data"),
    },
    {
      url: `${rootBaseUrl}/v1/models`,
      parse: (payload) => parseModels(payload, parseOpenAIModel, "data"),
    },
  ];
  const errors = [];

  for (const attempt of attempts) {
    try {
      const payload = await fetchJson(attempt.url);
      const summaries = dedupeModels(attempt.parse(payload));
      if (summaries.length > 0) {
        return {
          rootBaseUrl,
          openAiBaseUrl: `${rootBaseUrl}/v1`,
          sourceUrl: attempt.url,
          models: summaries,
        };
      }
      errors.push(`${attempt.url}: no chat models found`);
    } catch (error) {
      errors.push(`${attempt.url}: ${formatError(error)}`);
    }
  }

  throw new Error(errors.join("\n"));
}

function dedupeModels(models) {
  const seen = new Set();
  const result = [];

  for (const model of models) {
    if (seen.has(model.id)) continue;
    seen.add(model.id);
    result.push(model);
  }

  return result;
}

function maxTokensFor(contextWindow) {
  return Math.max(1024, Math.min(DEFAULT_MAX_TOKENS, Math.floor(contextWindow / 2)));
}

function modelDisplayName(model) {
  const tags = [];
  if (model.quantization) tags.push(model.quantization);
  if (model.loaded) tags.push("loaded");
  if (model.vision) tags.push("vision");
  if (model.toolUse) tags.push("tools");
  if (model.reasoningAllowed.length > 0) tags.push(`reasoning ${model.reasoningAllowed.join("/")}`);

  return tags.length > 0 ? `${model.displayName} (${tags.join(", ")})` : model.displayName;
}

function toProviderModel(model) {
  const providerModel = {
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

function thinkingLevelMap(allowed) {
  const allowedSet = new Set(allowed);
  const map = {};

  if (!allowedSet.has("off")) map.off = null;
  if (!allowedSet.has("low") && !allowedSet.has("on")) map.low = null;
  if (!allowedSet.has("medium") && !allowedSet.has("on")) map.medium = null;
  if (!allowedSet.has("high") && !allowedSet.has("on")) map.high = null;
  map.minimal = allowedSet.has("low") ? "low" : allowedSet.has("on") ? "on" : null;
  map.xhigh = allowedSet.has("high") ? "high" : allowedSet.has("on") ? "on" : null;

  return map;
}

function registerProvider(pi, discovery) {
  pi.registerProvider(PROVIDER_ID, {
    name: PROVIDER_NAME,
    baseUrl: discovery.openAiBaseUrl,
    apiKey: "LM_API_TOKEN",
    api: "openai-completions",
    models: discovery.models.map(toProviderModel),
  });
}

function unregisterProvider(pi) {
  lastDiscovery = undefined;
  pi.unregisterProvider(PROVIDER_ID);
}

function formatTokens(value) {
  if (!value) return "?";
  if (value >= 1000) return `${Math.round(value / 1000)}k`;
  return String(value);
}

function compactDetails(model) {
  const details = [];
  details.push(model.displayName);
  if (model.publisher) details.push(model.publisher);
  if (model.architecture) details.push(model.architecture);
  if (model.quantization) details.push(model.quantization);
  if (model.params) details.push(model.params);
  details.push(`ctx ${formatTokens(model.contextWindow)}`);
  if (model.maxContextLength && model.maxContextLength !== model.contextWindow) {
    details.push(`max ${formatTokens(model.maxContextLength)}`);
  }
  if (model.vision) details.push("vision");
  if (model.toolUse) details.push("tools");
  if (model.reasoningAllowed.length > 0) details.push(`reasoning ${model.reasoningAllowed.join("/")}`);
  return details.join(" · ");
}

function formatDiscovery(discovery) {
  const loaded = discovery.models.filter((model) => model.loaded).length;
  const lines = [
    `LM Studio provider: ${PROVIDER_ID}`,
    `Endpoint: ${discovery.openAiBaseUrl}`,
    `Discovery: ${discovery.sourceUrl}`,
    `Models: ${discovery.models.length} chat model(s), ${loaded} loaded`,
    "",
    "Use /model, Ctrl+L, or: pi --model lm-studio/<model-id>",
    "Use /reload after starting/stopping/loading models in LM Studio.",
    "",
  ];

  for (const model of discovery.models) {
    const marker = model.loaded ? "●" : "○";
    lines.push(`${marker} ${model.id}`);
    lines.push(`  ${compactDetails(model)}`);
  }

  return lines.join("\n");
}

function formatError(error) {
  if (error instanceof Error) {
    if (error.name === "AbortError") return "request timed out";
    return error.message;
  }
  return String(error);
}

function setStatus(ctx) {
  if (!ctx.hasUI) return;

  if (lastDiscovery) {
    const loaded = lastDiscovery.models.filter((model) => model.loaded).length;
    ctx.ui.setStatus("lm-studio", `LM Studio ${lastDiscovery.models.length}/${loaded}`);
  } else {
    ctx.ui.setStatus("lm-studio", undefined);
  }
}

async function refresh(pi) {
  lastDiscovery = await discoverLmStudio();
  lastError = undefined;
  registerProvider(pi, lastDiscovery);
  return lastDiscovery;
}

export default async function lmStudioProvider(pi) {
  pi.registerMessageRenderer("lm-studio-models", (message, _options, theme) => {
    const title = theme.fg("accent", theme.bold("LM Studio models"));
    return new Text(`${title}\n${message.content}`, 0, 0);
  });

  pi.registerCommand("lm-studio-models", {
    description: "Refresh and show LM Studio local models",
    handler: async (_args, ctx) => {
      try {
        const discovery = await refresh(pi);
        setStatus(ctx);
        ctx.ui.notify(`LM Studio: ${discovery.models.length} chat model(s) found`, "info");
        pi.sendMessage({
          customType: "lm-studio-models",
          content: formatDiscovery(discovery),
          display: true,
          details: { provider: PROVIDER_ID, modelCount: discovery.models.length },
        });
      } catch (error) {
        unregisterProvider(pi);
        lastError = formatError(error);
        setStatus(ctx);
        ctx.ui.notify(`LM Studio unavailable: ${lastError}`, "error");
        pi.sendMessage({
          customType: "lm-studio-models",
          content: `LM Studio unavailable at ${normalizeBaseUrl()}\n\n${lastError}\n\nStart it with: lms server start`,
          display: true,
          details: { provider: PROVIDER_ID, error: lastError },
        });
      }
    },
  });

  pi.on("session_start", (_event, ctx) => {
    setStatus(ctx);
  });

  pi.on("model_select", (event, ctx) => {
    if (!ctx.hasUI) return;
    if (event.model.provider === PROVIDER_ID) {
      ctx.ui.setStatus("lm-studio-model", `local ${event.model.id}`);
    } else {
      ctx.ui.setStatus("lm-studio-model", undefined);
    }
  });

  try {
    await refresh(pi);
  } catch (error) {
    unregisterProvider(pi);
    lastError = formatError(error);
  }
}
