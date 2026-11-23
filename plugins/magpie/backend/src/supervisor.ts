/**
 * The plugin-owned magpie process: `magpie serve --web=127.0.0.1:<webPort>`
 * runs the gateway and the full web app API in one foreground process.
 *
 * `ensure()` starts it once (concurrent callers share one attempt), adopts an
 * instance an earlier Xueness run left behind, and moves to the next port pair
 * when a foreign listener holds the configured one. Readiness is two facts:
 * the gateway's root answers `name: "magpie"`, and the web API answers 200 to
 * our private cookie. The second proves the instance is ours.
 */
import { execFile, spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { bundledVersion, ensureLayout, readRuntime, writeRuntime, type Layout, type Runtime } from "./layout.ts";
import { portBusy, probeGateway, probeWeb, webCall, type Endpoint } from "./client.ts";

const READY_TIMEOUT_MS = 60_000;
const POLL_MS = 250;
const PORT_ATTEMPTS = 3;
const QUIT_WAIT_MS = 10_000;
const LOG_LINES = 40;
const SETTINGS_TIMEOUT_MS = 15_000;
/** Self-update stays off: the bundled version is the one the package pins. */
const FIRST_START_SETTINGS: readonly (readonly [string, string])[] = [["noAutoUpdate", "on"], ["noAutoDownload", "on"]];

export type ProcessState = "stopped" | "starting" | "running" | "stopping" | "failed";

export interface ProcessStatus {
  state: ProcessState;
  version: string | null;
  bundledVersion: string;
  gatewayUrl: string;
  pid: number | null;
  startedAt: string | null;
  accountDiscovery: boolean;
  error: string | null;
  log: string[];
}

export class MagpieStartError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MagpieStartError";
  }
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => { setTimeout(resolve, ms).unref(); });

/** Anything that looks like a key or token never reaches the log buffer. */
export function redact(line: string, webKey = ""): string {
  let text = webKey !== "" ? line.split(webKey).join("[redacted]") : line;
  text = text.replace(/\b(?:sk|pk|ak|rk)-[A-Za-z0-9._-]{8,}/gu, "[redacted]");
  text = text.replace(/(Bearer\s+)[A-Za-z0-9._~+/=-]{8,}/giu, "$1[redacted]");
  text = text.replace(/([?&]k=)[^\s&]+/gu, "$1[redacted]");
  text = text.replace(/((?:api[_-]?key|token|secret|authorization|password)["']?\s*[:=]\s*["']?)[^\s"',;]{6,}/giu, "$1[redacted]");
  return text.replace(/[A-Za-z0-9_-]{32,}/gu, "[redacted]");
}

export class Supervisor {
  readonly layout: Layout;
  /** Called after each successful start or adoption. */
  onReady: (() => void) | null = null;
  /** Not `#private`: handoff clones copy own properties onto a fresh prototype. */
  private runtime: Runtime;
  private child: ChildProcess | null = null;
  private adoptedPid: number | null = null;
  private state: ProcessState = "stopped";
  private ready = false;
  private starting: Promise<void> | null = null;
  private stopping: Promise<void> | null = null;
  private startedAt: string | null = null;
  private error: string | null = null;
  private version: string | null = null;
  private log: string[] = [];

  constructor(layout: Layout) {
    this.layout = layout;
    this.runtime = readRuntime(layout);
  }

  get endpoint(): Endpoint {
    return { gatewayPort: this.runtime.gatewayPort, webPort: this.runtime.webPort, webKey: this.runtime.webKey };
  }

  /** The OpenAI-compatible base URL of the gateway, known before it starts. */
  get gatewayUrl(): string { return `http://127.0.0.1:${this.runtime.gatewayPort}/v1`; }

  get accountDiscovery(): boolean { return this.runtime.accountDiscovery; }

  private get alive(): boolean {
    if (this.child !== null) return this.child.exitCode === null && this.child.signalCode === null;
    return this.adoptedPid !== null;
  }

  status(): ProcessStatus {
    const pid = this.child?.pid ?? this.adoptedPid;
    return {
      state: this.state, version: this.state === "running" ? this.version : null, bundledVersion: bundledVersion(this.layout),
      gatewayUrl: this.gatewayUrl, pid: this.state === "running" || this.state === "starting" ? pid ?? null : null,
      startedAt: this.startedAt, accountDiscovery: this.runtime.accountDiscovery, error: this.error, log: [...this.log],
    };
  }

  /** Adopt a still-running instance of ours without starting anything. */
  async peek(): Promise<void> {
    if (this.starting || this.stopping || this.state === "running" || this.state === "starting") return;
    if (await this.adopt()) { this.state = "running"; this.ready = true; this.error = null; }
  }

  /** Start magpie if needed; concurrent callers share one attempt. */
  async ensure(): Promise<void> {
    if (this.stopping) await this.stopping;
    if (this.ready && this.alive) return;
    if (this.starting) return await this.starting;
    const attempt = this.begin();
    this.starting = attempt;
    try { await attempt; } finally { this.starting = null; }
  }

  async stop(): Promise<void> {
    if (this.starting) { try { await this.starting; } catch { /* a failed start leaves nothing to stop */ } }
    if (this.stopping) return await this.stopping;
    if (!this.alive) { this.ready = false; if (this.state !== "failed") this.state = "stopped"; return; }
    const attempt = this.halt();
    this.stopping = attempt;
    try { await attempt; } finally { this.stopping = null; }
  }

  async restart(): Promise<void> {
    await this.stop();
    await this.ensure();
  }

  /** Persist the sign-in discovery choice; a running magpie restarts to pick it up. */
  async setAccountDiscovery(value: boolean): Promise<void> {
    if (value === this.runtime.accountDiscovery) return;
    const wasRunning = this.alive;
    this.runtime = { ...this.runtime, accountDiscovery: value };
    writeRuntime(this.layout, this.runtime);
    if (wasRunning) await this.restart();
  }

  private async begin(): Promise<void> {
    this.state = "starting";
    this.error = null;
    try {
      await this.launch();
      this.state = "running";
      this.ready = true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.state = "failed";
      this.error = message;
      this.ready = false;
      await this.kill();
      throw error instanceof MagpieStartError ? error : new MagpieStartError(message);
    }
    try { this.onReady?.(); } catch { /* a failed background refresh never fails the start */ }
  }

  private async launch(): Promise<void> {
    if (!existsSync(this.layout.binary)) throw new MagpieStartError("内置的 magpie 程序缺失");
    ensureLayout(this.layout);
    if (await this.adopt()) return;
    const base = this.runtime;
    for (let index = 0; index < PORT_ATTEMPTS; index += 1) {
      const next: Runtime = { ...base, gatewayPort: base.gatewayPort + index, webPort: base.webPort + index };
      if (next.gatewayPort > 65535 || next.webPort > 65535) break;
      if (await portBusy(next.gatewayPort) || await portBusy(next.webPort)) { this.note(`ports ${next.gatewayPort}/${next.webPort} are taken`); continue; }
      this.runtime = next;
      await this.applySettings(next);
      const child = this.spawnServe(next);
      this.child = child;
      if (await this.waitReady(child, next)) {
        writeRuntime(this.layout, next);
        this.startedAt = new Date().toISOString();
        await this.afterReady();
        return;
      }
      await this.kill();
    }
    this.runtime = base;
    throw new MagpieStartError("magpie 没有在预期时间内启动");
  }

  /** A magpie of ours that outlived an earlier run: same ports, same key. */
  private async adopt(): Promise<boolean> {
    const health = await probeGateway(this.runtime.gatewayPort);
    if (health === null || !await probeWeb(this.endpoint)) return false;
    this.adoptedPid = health.pid;
    this.version = health.version;
    if (health.pid === null) this.adoptedPid = -1;
    return true;
  }

  private childEnv(runtime: Runtime): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = {};
    for (const [key, value] of Object.entries(this.layout.env)) {
      const upper = key.toUpperCase();
      if (upper.startsWith("MAGPIE_") || upper.startsWith("XDG_") || upper === "DO_NOT_TRACK") continue;
      if (value !== undefined) env[key] = value;
    }
    env["XDG_CONFIG_HOME"] = this.layout.config;
    env["XDG_CACHE_HOME"] = this.layout.cache;
    env["MAGPIE_ADDR"] = `127.0.0.1:${runtime.gatewayPort}`;
    env["MAGPIE_WEB_KEY"] = runtime.webKey;
    env["DO_NOT_TRACK"] = "1";
    env["MAGPIE_NO_STATS"] = "1";
    if (!runtime.accountDiscovery) env["MAGPIE_NO_ACCOUNTS"] = "1";
    return env;
  }

  /** `magpie settings set ...` with the instance's own environment, before `serve`; idempotent. */
  private async applySettings(runtime: Runtime): Promise<void> {
    const env = this.childEnv(runtime);
    for (const [key, value] of FIRST_START_SETTINGS) {
      await new Promise<void>((resolve) => {
        execFile(this.layout.binary, ["settings", "set", key, value], {
          cwd: this.layout.root, env, timeout: SETTINGS_TIMEOUT_MS, windowsHide: true,
        }, (error) => { if (error) this.note(`settings set ${key} failed: ${error.message}`); resolve(); });
      });
    }
  }

  private spawnServe(runtime: Runtime): ChildProcess {
    const child = spawn(this.layout.binary, ["serve", `--web=127.0.0.1:${runtime.webPort}`], {
      cwd: this.layout.root, env: this.childEnv(runtime), stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
    });
    const feed = (chunk: Buffer): void => { for (const line of chunk.toString("utf8").split(/\r?\n/u)) this.note(line); };
    child.stdout?.on("data", feed);
    child.stderr?.on("data", feed);
    child.on("error", (error) => { this.note(`process error: ${error.message}`); });
    child.on("exit", (code, signal) => { this.exited(child, code, signal); });
    return child;
  }

  private exited(child: ChildProcess, code: number | null, signal: NodeJS.Signals | null): void {
    if (this.child !== child) return;
    this.child = null;
    this.ready = false;
    if (this.state === "running") {
      this.state = "failed";
      this.error = `magpie 意外退出（${signal ?? `代码 ${code ?? "?"}`}）`;
    }
  }

  private async waitReady(child: ChildProcess, runtime: Runtime): Promise<boolean> {
    const deadline = Date.now() + READY_TIMEOUT_MS;
    const endpoint: Endpoint = { gatewayPort: runtime.gatewayPort, webPort: runtime.webPort, webKey: runtime.webKey };
    while (Date.now() < deadline) {
      if (child.exitCode !== null || child.signalCode !== null) return false;
      const health = await probeGateway(runtime.gatewayPort);
      if (health !== null) {
        if (health.pid !== null && child.pid !== undefined && health.pid !== child.pid) return false;
        if (await probeWeb(endpoint)) { this.version = health.version; return true; }
      }
      await sleep(POLL_MS);
    }
    return false;
  }

  /** Gateway mode keeps the web app to what a gateway needs; best effort and idempotent. */
  private async afterReady(): Promise<void> {
    try { await webCall(this.endpoint, "POST", "/api/settings/gateway-mode", { mode: "on" }, 5000); }
    catch (error) { this.note(`gateway mode not set: ${error instanceof Error ? error.message : String(error)}`); }
  }

  private async halt(): Promise<void> {
    this.state = "stopping";
    this.ready = false;
    try { await webCall(this.endpoint, "POST", "/api/window/quit?now=1", undefined, 3000); } catch { /* fall back to ending the process */ }
    if (!await this.gone(QUIT_WAIT_MS)) await this.kill();
    this.child = null;
    this.adoptedPid = null;
    this.startedAt = null;
    this.state = "stopped";
  }

  /** Wait for the process (or an adopted instance's gateway) to go away. */
  private async gone(timeoutMs: number): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (this.child !== null ? this.child.exitCode !== null || this.child.signalCode !== null : await probeGateway(this.runtime.gatewayPort, 500) === null) return true;
      await sleep(100);
    }
    return false;
  }

  /** End the process now: our child, or an adopted instance by its reported pid. */
  private async kill(): Promise<void> {
    const child = this.child;
    this.child = null;
    if (child !== null && child.exitCode === null && child.signalCode === null) {
      await new Promise<void>((resolve) => {
        child.once("exit", () => { resolve(); });
        try { child.kill(); } catch { resolve(); }
        setTimeout(resolve, 3000).unref();
      });
    } else if (this.adoptedPid !== null && this.adoptedPid > 0) {
      try { process.kill(this.adoptedPid); } catch { /* already gone */ }
    }
    this.adoptedPid = null;
  }

  private note(line: string): void {
    const clean = redact(line, this.runtime.webKey).trimEnd();
    if (clean === "") return;
    this.log.push(clean.slice(0, 400));
    if (this.log.length > LOG_LINES) this.log.splice(0, this.log.length - LOG_LINES);
  }
}
