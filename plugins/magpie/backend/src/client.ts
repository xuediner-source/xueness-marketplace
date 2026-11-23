/**
 * Small typed fetch helpers for magpie's two loopback listeners: the web app
 * API (cookie `magpie_web_<port>`, never an `Origin`, which its cross-origin
 * guard refuses) and the gateway's read routes.
 *
 * Every non-2xx answer becomes a `MagpieError` carrying the status and a short
 * detail; the HTTP layer turns it into the contract's 502.
 */
import { connect } from "node:net";

const TIMEOUT_MS = 15_000;
const HOST = "127.0.0.1";

type Dict = Record<string, unknown>;

export class MagpieError extends Error {
  readonly status: number;
  readonly detail: string | null;
  /** The status magpie answered, when it answered at all. */
  readonly upstream: number | null;

  constructor(status: number, message: string, detail: string | null = null, upstream: number | null = null) {
    super(message);
    this.name = "MagpieError";
    this.status = status;
    this.detail = detail;
    this.upstream = upstream;
  }
}

/** Where a running magpie listens and the key its web app expects. */
export interface Endpoint {
  readonly gatewayPort: number;
  readonly webPort: number;
  readonly webKey: string;
}

export function isDict(value: unknown): value is Dict {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** magpie's `{"error": "..."}` body, or the first line of whatever else it said. */
function shortDetail(text: string): string {
  try {
    const value: unknown = JSON.parse(text);
    if (isDict(value) && typeof value["error"] === "string") return value["error"].slice(0, 400);
  } catch { /* not JSON */ }
  return text.replace(/\s+/gu, " ").trim().slice(0, 400);
}

async function send(url: string, init: RequestInit, timeoutMs: number): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new MagpieError(502, "无法连接 magpie", reason.slice(0, 200));
  }
  const text = await response.text();
  if (!response.ok) throw new MagpieError(502, "magpie 拒绝了请求", shortDetail(text) || `HTTP ${response.status}`, response.status);
  if (text === "") return null;
  try { return JSON.parse(text) as unknown; } catch { return null; }
}

/** One call to the web app API; a body makes it JSON. */
export function webCall(endpoint: Endpoint, method: string, path: string, body?: unknown, timeoutMs = TIMEOUT_MS): Promise<unknown> {
  const headers: Record<string, string> = { Cookie: `magpie_web_${endpoint.webPort}=${endpoint.webKey}` };
  const init: RequestInit = { method, headers };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  return send(`http://${HOST}:${endpoint.webPort}${path}`, init, timeoutMs);
}

/** A read route of the gateway (loopback, no key). */
export function gatewayGet(endpoint: Endpoint, path: string, timeoutMs = TIMEOUT_MS): Promise<unknown> {
  return send(`http://${HOST}:${endpoint.gatewayPort}${path}`, { method: "GET" }, timeoutMs);
}

export interface Health {
  readonly version: string | null;
  readonly pid: number | null;
}

/** The gateway's root answer when it names itself magpie, else null. */
export async function probeGateway(port: number, timeoutMs = 2000): Promise<Health | null> {
  try {
    const response = await fetch(`http://${HOST}:${port}/`, { signal: AbortSignal.timeout(timeoutMs) });
    const value: unknown = await response.json();
    if (!isDict(value) || value["name"] !== "magpie") return null;
    const pid = value["pid"];
    return {
      version: typeof value["version"] === "string" ? value["version"] : null,
      pid: typeof pid === "number" && Number.isInteger(pid) ? pid : null,
    };
  } catch { return null; }
}

/** True when the web API answers 200 to our cookie: proves the instance is ours. */
export async function probeWeb(endpoint: Endpoint, timeoutMs = 3000): Promise<boolean> {
  try {
    const response = await fetch(`http://${HOST}:${endpoint.webPort}/api/omarchy`, {
      headers: { Cookie: `magpie_web_${endpoint.webPort}=${endpoint.webKey}` }, signal: AbortSignal.timeout(timeoutMs),
    });
    await response.arrayBuffer();
    return response.status === 200;
  } catch { return false; }
}

/** True when something accepts connections on the port. */
export function portBusy(port: number, timeoutMs = 1000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ host: HOST, port });
    const done = (busy: boolean): void => { socket.destroy(); resolve(busy); };
    socket.setTimeout(timeoutMs, () => done(false));
    socket.once("connect", () => done(true));
    socket.once("error", () => done(false));
  });
}
