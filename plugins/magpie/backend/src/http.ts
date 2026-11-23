/**
 * The `/api/magpie/*` routes: path matching, body validation and the mapping
 * of failures to the contract's status codes (400 bad body, 403 disabled, 404
 * unknown id, 502 magpie refused, 503 magpie cannot start). What each route
 * returns is built by the service (`api.ts`).
 */
import { MagpieError } from "./client.ts";
import { MagpieStartError } from "./supervisor.ts";

type Dict = Record<string, unknown>;
type Reply = [number, Dict];

export const MAGPIE_ROUTES = [
  "GET /api/magpie/status",
  "POST /api/magpie/start",
  "POST /api/magpie/stop",
  "POST /api/magpie/restart",
  "POST /api/magpie/settings",
  "GET /api/magpie/console",
  "GET /api/magpie/overview",
  "GET /api/magpie/providers",
  "GET /api/magpie/presets",
  "POST /api/magpie/providers",
  "POST /api/magpie/providers/:id/:action",
  "POST /api/magpie/providers/:id/keys",
  "DELETE /api/magpie/providers/:id/keys/:keyId",
  "GET /api/magpie/accounts",
  "POST /api/magpie/accounts/:id/:action",
  "GET /api/magpie/signin/agents",
  "POST /api/magpie/signin",
  "GET /api/magpie/signin/:id",
  "POST /api/magpie/signin/:id/cancel",
  "POST /api/magpie/signin/:id/callback",
  "GET /api/magpie/quotas",
  "GET /api/magpie/groups",
  "POST /api/magpie/groups",
  "POST /api/magpie/groups/:id",
  "DELETE /api/magpie/groups/:id",
  "GET /api/magpie/models",
  "GET /api/magpie/usage",
];

export const PROVIDER_ACTIONS = ["enable", "disable", "delete", "test", "refresh-models"] as const;
export const ACCOUNT_ACTIONS = ["enable", "disable", "forget", "switch"] as const;
export const GROUP_MODES = ["smart", "order", "rotate", "usage", "pace"] as const;
export const PERIODS = ["today", "week", "month"] as const;
export const PROTOCOLS = ["openai", "anthropic", "gemini"] as const;

export type ProviderAction = typeof PROVIDER_ACTIONS[number];
export type AccountAction = typeof ACCOUNT_ACTIONS[number];
export type GroupMode = typeof GROUP_MODES[number];
export type Period = typeof PERIODS[number];
export type Protocol = typeof PROTOCOLS[number];

export interface ProviderInput { preset?: string; name?: string; baseUrl?: string; protocol?: Protocol; apiKey?: string }
export interface GroupInput { name?: string; mode?: GroupMode; members?: string[]; enabled?: boolean }

/** What the routes need of the adapter; `api.ts` implements it. */
export interface MagpieService {
  status(): Promise<Dict>;
  start(): Promise<Dict>;
  stop(): Promise<Dict>;
  restart(): Promise<Dict>;
  settings(accountDiscovery: boolean | undefined): Promise<Dict>;
  console(): Promise<Dict>;
  overview(): Promise<Dict>;
  providers(): Promise<Dict>;
  presets(): Promise<Dict>;
  addProvider(input: ProviderInput): Promise<Dict>;
  providerAction(id: string, action: ProviderAction): Promise<Dict>;
  addKey(id: string, apiKey: string, label: string | undefined): Promise<Dict>;
  removeKey(id: string, keyId: string): Promise<Dict>;
  accounts(): Promise<Dict>;
  accountAction(id: string, action: AccountAction): Promise<Dict>;
  signinAgents(): Promise<Dict>;
  signinStart(agent: string): Promise<Dict>;
  signinStatus(id: string): Promise<Dict>;
  signinCancel(id: string): Promise<Dict>;
  signinCallback(id: string, url: string): Promise<Dict>;
  quotas(): Promise<Dict>;
  groups(): Promise<Dict>;
  createGroup(input: GroupInput): Promise<Dict>;
  updateGroup(id: string, input: GroupInput): Promise<Dict>;
  deleteGroup(id: string): Promise<Dict>;
  models(): Promise<Dict>;
  usage(period: Period): Promise<Dict>;
}

export interface MagpieHttpOptions {
  /** The plugin is enabled and installed. */
  enabled: () => boolean;
  service: MagpieService;
}

interface Pattern { method: string; segments: string[]; key: string }

const PATTERNS: Pattern[] = MAGPIE_ROUTES.map((route) => {
  const [method = "", path = ""] = route.split(" ");
  return { method, segments: path.split("/").slice(3), key: route };
});

interface Match { key: string; params: Record<string, string> }

function decode(value: string): string {
  try { return decodeURIComponent(value); } catch { return value; }
}

function match(method: string, parts: readonly string[]): Match | null {
  if (parts[0] !== "api" || parts[1] !== "magpie") return null;
  const rest = parts.slice(2);
  // Fixed segments win over parameters, so `/signin/agents` is not a sign-in id.
  let best: Match | null = null;
  let bestFixed = -1;
  for (const pattern of PATTERNS) {
    if (pattern.method !== method || pattern.segments.length !== rest.length) continue;
    const params: Record<string, string> = {};
    let fixed = 0;
    const ok = pattern.segments.every((segment, index) => {
      const part = rest[index] ?? "";
      if (segment.startsWith(":")) { if (part === "") return false; params[segment.slice(1)] = decode(part); return true; }
      fixed += 1;
      return segment === part;
    });
    if (ok && fixed > bestFixed) { best = { key: pattern.key, params }; bestFixed = fixed; }
  }
  return best;
}

export function ownsMagpieRoute(method: string, parts: readonly string[]): boolean {
  return match(method, parts) !== null;
}

function isDict(value: unknown): value is Dict {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function bad(message: string): MagpieError {
  return new MagpieError(400, message);
}

function body(data: unknown, required: boolean): Dict {
  if (data === null || data === undefined) { if (required) throw bad("缺少请求内容"); return {}; }
  if (!isDict(data)) throw bad("请求内容必须是对象");
  return data;
}

function optString(data: Dict, key: string): string | undefined {
  const value = data[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") throw bad(`${key} 必须是字符串`);
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function reqString(data: Dict, key: string): string {
  const value = optString(data, key);
  if (value === undefined) throw bad(`缺少 ${key}`);
  return value;
}

function oneOf<T extends string>(value: string, allowed: readonly T[], what: string): T {
  const found = allowed.find((item) => item === value);
  if (found === undefined) throw bad(`${what} 必须是 ${allowed.join(" / ")} 之一`);
  return found;
}

function httpUrl(value: string, key: string): string {
  try {
    const url = new URL(value);
    if (url.protocol === "http:" || url.protocol === "https:") return value;
  } catch { /* fall through */ }
  throw bad(`${key} 必须是 http(s) 地址`);
}

function providerInput(data: unknown): ProviderInput {
  const input = body(data, true);
  const out: ProviderInput = {};
  const preset = optString(input, "preset"), name = optString(input, "name");
  const baseUrl = optString(input, "baseUrl"), protocol = optString(input, "protocol"), apiKey = optString(input, "apiKey");
  if (preset !== undefined) out.preset = preset;
  if (name !== undefined) out.name = name;
  if (baseUrl !== undefined) out.baseUrl = httpUrl(baseUrl, "baseUrl");
  if (protocol !== undefined) out.protocol = oneOf(protocol, PROTOCOLS, "protocol");
  if (apiKey !== undefined) out.apiKey = apiKey;
  if (out.preset === undefined && out.baseUrl === undefined) throw bad("需要 preset 或 baseUrl");
  if (out.preset === undefined && out.name === undefined) throw bad("自定义供应商需要 name");
  return out;
}

function members(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0 || !value.every((item) => typeof item === "string" && item.trim() !== "")) {
    throw bad("members 必须是非空的模型 id 列表");
  }
  return value.map((item) => (item as string).trim());
}

function groupInput(data: unknown, creating: boolean): GroupInput {
  const input = body(data, creating);
  const out: GroupInput = {};
  const name = creating ? reqString(input, "name") : optString(input, "name");
  if (name !== undefined) out.name = name;
  if (creating || input["mode"] !== undefined) out.mode = oneOf(reqString(input, "mode"), GROUP_MODES, "mode");
  if (creating || input["members"] !== undefined) out.members = members(input["members"]);
  if (input["enabled"] !== undefined) {
    if (typeof input["enabled"] !== "boolean") throw bad("enabled 必须是布尔值");
    out.enabled = input["enabled"];
  }
  return out;
}

type Handler = (service: MagpieService, params: Record<string, string>, query: Record<string, unknown>, data: unknown) => Promise<Dict>;

const HANDLERS: Record<string, Handler> = {
  "GET /api/magpie/status": (s) => s.status(),
  "POST /api/magpie/start": (s) => s.start(),
  "POST /api/magpie/stop": (s) => s.stop(),
  "POST /api/magpie/restart": (s) => s.restart(),
  "POST /api/magpie/settings": (s, _p, _q, data) => {
    const input = body(data, false);
    if (input["accountDiscovery"] !== undefined && typeof input["accountDiscovery"] !== "boolean") throw bad("accountDiscovery 必须是布尔值");
    return s.settings(input["accountDiscovery"] as boolean | undefined);
  },
  "GET /api/magpie/console": (s) => s.console(),
  "GET /api/magpie/overview": (s) => s.overview(),
  "GET /api/magpie/providers": (s) => s.providers(),
  "GET /api/magpie/presets": (s) => s.presets(),
  "POST /api/magpie/providers": (s, _p, _q, data) => s.addProvider(providerInput(data)),
  "POST /api/magpie/providers/:id/:action": (s, p, _q, data) => {
    body(data, false);
    return s.providerAction(p["id"] ?? "", oneOf(p["action"] ?? "", PROVIDER_ACTIONS, "action"));
  },
  "POST /api/magpie/providers/:id/keys": (s, p, _q, data) => {
    const input = body(data, true);
    return s.addKey(p["id"] ?? "", reqString(input, "apiKey"), optString(input, "label"));
  },
  "DELETE /api/magpie/providers/:id/keys/:keyId": (s, p) => s.removeKey(p["id"] ?? "", p["keyId"] ?? ""),
  "GET /api/magpie/accounts": (s) => s.accounts(),
  "POST /api/magpie/accounts/:id/:action": (s, p, _q, data) => {
    body(data, false);
    return s.accountAction(p["id"] ?? "", oneOf(p["action"] ?? "", ACCOUNT_ACTIONS, "action"));
  },
  "GET /api/magpie/signin/agents": (s) => s.signinAgents(),
  "POST /api/magpie/signin": (s, _p, _q, data) => s.signinStart(reqString(body(data, true), "agent")),
  "GET /api/magpie/signin/:id": (s, p) => s.signinStatus(p["id"] ?? ""),
  "POST /api/magpie/signin/:id/cancel": (s, p) => s.signinCancel(p["id"] ?? ""),
  "POST /api/magpie/signin/:id/callback": (s, p, _q, data) => s.signinCallback(p["id"] ?? "", reqString(body(data, true), "url")),
  "GET /api/magpie/quotas": (s) => s.quotas(),
  "GET /api/magpie/groups": (s) => s.groups(),
  "POST /api/magpie/groups": (s, _p, _q, data) => s.createGroup(groupInput(data, true)),
  "POST /api/magpie/groups/:id": (s, p, _q, data) => s.updateGroup(p["id"] ?? "", groupInput(data, false)),
  "DELETE /api/magpie/groups/:id": (s, p) => s.deleteGroup(p["id"] ?? ""),
  "GET /api/magpie/models": (s) => s.models(),
  "GET /api/magpie/usage": (s, _p, q) => {
    const period = typeof q["period"] === "string" && q["period"] !== "" ? q["period"] : "today";
    return s.usage(oneOf(period, PERIODS, "period"));
  },
};

function failure(error: unknown): Reply {
  if (error instanceof MagpieError) {
    const out: Dict = { error: error.message };
    if (error.detail !== null) out["detail"] = error.detail;
    return [error.status, out];
  }
  if (error instanceof MagpieStartError) return [503, { error: error.message }];
  throw error;
}

export function createMagpieHttp(options: MagpieHttpOptions) {
  return {
    routes: MAGPIE_ROUTES,
    owns: ownsMagpieRoute,
    async dispatch(method: string, parts: readonly string[], query: Record<string, unknown> = {}, data: unknown = null): Promise<Reply | null> {
      const found = match(method, parts);
      if (found === null) return null;
      if (!options.enabled()) return [403, { error: "plugin disabled or dependency unavailable: magpie", plugin: "magpie" }];
      const handler = HANDLERS[found.key];
      if (handler === undefined) return [405, { error: "method not allowed" }];
      try {
        return [200, await handler(options.service, found.params, query, data)];
      } catch (error) {
        return failure(error);
      }
    },
  };
}
