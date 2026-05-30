import type { LmStudioDiscovery, LmStudioModelSummary } from "../lm-studio/types.ts";
import { PROVIDER_ID } from "./provider.ts";

export function formatDiscovery(discovery: LmStudioDiscovery): string {
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

export function compactDetails(model: LmStudioModelSummary): string {
  const details: string[] = [];

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

export function formatTokens(value: number | undefined): string {
  if (!value) return "?";
  if (value >= 1000) return `${Math.round(value / 1000)}k`;
  return String(value);
}
