import { normalizeBaseUrl } from "../config.ts";
import { fetchJson as defaultFetchJson, formatError } from "../http.ts";
import { dedupeModels, parseOpenAIModels, parseRestV0Models, parseRestV1Models } from "./parsers.ts";
import type { FetchJson, LmStudioDiscovery, LmStudioModelSummary } from "./types.ts";

interface DiscoveryAttempt {
  url: string;
  parse: (payload: unknown) => LmStudioModelSummary[];
}

export interface DiscoverLmStudioOptions {
  baseUrl?: string;
  fetchJson?: FetchJson;
}

export class LmStudioDiscoveryError extends Error {
  readonly rootBaseUrl: string;
  readonly attempts: string[];

  constructor(rootBaseUrl: string, attempts: string[]) {
    super(attempts.join("\n"));
    this.name = "LmStudioDiscoveryError";
    this.rootBaseUrl = rootBaseUrl;
    this.attempts = attempts;
  }
}

export async function discoverLmStudio(options: DiscoverLmStudioOptions = {}): Promise<LmStudioDiscovery> {
  const rootBaseUrl = normalizeBaseUrl(options.baseUrl);
  const fetchJson = options.fetchJson ?? defaultFetchJson;
  const attempts = discoveryAttempts(rootBaseUrl);
  const errors: string[] = [];

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

  throw new LmStudioDiscoveryError(rootBaseUrl, errors);
}

function discoveryAttempts(rootBaseUrl: string): DiscoveryAttempt[] {
  return [
    {
      url: `${rootBaseUrl}/api/v1/models`,
      parse: parseRestV1Models,
    },
    {
      url: `${rootBaseUrl}/api/v0/models`,
      parse: parseRestV0Models,
    },
    {
      url: `${rootBaseUrl}/v1/models`,
      parse: parseOpenAIModels,
    },
  ];
}
