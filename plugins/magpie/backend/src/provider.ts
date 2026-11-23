/**
 * The composer-facing adapter for one magpie model or routing group. It is a
 * host adapter: the agent treats `contextWindow` and `maxOutputTokens` as
 * budgeting hints, while magpie applies each model's own limits.
 *
 * magpie starts on the first request. The inner `OpenAICompatible` client is
 * built per request against the running gateway (a port pair can move), and
 * omits `max_tokens` unless a naming or summarizer handoff capped it.
 */
import { OpenAICompatible, type ChatProvider, type ProviderCallOptions, type StreamObservers } from "@xueness/providers";

type Dict = Record<string, unknown>;

/** `maxOutputTokens` bound enforced by `resolveRuntimeOptions`. */
export const ADAPTER_OUTPUT_CAP = 32_768;
/** Any bearer token works on magpie's loopback gateway. */
export const GATEWAY_TOKEN = "magpie";

/** What the adapter needs of the running gateway. */
export interface GatewayAccess {
  /** Start magpie when needed; rejects when the plugin is disabled or magpie cannot start. */
  ensure(): Promise<void>;
  /** The OpenAI-compatible base URL, read after `ensure()`. */
  readonly gatewayUrl: string;
}

export class MagpieProvider implements ChatProvider {
  /** Bounded naming and summarizer handoffs reuse host adapters. */
  readonly hostAdapter = true;
  readonly protocol = "openai";
  readonly model: string;
  readonly capabilities: ReadonlySet<string> = new Set<string>();
  readonly runtimeProfile = "standard";
  readonly contextWindow: number;
  readonly maxOutputTokens: number = ADAPTER_OUTPUT_CAP;
  readonly toolCalling = "native";
  requestDeadline: number | null = null;
  private readonly gateway: GatewayAccess;
  private readonly reasoningEffort: string | null;

  constructor(gateway: GatewayAccess, model: string, contextWindow: number, reasoningEffort: string | null = null) {
    this.gateway = gateway;
    this.model = model;
    this.contextWindow = contextWindow;
    this.reasoningEffort = reasoningEffort;
  }

  /** A client bound to the running gateway; magpie starts on first use. */
  private async client(): Promise<OpenAICompatible> {
    await this.gateway.ensure();
    const capped = this.maxOutputTokens < ADAPTER_OUTPUT_CAP ? this.maxOutputTokens : null;
    const client = new OpenAICompatible({
      base: this.gateway.gatewayUrl, model: this.model, key: GATEWAY_TOKEN, allowLoopbackHttp: true,
      runtimeProfile: "standard", toolCalling: "native", maxOutputTokens: capped,
      capabilities: [], reasoningEffort: this.reasoningEffort,
    });
    // The run loop's deadline belongs to the outer adapter; the inner client is
    // rebuilt per request and would otherwise lose it.
    client.requestDeadline = this.requestDeadline;
    return client;
  }

  async complete(messages: Dict[], tools: Dict[], options: ProviderCallOptions = {}): Promise<Dict> {
    return (await this.client()).complete(messages, tools, options);
  }

  async stream(messages: Dict[], tools: Dict[], observers: StreamObservers = {}, options: ProviderCallOptions = {}): Promise<Dict> {
    return (await this.client()).stream(messages, tools, observers, options);
  }
}
