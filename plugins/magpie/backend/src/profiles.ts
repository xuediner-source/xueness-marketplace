/**
 * The providers view this plugin publishes. `ProfileStore.external` is a
 * single slot; every id carries the `magpie.` prefix so this view answers only
 * for its own records.
 *
 * Records come from the last model list kept in `models.json` (loaded once,
 * replaced by `refresh`), so `list()` is synchronous and never starts magpie.
 * They bypass `resolveRuntimeOptions`: the bound applied to saved profiles is
 * not the gateway's concern.
 */
import { PyValueError } from "@xueness/contracts";
import type { ChatProvider } from "@xueness/providers";
import { readModelsCache, writeModelsCache, type Layout } from "./layout.ts";
import type { Model } from "./models.ts";
import { MagpieProvider, type GatewayAccess } from "./provider.ts";

type Dict = Record<string, unknown>;

/** Every profile id this view owns starts here. */
export const PROFILE_PREFIX = "magpie.";
/** The `subscriptionId` marker of a magpie record. */
const SUPPLIER = "magpie";
const DEFAULT_CONTEXT = 128_000;
const MAX_OUTPUT = 32_768;

export interface ProfileSelection {
  model?: string | null;
  reasoningEffort?: string | null;
  runtimeProfile?: string | null;
}

/** Structurally `ExternalProfiles`; declaring it here keeps plugins independent. */
export interface MagpieProfiles {
  list(): Dict[];
  record(id: string): Dict | null;
  resolve(record: Dict, selection: ProfileSelection): ChatProvider;
  supplier(record: Dict): Dict | null;
}

export interface ProfilesOptions {
  layout: Layout;
  /** The plugin is enabled and installed. */
  available(): boolean;
  gateway: GatewayAccess;
}

function publicRecord(gatewayUrl: string, model: Model): Dict {
  return {
    // A valid Xueness profile id (see `profileIdFor`); `model` keeps magpie's real id for requests.
    id: model.profileId, name: `Magpie · ${model.name}`, baseUrl: gatewayUrl, model: model.id,
    // "subscription" is the composer's marker for account-backed external
    // profiles: read-only in provider settings, listed after saved ones.
    source: "subscription", subscriptionId: SUPPLIER, hasKey: true, protocol: "openai",
    capabilities: [], reasoningLevels: [], runtimeProfile: "standard",
    contextWindow: model.contextWindow ?? DEFAULT_CONTEXT, maxOutputTokens: MAX_OUTPUT, toolCalling: "native",
  };
}

export class ModelStore {
  private readonly layout: Layout;
  private models: Model[] | null = null;

  constructor(layout: Layout) { this.layout = layout; }

  get(): readonly Model[] {
    this.models ??= readModelsCache(this.layout);
    return this.models;
  }

  /** Replace the kept list; a failed disk write keeps the in-memory list. */
  set(models: Model[]): void {
    if (this.models !== null && JSON.stringify(this.models) === JSON.stringify(models)) return;
    this.models = models;
    try { writeModelsCache(this.layout, models); } catch { /* the next refresh writes it again */ }
  }
}

export function createProfiles(store: ModelStore, options: ProfilesOptions): MagpieProfiles {
  const records = (): Dict[] => options.available() ? store.get().map((model) => publicRecord(options.gateway.gatewayUrl, model)) : [];
  return {
    list: records,
    record: (id) => records().find((record) => record["id"] === id) ?? null,
    resolve: (record, selection = {}) => {
      const model = typeof record["model"] === "string" ? record["model"] : "";
      if (typeof record["id"] !== "string" || !record["id"].startsWith(PROFILE_PREFIX) || model === "") throw new PyValueError("unknown magpie model");
      const profile = selection.runtimeProfile ?? null;
      if (profile !== null && profile !== "standard") throw new PyValueError("magpie models require the standard runtime profile");
      const window = typeof record["contextWindow"] === "number" ? record["contextWindow"] : DEFAULT_CONTEXT;
      return new MagpieProvider(options.gateway, model, window, selection.reasoningEffort ?? null);
    },
    supplier: (record) => record["subscriptionId"] === SUPPLIER
      ? { supplierId: `subscription:${SUPPLIER}`, supplierName: "Magpie", supplierNameEn: "Magpie" }
      : null,
  };
}
