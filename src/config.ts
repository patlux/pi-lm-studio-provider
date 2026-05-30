export const DEFAULT_BASE_URL = "http://127.0.0.1:1234";
export const DEFAULT_TIMEOUT_MS = 1500;

const LM_STUDIO_API_SUFFIXES = ["/api/v1", "/api/v0", "/v1"];

export function normalizeBaseUrl(rawBaseUrl = configuredBaseUrl()): string {
  let value = rawBaseUrl.trim().replace(/\/+$/, "");

  for (const suffix of LM_STUDIO_API_SUFFIXES) {
    if (value.endsWith(suffix)) {
      value = value.slice(0, -suffix.length);
      break;
    }
  }

  return value || DEFAULT_BASE_URL;
}

export function configuredBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  return env.PI_LM_STUDIO_BASE_URL || env.LM_STUDIO_BASE_URL || DEFAULT_BASE_URL;
}

export function getTimeoutMs(env: NodeJS.ProcessEnv = process.env): number {
  const raw = Number(env.PI_LM_STUDIO_TIMEOUT_MS || "");
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TIMEOUT_MS;
}

export function getHeaders(env: NodeJS.ProcessEnv = process.env): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/json" };
  const token = env.LM_API_TOKEN;

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}
