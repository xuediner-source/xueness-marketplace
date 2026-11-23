/** Typed calls to the Xueness adapter routes of the magpie plugin (see plugins/magpie/README.md). */
import { del, get, post } from "@xueness/host";

const BASE = "/api/magpie";
const enc = encodeURIComponent;

export type Status = {
  state: "stopped" | "starting" | "running" | "stopping" | "failed";
  version: string | null;
  bundledVersion: string;
  gatewayUrl: string;
  pid: number | null;
  startedAt: string | null;
  accountDiscovery: boolean;
  error: string | null;
  log: string[];
};
export type QuotaWindow = { name: string; usedPercent: number | null; resetsAt: string | null };
export type Quota = { provider: string; account: string; plan: string | null; windows: QuotaWindow[] };
export type UsageTotals = { requests: number; inputTokens: number; outputTokens: number; cost: number | null; currency: string | null };
export type Overview = {
  status: Status;
  counts: { providers: number; keys: number; accounts: number; models: number; groups: number };
  quotas: Quota[];
  usage: UsageTotals | null;
};
export type ProviderKey = { id: string; label: string; masked: string; enabled: boolean };
export type Provider = {
  id: string; name: string;
  kind: "key" | "subscription" | "local" | "plugin";
  enabled: boolean;
  baseUrl: string | null; protocol: string | null;
  keys: ProviderKey[];
  models: number | null;
  balance: string | null;
};
export type Preset = { id: string; name: string; protocol: string | null; baseUrl: string | null; needsKey: boolean };
export type Protocol = "openai" | "anthropic" | "gemini";
export type NewProvider = { preset?: string; name?: string; baseUrl?: string; protocol?: Protocol; apiKey?: string };
export type ProviderAction = "enable" | "disable" | "delete" | "test" | "refresh-models";
export type ProviderActionResult = { ok: true; provider: Provider | null; message?: string };
export type Account = {
  id: string; agent: string; provider: string; label: string;
  plan: string | null; enabled: boolean; active: boolean;
  windows: QuotaWindow[];
};
export type AccountAction = "enable" | "disable" | "forget" | "switch";
export type SignIn = {
  id: string; agent: string;
  state: "installing" | "waiting" | "done" | "failed" | "canceled";
  url: string | null; code: string | null;
  pasteCallback: boolean;
  error: string | null;
};
export type GroupMode = "smart" | "order" | "rotate" | "usage" | "pace";
export type Group = { id: string; name: string; mode: GroupMode; enabled: boolean; members: { model: string; account: string | null }[] };
export type GroupInput = { name?: string; mode?: GroupMode; members?: string[]; enabled?: boolean };
/** `profileId` is the composer id to select ("use in conversation"); `id` is magpie's own model id. */
export type Model = { id: string; name: string; provider: string | null; group: boolean; contextWindow: number | null; profileId: string };
export type UsageReport = {
  period: string;
  totals: UsageTotals;
  byModel: (UsageTotals & { model: string })[];
  byAccount: (UsageTotals & { account: string })[];
};
export type Period = "today" | "week" | "month";

type Signal = AbortSignal | undefined;

export const getStatus = (s?: Signal) => get<Status>(`${BASE}/status`, s);
export const startMagpie = (s?: Signal) => post<Status>(`${BASE}/start`, {}, s);
export const stopMagpie = (s?: Signal) => post<Status>(`${BASE}/stop`, {}, s);
export const restartMagpie = (s?: Signal) => post<Status>(`${BASE}/restart`, {}, s);
export const saveSettings = (accountDiscovery: boolean, s?: Signal) => post<Status>(`${BASE}/settings`, { accountDiscovery }, s);
export const getConsole = (s?: Signal) => get<{ url: string }>(`${BASE}/console`, s);

export const getOverview = (s?: Signal) => get<Overview>(`${BASE}/overview`, s);

export const getProviders = (s?: Signal) => get<{ providers: Provider[] }>(`${BASE}/providers`, s);
export const getPresets = (s?: Signal) => get<{ presets: Preset[] }>(`${BASE}/presets`, s);
export const addProvider = (body: NewProvider, s?: Signal) => post<{ provider: Provider }>(`${BASE}/providers`, body, s);
export const providerAction = (id: string, action: ProviderAction, s?: Signal) =>
  post<ProviderActionResult>(`${BASE}/providers/${enc(id)}/${action}`, {}, s);
export const addKey = (id: string, apiKey: string, label: string | undefined, s?: Signal) =>
  post<{ provider: Provider }>(`${BASE}/providers/${enc(id)}/keys`, label ? { apiKey, label } : { apiKey }, s);
export const removeKey = (id: string, keyId: string, s?: Signal) =>
  del<{ provider: Provider }>(`${BASE}/providers/${enc(id)}/keys/${enc(keyId)}`, s);

export const getAccounts = (s?: Signal) => get<{ accounts: Account[]; discovery: boolean }>(`${BASE}/accounts`, s);
export const accountAction = (id: string, action: AccountAction, s?: Signal) =>
  post<{ accounts: Account[] }>(`${BASE}/accounts/${enc(id)}/${action}`, {}, s);
export const getAgents = (s?: Signal) => get<{ agents: { id: string; name: string }[] }>(`${BASE}/signin/agents`, s);
export const startSignIn = (agent: string, s?: Signal) => post<SignIn>(`${BASE}/signin`, { agent }, s);
export const getSignIn = (id: string, s?: Signal) => get<SignIn>(`${BASE}/signin/${enc(id)}`, s);
export const cancelSignIn = (id: string, s?: Signal) => post<SignIn>(`${BASE}/signin/${enc(id)}/cancel`, {}, s);
export const signInCallback = (id: string, url: string, s?: Signal) => post<SignIn>(`${BASE}/signin/${enc(id)}/callback`, { url }, s);

export const getGroups = (s?: Signal) => get<{ groups: Group[] }>(`${BASE}/groups`, s);
export const createGroup = (body: { name: string; mode: GroupMode; members: string[] }, s?: Signal) => post<{ group: Group }>(`${BASE}/groups`, body, s);
export const updateGroup = (id: string, body: GroupInput, s?: Signal) => post<{ group: Group }>(`${BASE}/groups/${enc(id)}`, body, s);
export const deleteGroup = (id: string, s?: Signal) => del<{ ok: true }>(`${BASE}/groups/${enc(id)}`, s);

export const getModels = (s?: Signal) => get<{ models: Model[] }>(`${BASE}/models`, s);
export const getUsage = (period: Period, s?: Signal) => get<UsageReport>(`${BASE}/usage?period=${period}`, s);
