/**
 * Typed calls to the Xueness adapter routes the panel uses (see plugins/magpie/README.md). Managing providers,
 * keys, accounts and routing groups happens in magpie's own console, which the panel embeds.
 */
import { get, post } from "@xueness/host";

const BASE = "/api/magpie";

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
/** `profileId` is the composer id to select ("use in conversation"); `id` is magpie's own model id. */
export type Model = { id: string; name: string; provider: string | null; group: boolean; contextWindow: number | null; profileId: string };

type Signal = AbortSignal | undefined;

export const getStatus = (s?: Signal) => get<Status>(`${BASE}/status`, s);
export const startMagpie = (s?: Signal) => post<Status>(`${BASE}/start`, {}, s);
export const stopMagpie = (s?: Signal) => post<Status>(`${BASE}/stop`, {}, s);
export const restartMagpie = (s?: Signal) => post<Status>(`${BASE}/restart`, {}, s);
export const saveSettings = (accountDiscovery: boolean, s?: Signal) => post<Status>(`${BASE}/settings`, { accountDiscovery }, s);
/** magpie's own web console address (with its page key); starts magpie when it is stopped. */
export const getConsole = (s?: Signal) => get<{ url: string }>(`${BASE}/console`, s);
/** The models magpie offers; also refreshes the list the composer shows. */
export const getModels = (s?: Signal) => get<{ models: Model[] }>(`${BASE}/models`, s);
