/**
 * The magpie adapter: wires the supervisor, the model list and the providers
 * view together and implements every route of the contract by calling
 * magpie's own web app API and gateway read routes.
 *
 * The normalizers at the top turn magpie's JSON into the contract's shapes.
 * A field magpie does not report is `null`, never a guess.
 */
import { randomBytes } from "node:crypto";
import { gatewayGet, isDict, MagpieError, webCall } from "./client.ts";
import { magpieLayout } from "./layout.ts";
import { modelsFromGateway, type Model } from "./models.ts";
import { createMagpieHttp, type GroupInput, type MagpieService, type Period, type ProviderAction, type ProviderInput } from "./http.ts";
import { createProfiles, ModelStore } from "./profiles.ts";
import { Supervisor } from "./supervisor.ts";

type Dict = Record<string, unknown>;

/** Sign-ins magpie runs itself (the others are community plugins magpie installs on its own). */
const SIGNIN_AGENTS = [
  { id: "claude", name: "Claude Code" }, { id: "codex", name: "ChatGPT (Codex)" },
  { id: "copilot", name: "GitHub Copilot" }, { id: "gemini", name: "Gemini CLI" },
];
const SLOW_MS = 35_000;
/** Fields of a group the page derives; saving one back would store what is computed. */
const DERIVED_GROUP_FIELDS = ["ready", "memberInfo", "holds", "offers", "shared", "picked", "patterns", "decides", "ref", "classifierFailed", "matched"];

// ---- small readers ----

function dict(value: unknown): Dict { return isDict(value) ? value : {}; }
function list(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function str(value: unknown): string | null { return typeof value === "string" && value.trim() !== "" ? value : null; }
function num(value: unknown): number | null { return typeof value === "number" && Number.isFinite(value) ? value : null; }
function dicts(value: unknown): Dict[] { return list(value).filter(isDict); }

// ---- normalizers ----

export interface Context { presetKinds: Map<string, string>; balances: Map<string, string> }

function protocolOf(raw: Dict): string | null {
  if (str(raw["chat"]) !== null || str(raw["responses"]) !== null) return "openai";
  if (str(raw["anthropic"]) !== null) return "anthropic";
  if (str(raw["gemini"]) !== null) return "gemini";
  return null;
}

function isLoopbackHost(host: string | null): boolean {
  return host !== null && /^(127\.|localhost\b|\[::1\])/iu.test(host);
}

function kindOf(raw: Dict, context: Context): string {
  const id = str(raw["id"]) ?? "";
  if (isDict(raw["account"])) return "subscription";
  if (/-plugin$/u.test(id)) return "plugin";
  if (context.presetKinds.get(str(raw["preset"]) ?? id) === "local" || isLoopbackHost(str(raw["host"]))) return "local";
  return "key";
}

export function normalizeProvider(raw: Dict, context: Context): Dict {
  const id = str(raw["id"]) ?? "";
  const keys = dicts(raw["keyList"]).map((key) => ({
    id: str(key["id"]) ?? "", label: str(key["name"]) ?? str(key["masked"]) ?? "", masked: str(key["masked"]) ?? "", enabled: key["on"] === true,
  }));
  return {
    id, name: str(raw["name"]) ?? id, kind: kindOf(raw, context), enabled: raw["off"] !== true,
    baseUrl: str(raw["chat"]) ?? str(raw["responses"]) ?? str(raw["anthropic"]) ?? str(raw["gemini"]),
    protocol: protocolOf(raw), keys,
    models: num(raw["exposed"]) ?? (Array.isArray(raw["models"]) ? raw["models"].length : null),
    balance: context.balances.get(id) ?? null,
  };
}

export function normalizePreset(raw: Dict): Dict {
  const base = str(raw["chat"]) ?? str(raw["anthropic"]);
  return {
    id: str(raw["id"]) ?? "", name: str(raw["name"]) ?? str(raw["id"]) ?? "", protocol: protocolOf(raw),
    baseUrl: base, needsKey: str(raw["kind"]) !== "local",
  };
}

function contextOf(state: Dict, quotas: Dict[]): Context {
  const presetKinds = new Map<string, string>();
  for (const preset of dicts(state["presets"])) {
    const id = str(preset["id"]), kind = str(preset["kind"]);
    if (id !== null && kind !== null) presetKinds.set(id, kind);
  }
  const balances = new Map<string, string>();
  for (const quota of quotas) {
    const provider = str(quota["provider"]), balance = str(quota["balance"]);
    if (provider !== null && balance !== null && !balances.has(provider)) balances.set(provider, balance);
  }
  return { presetKinds, balances };
}

function windowsOf(value: unknown): Dict[] {
  return dicts(value).map((window) => ({
    name: str(window["name"]) ?? "",
    usedPercent: window["text"] === true || window["unlimited"] === true ? null : num(window["used"]),
    resetsAt: str(window["resetsAt"]),
  }));
}

export function normalizeQuota(raw: Dict): Dict {
  return {
    provider: str(raw["provider"]) ?? "", account: str(raw["user"]) ?? str(raw["name"]) ?? "",
    plan: str(raw["plan"]), windows: windowsOf(raw["windows"]),
  };
}

function quotaWindows(quotas: Dict[], agent: string, user: string): Dict[] {
  const hit = quotas.find((quota) => quota["provider"] === agent && (quota["user"] === user || quota["name"] === user));
  return hit === undefined ? [] : windowsOf(hit["windows"]);
}

/** Subscription accounts: each provider's remembered sign-ins, or the one it is signed in to. */
export function normalizeAccounts(providers: Dict[], quotas: Dict[]): Dict[] {
  const seen = new Set<string>();
  const accounts: Dict[] = [];
  for (const raw of providers) {
    const account = dict(raw["account"]);
    const agent = str(account["agent"]);
    if (agent === null) continue;
    const logins = dicts(account["logins"]);
    const rows = logins.length > 0 ? logins : [{ agent, user: account["user"], plan: account["plan"], active: true, on: raw["off"] !== true }];
    for (const row of rows) {
      const user = str(row["user"]) ?? "";
      const id = `${agent}:${user}`;
      if (seen.has(id)) continue;
      seen.add(id);
      accounts.push({
        id, agent, provider: str(raw["id"]) ?? agent, label: user, plan: str(row["plan"]),
        enabled: row["on"] === true, active: row["active"] === true, windows: quotaWindows(quotas, agent, user),
      });
    }
  }
  return accounts;
}

export function normalizeGroup(raw: Dict): Dict {
  const id = str(raw["id"]) ?? "";
  const routing = str(raw["routing"]);
  return {
    id, name: str(raw["name"]) ?? id, mode: routing ?? "smart", enabled: raw["disabled"] !== true,
    members: list(raw["members"]).filter((item): item is string => typeof item === "string").map((model) => ({ model, account: null })),
  };
}

export function normalizeSignIn(raw: Dict): Dict {
  return {
    id: str(raw["id"]) ?? "", agent: str(raw["agent"]) ?? "", state: str(raw["state"]) ?? "failed",
    url: str(raw["url"]), code: str(raw["code"]),
    pasteCallback: raw["pasteCallback"] === true || raw["pasteCode"] === true, error: str(raw["error"]),
  };
}

function totalsOf(group: Dict): Dict {
  const cost = num(group["cost"]) ?? 0;
  const unknown = (num(group["unpriced"]) ?? 0) > 0 && cost === 0;
  return {
    requests: num(group["calls"]) ?? 0, inputTokens: num(group["input"]) ?? 0, outputTokens: num(group["output"]) ?? 0,
    cost: unknown ? null : cost, currency: unknown ? null : "USD",
  };
}

export function normalizeUsage(raw: Dict, period: string): Dict {
  return {
    period: str(raw["period"]) ?? period,
    totals: totalsOf(raw),
    byModel: dicts(raw["models"]).map((group) => ({
      model: str(group["provider"]) !== null && str(group["model"]) !== null ? `${str(group["provider"])}/${str(group["model"])}` : str(group["id"]) ?? "",
      ...totalsOf(group),
    })),
    byAccount: dicts(raw["accounts"]).map((group) => ({ account: str(group["account"]) ?? str(group["name"]) ?? str(group["id"]) ?? "", ...totalsOf(group) })),
  };
}

function groupSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9.]+/gu, "-").replace(/^-+|-+$/gu, "");
}

function splitAccountId(id: string): { agent: string; user: string } | null {
  const cut = id.indexOf(":");
  return cut > 0 ? { agent: id.slice(0, cut), user: id.slice(cut + 1) } : null;
}

// ---- the adapter ----

export interface MagpieOptions {
  stateDir: string;
  /** The user has not disabled the plugin. */
  enabled(): boolean;
  /** The package is still installed. */
  installed?(): boolean;
  env?: NodeJS.ProcessEnv;
  /** The directory holding the magpie program; defaults to the package's `assets`. */
  assets?: string;
}

export function createMagpie(options: MagpieOptions) {
  const layout = magpieLayout(options.stateDir, options.env ?? process.env, options.assets);
  const supervisor = new Supervisor(layout);
  const store = new ModelStore(layout);
  const available = (): boolean => options.enabled() && (options.installed?.() ?? true);

  const ensure = async (): Promise<void> => {
    if (!available()) throw new MagpieError(403, "magpie 插件已停用");
    await supervisor.ensure();
  };
  const web = async (method: string, path: string, body?: unknown, timeoutMs?: number): Promise<Dict> => {
    await ensure();
    return dict(await webCall(supervisor.endpoint, method, path, body, timeoutMs));
  };
  const gateway = async (path: string, timeoutMs?: number): Promise<Dict> => {
    await ensure();
    return dict(await gatewayGet(supervisor.endpoint, path, timeoutMs));
  };

  const readModels = async (ensureFirst: boolean): Promise<Model[]> => {
    if (ensureFirst) await ensure();
    const models = modelsFromGateway(await gatewayGet(supervisor.endpoint, "/v1/models"));
    store.set(models);
    return models;
  };
  supervisor.onReady = () => { void readModels(false).catch(() => undefined); };

  const quotasRaw = async (timeoutMs?: number): Promise<Dict[]> => dicts((await gateway("/v1/magpie/quotas", timeoutMs))["data"]);
  const quotasSoft = (timeoutMs: number): Promise<Dict[]> => quotasRaw(timeoutMs).catch(() => []);
  const state = (): Promise<Dict> => web("GET", "/api/providers");

  const providerView = (raw: Dict, full: Dict, quotas: Dict[]): Dict => normalizeProvider(raw, contextOf(full, quotas));
  const findProvider = (full: Dict, id: string): Dict | null => dicts(full["providers"]).find((row) => row["id"] === id) ?? null;
  const requireProvider = async (id: string): Promise<Dict> => {
    const found = findProvider(await state(), id);
    if (found === null) throw new MagpieError(404, "没有这个供应商");
    return found;
  };
  const afterChange = async (id: string, full: Dict): Promise<Dict> => {
    const raw = findProvider(full, id);
    return { provider: raw === null ? null : providerView(raw, full, await quotasSoft(8000)) };
  };
  const missing = (error: unknown, message: string): never => {
    if (error instanceof MagpieError && error.upstream === 404) throw new MagpieError(404, message);
    throw error;
  };

  const groupsRaw = async (): Promise<Dict[]> => dicts((await web("GET", "/api/groups"))["groups"]);
  const groupFrom = (full: Dict, id: string): Dict => {
    const raw = dicts(full["groups"]).find((row) => row["id"] === id);
    if (raw === undefined) throw new MagpieError(502, "magpie 没有返回这个路由组");
    return normalizeGroup(raw);
  };

  const signinOf = async (id: string): Promise<Dict | null> => {
    try { return normalizeSignIn(dict(await web("GET", `/api/signin/${encodeURIComponent(id)}`))); }
    catch (error) { if (error instanceof MagpieError && error.upstream === 404) return null; throw error; }
  };

  const status = async (): Promise<Dict> => { await supervisor.peek(); return { ...supervisor.status() }; };

  const service: MagpieService = {
    status,
    start: async () => { await ensure(); return status(); },
    stop: async () => { await supervisor.stop(); return status(); },
    restart: async () => { await ensure(); await supervisor.restart(); return status(); },
    settings: async (accountDiscovery) => {
      if (accountDiscovery !== undefined) await supervisor.setAccountDiscovery(accountDiscovery);
      return status();
    },
    console: async () => {
      await ensure();
      const { webPort, webKey } = supervisor.endpoint;
      return { url: `http://127.0.0.1:${webPort}/?k=${webKey}` };
    },
    overview: async () => {
      const [full, models, groups, quotas, usage] = await Promise.all([
        state(), readModels(true), groupsRaw(), quotasSoft(8000),
        gateway("/v1/magpie/usage?period=today").then((raw) => normalizeUsage(raw, "today")["totals"] as Dict).catch(() => null),
      ]);
      const providers = dicts(full["providers"]);
      const keys = providers.filter((row) => !isDict(row["account"])).reduce((sum, row) => sum + dicts(row["keyList"]).length, 0);
      return {
        status: await status(),
        counts: { providers: providers.length, keys, accounts: normalizeAccounts(providers, quotas).length, models: models.length, groups: groups.length },
        quotas: quotas.map(normalizeQuota), usage,
      };
    },
    providers: async () => {
      const [full, quotas] = await Promise.all([state(), quotasSoft(8000)]);
      const context = contextOf(full, quotas);
      return { providers: dicts(full["providers"]).map((raw) => normalizeProvider(raw, context)) };
    },
    presets: async () => ({ presets: dicts((await state())["presets"]).map(normalizePreset) }),
    addProvider: async (input: ProviderInput) => {
      const before = new Set(dicts((await state())["providers"]).map((row) => row["id"]));
      const payload: Dict = { new: true };
      if (input.preset !== undefined) payload["preset"] = input.preset;
      if (input.name !== undefined) payload["name"] = input.name;
      if (input.apiKey !== undefined) payload["key"] = input.apiKey;
      if (input.baseUrl !== undefined) payload[input.protocol === "anthropic" ? "anthropic" : input.protocol === "gemini" ? "gemini" : "chat"] = input.baseUrl;
      const full = await web("POST", "/api/provider/save", payload, SLOW_MS);
      const fresh = dicts(full["providers"]).find((row) => !before.has(row["id"]));
      if (fresh === undefined) throw new MagpieError(502, "magpie 没有返回新的供应商");
      void readModels(false).catch(() => undefined);
      return { provider: providerView(fresh, full, await quotasSoft(8000)) };
    },
    providerAction: async (id: string, action: ProviderAction) => {
      await requireProvider(id);
      if (action === "test") {
        const answer = await web("POST", "/api/provider/test", { id }, SLOW_MS);
        const results = dicts(answer["results"]);
        const failed = results.find((row) => row["ok"] !== true);
        const message = results.length === 0 ? "没有可检测的接口" : failed === undefined ? `${results.length} 项检测通过` : str(failed["error"]) ?? "检测未通过";
        const raw = answer["provider"];
        return { ok: results.length > 0 && failed === undefined, provider: isDict(raw) ? providerView(raw, {}, []) : null, message };
      }
      if (action === "refresh-models") {
        const answer = await web("POST", "/api/provider/models", { id }, SLOW_MS);
        void readModels(false).catch(() => undefined);
        const raw = answer["provider"];
        return { ok: true, provider: isDict(raw) ? providerView(raw, {}, []) : null, message: `${num(answer["count"]) ?? 0} 个模型` };
      }
      const path = action === "enable" ? "on" : action === "disable" ? "off" : "delete";
      const full = await web("POST", `/api/provider/${path}`, { id });
      void readModels(false).catch(() => undefined);
      return { ok: true, ...await afterChange(id, full) };
    },
    addKey: async (id: string, apiKey: string, label: string | undefined) => {
      await requireProvider(id);
      const full = await web("POST", "/api/keys/add", { id, key: apiKey, name: label ?? "" }, SLOW_MS);
      return afterChange(id, full);
    },
    removeKey: async (id: string, keyId: string) => {
      const raw = await requireProvider(id);
      if (!dicts(raw["keyList"]).some((key) => key["id"] === keyId)) throw new MagpieError(404, "没有这个密钥");
      return afterChange(id, await web("POST", "/api/keys/remove", { id, ref: keyId }));
    },
    accounts: async () => {
      const [full, quotas] = await Promise.all([state(), quotasSoft(8000)]);
      return { accounts: normalizeAccounts(dicts(full["providers"]), quotas), discovery: supervisor.accountDiscovery };
    },
    accountAction: async (id: string, action) => {
      const who = splitAccountId(id);
      const current = normalizeAccounts(dicts((await state())["providers"]), []);
      if (who === null || !current.some((row) => row["id"] === id)) throw new MagpieError(404, "没有这个账号");
      const verb = action === "enable" ? "on" : action === "disable" ? "off" : action;
      const full = await web("POST", `/api/login/${verb}`, { agent: who.agent, user: who.user }, SLOW_MS);
      return { accounts: normalizeAccounts(dicts(full["providers"]), await quotasSoft(8000)) };
    },
    signinAgents: async () => { await ensure(); return { agents: SIGNIN_AGENTS }; },
    signinStart: async (agent: string) => {
      if (!SIGNIN_AGENTS.some((row) => row.id === agent)) throw new MagpieError(400, "不支持的登录对象");
      return normalizeSignIn(await web("POST", "/api/signin", { agent, linkOnly: true }, SLOW_MS));
    },
    signinStatus: async (id: string) => (await signinOf(id)) ?? missing(new MagpieError(502, "", null, 404), "没有这个登录会话"),
    signinCancel: async (id: string) => {
      const before = await signinOf(id);
      if (before === null) throw new MagpieError(404, "没有这个登录会话");
      await web("POST", `/api/signin/${encodeURIComponent(id)}/cancel`, {});
      return (await signinOf(id)) ?? { ...before, state: "canceled" };
    },
    signinCallback: async (id: string, url: string) => {
      try { await web("POST", `/api/signin/${encodeURIComponent(id)}/callback`, { url }); }
      catch (error) { missing(error, "没有这个登录会话"); }
      return (await signinOf(id)) ?? missing(new MagpieError(502, "", null, 404), "没有这个登录会话");
    },
    quotas: async () => ({ quotas: (await quotasRaw()).map(normalizeQuota) }),
    groups: async () => ({ groups: (await groupsRaw()).map(normalizeGroup) }),
    createGroup: async (input: GroupInput) => {
      const taken = new Set((await groupsRaw()).map((row) => row["id"]));
      let id = groupSlug(input.name ?? "") || `g-${randomBytes(3).toString("hex")}`;
      for (let n = 2; taken.has(id); n += 1) id = `${groupSlug(input.name ?? "") || "group"}-${n}`;
      const body = { id, name: input.name, members: input.members, routing: input.mode === "smart" ? "" : input.mode };
      const full = await web("POST", "/api/groups/save", body);
      if (input.enabled === false) await web("POST", "/api/groups/switch", { id, on: false });
      return { group: groupFrom(input.enabled === false ? await web("GET", "/api/groups") : full, id) };
    },
    updateGroup: async (id: string, input: GroupInput) => {
      const raw = (await groupsRaw()).find((row) => row["id"] === id);
      if (raw === undefined) throw new MagpieError(404, "没有这个路由组");
      const body: Dict = { ...raw };
      for (const field of DERIVED_GROUP_FIELDS) delete body[field];
      if (input.name !== undefined) body["name"] = input.name;
      if (input.mode !== undefined) body["routing"] = input.mode === "smart" ? "" : input.mode;
      if (input.members !== undefined) body["members"] = input.members;
      await web("POST", "/api/groups/save", body);
      if (input.enabled !== undefined && input.enabled !== (raw["disabled"] !== true)) await web("POST", "/api/groups/switch", { id, on: input.enabled });
      return { group: groupFrom(await web("GET", "/api/groups"), id) };
    },
    deleteGroup: async (id: string) => {
      if (!(await groupsRaw()).some((row) => row["id"] === id)) throw new MagpieError(404, "没有这个路由组");
      await web("POST", "/api/groups/delete", { id });
      return { ok: true };
    },
    models: async () => ({ models: await readModels(true) }),
    usage: async (period: Period) => normalizeUsage(await gateway(`/v1/magpie/usage?period=${period}`), period),
  };

  const profiles = createProfiles(store, { layout, available, gateway: { ensure, get gatewayUrl() { return supervisor.gatewayUrl; } } });
  const http = createMagpieHttp({ enabled: available, service });
  return { supervisor, http, profiles, available, close(): Promise<void> { return supervisor.stop(); } };
}
