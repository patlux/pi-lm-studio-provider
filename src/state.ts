import type { LmStudioDiscovery } from "./lm-studio/types.ts";

export class LmStudioRuntimeState {
  private discovery: LmStudioDiscovery | undefined;
  private error: string | undefined;

  setDiscovery(discovery: LmStudioDiscovery): void {
    this.discovery = discovery;
    this.error = undefined;
  }

  setError(error: string): void {
    this.discovery = undefined;
    this.error = error;
  }

  clear(): void {
    this.discovery = undefined;
  }

  getDiscovery(): LmStudioDiscovery | undefined {
    return this.discovery;
  }

  getError(): string | undefined {
    return this.error;
  }

  statusText(): string | undefined {
    if (!this.discovery) return undefined;

    const loaded = this.discovery.models.filter((model) => model.loaded).length;
    return `LM Studio ${this.discovery.models.length}/${loaded}`;
  }
}
