import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { normalizeBaseUrl } from "./config.ts";
import { formatError } from "./http.ts";
import { discoverLmStudio } from "./lm-studio/discovery.ts";
import type { LmStudioDiscovery } from "./lm-studio/types.ts";
import { createProviderConfig, PROVIDER_ID } from "./pi/provider.ts";
import { formatDiscovery } from "./pi/rendering.ts";
import { LmStudioRuntimeState } from "./state.ts";

const MESSAGE_TYPE = "lm-studio-models";

class LmStudioExtensionRuntime {
  private readonly state = new LmStudioRuntimeState();

  constructor(private readonly pi: ExtensionAPI) {}

  register(): void {
    this.registerRenderer();
    this.registerCommand();
    this.registerEvents();
  }

  async initialize(): Promise<void> {
    try {
      await this.refresh();
    } catch (error) {
      this.unregisterProvider(formatError(error));
    }
  }

  private registerRenderer(): void {
    this.pi.registerMessageRenderer(MESSAGE_TYPE, (message, _options, theme) => {
      const title = theme.fg("accent", theme.bold("LM Studio models"));
      return new Text(`${title}\n${message.content}`, 0, 0);
    });
  }

  private registerCommand(): void {
    this.pi.registerCommand("lm-studio-models", {
      description: "Refresh and show LM Studio local models",
      handler: async (_args, ctx) => {
        try {
          const discovery = await this.refresh();
          this.setStatus(ctx);
          this.notify(ctx, `LM Studio: ${discovery.models.length} chat model(s) found`, "info");
          this.sendDiscovery(discovery);
        } catch (error) {
          const message = formatError(error);
          this.unregisterProvider(message);
          this.setStatus(ctx);
          this.notify(ctx, `LM Studio unavailable: ${message}`, "error");
          this.sendUnavailable(message);
        }
      },
    });
  }

  private registerEvents(): void {
    this.pi.on("session_start", (_event, ctx) => {
      this.setStatus(ctx);
    });

    this.pi.on("model_select", (event, ctx) => {
      if (!ctx.hasUI) return;

      if (event.model.provider === PROVIDER_ID) {
        ctx.ui.setStatus("lm-studio-model", `local ${event.model.id}`);
      } else {
        ctx.ui.setStatus("lm-studio-model", undefined);
      }
    });
  }

  private async refresh(): Promise<LmStudioDiscovery> {
    const discovery = await discoverLmStudio();
    this.state.setDiscovery(discovery);
    this.pi.registerProvider(PROVIDER_ID, createProviderConfig(discovery));
    return discovery;
  }

  private unregisterProvider(error: string): void {
    this.state.setError(error);
    this.pi.unregisterProvider(PROVIDER_ID);
  }

  private setStatus(ctx: ExtensionContext): void {
    if (!ctx.hasUI) return;

    ctx.ui.setStatus("lm-studio", this.state.statusText());
  }

  private notify(ctx: ExtensionContext, message: string, level: "info" | "error"): void {
    if (!ctx.hasUI) return;

    ctx.ui.notify(message, level);
  }

  private sendDiscovery(discovery: LmStudioDiscovery): void {
    this.pi.sendMessage({
      customType: MESSAGE_TYPE,
      content: formatDiscovery(discovery),
      display: true,
      details: { provider: PROVIDER_ID, modelCount: discovery.models.length },
    });
  }

  private sendUnavailable(error: string): void {
    this.pi.sendMessage({
      customType: MESSAGE_TYPE,
      content: `LM Studio unavailable at ${normalizeBaseUrl()}\n\n${error}\n\nStart it with: lms server start`,
      display: true,
      details: { provider: PROVIDER_ID, error },
    });
  }
}

export default async function lmStudioProvider(pi: ExtensionAPI): Promise<void> {
  const runtime = new LmStudioExtensionRuntime(pi);
  runtime.register();
  await runtime.initialize();
}
