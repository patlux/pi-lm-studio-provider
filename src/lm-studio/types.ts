export type DiscoverySource = "rest-v1" | "rest-v0" | "openai-v1";
export type ChatModelType = "llm" | "vlm";

export interface LmStudioModelSummary {
  id: string;
  displayName: string;
  publisher?: string;
  architecture?: string;
  quantization?: string;
  params?: string;
  format?: string;
  loaded: boolean;
  contextWindow: number;
  maxContextLength?: number;
  vision: boolean;
  toolUse: boolean;
  reasoningAllowed: string[];
  source: DiscoverySource;
}

export interface LmStudioDiscovery {
  rootBaseUrl: string;
  openAiBaseUrl: string;
  sourceUrl: string;
  models: LmStudioModelSummary[];
}

export type FetchJson = (url: string) => Promise<unknown>;
