/**
 * The models magpie's gateway lists on `GET /v1/models`, in the contract's
 * shape. Routing groups (`group/<id>`, found groups `auto/<model>`) come first.
 */
import { createHash } from "node:crypto";

export interface Model {
  id: string;
  name: string;
  provider: string | null;
  group: boolean;
  contextWindow: number | null;
  /** The Xueness profile id the composer selects this model by. */
  profileId: string;
}

type Dict = Record<string, unknown>;

/**
 * Xueness profile ids allow only `[A-Za-z0-9._-]{1,64}`, while magpie ids carry
 * "/" (`provider/model`, `group/<id>`) and can be long. A readable slug plus a
 * hash of the real id keeps each one valid, stable and distinct (at most 60 chars).
 */
export function profileIdFor(modelId: string): string {
  const slug = modelId.replace(/[^A-Za-z0-9._-]+/gu, "-").replace(/^[._-]+|[._-]+$/gu, "").slice(0, 44) || "model";
  return `magpie.${slug}.${createHash("sha256").update(modelId).digest("hex").slice(0, 8)}`;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function positive(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.trunc(value) : null;
}

/** True for the ids agents pick a routing group by. */
export function isGroupId(id: string): boolean {
  return id.startsWith("group/") || id.startsWith("auto/");
}

function toModel(row: Dict): Model | null {
  const id = text(row["id"]);
  if (id === null) return null;
  const group = isGroupId(id);
  return {
    id,
    name: text(row["display_name"]) ?? id,
    provider: group ? null : text(row["owned_by"]),
    group,
    contextWindow: positive(row["context_window"]) ?? positive(row["context_length"]) ?? positive(row["max_input_tokens"]),
    profileId: profileIdFor(id),
  };
}

/** The contract's model list from the gateway's OpenAI-style answer; groups first, then the gateway's order. */
export function modelsFromGateway(body: unknown): Model[] {
  const rows = typeof body === "object" && body !== null && Array.isArray((body as Dict)["data"]) ? (body as Dict)["data"] as unknown[] : [];
  const models: Model[] = [];
  for (const row of rows) {
    if (typeof row !== "object" || row === null) continue;
    const model = toModel(row as Dict);
    if (model !== null) models.push(model);
  }
  return [...models.filter((model) => model.group), ...models.filter((model) => !model.group)];
}
