import { getHeaders, getTimeoutMs } from "./config.ts";

export interface FetchJsonOptions {
  timeoutMs?: number;
  headers?: Record<string, string>;
  fetchImplementation?: typeof fetch;
}

export async function fetchJson(url: string, options: FetchJsonOptions = {}): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? getTimeoutMs());
  const fetchImplementation = options.fetchImplementation ?? fetch;

  try {
    const response = await fetchImplementation(url, {
      headers: options.headers ?? getHeaders(),
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

export function formatError(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === "AbortError") return "request timed out";
    return error.message;
  }

  return String(error);
}
