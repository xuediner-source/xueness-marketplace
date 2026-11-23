/**
 * The plugin-owned magpie instance: a private directory under the state root
 * holding magpie's configuration (`XDG_CONFIG_HOME`), its cache
 * (`XDG_CACHE_HOME`), the persisted identity of this instance and the last
 * model list.
 *
 * Nothing here ever points at the user's own magpie, Claude Code or Codex
 * folders: magpie only sees the directories below `<stateDir>/magpie`.
 */
import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { profileIdFor, type Model } from "./models.ts";

const DEFAULT_GATEWAY_PORT = 43425;
const DEFAULT_WEB_PORT = 43430;
const RUNTIME_FILE = "runtime.json";
const MODELS_FILE = "models.json";
const KEY_PATTERN = /^[A-Za-z0-9._~-]{16,128}$/u;

export interface Layout {
  /** `<stateDir>/magpie`: everything this plugin keeps. */
  readonly root: string;
  /** `XDG_CONFIG_HOME` for magpie (its data lives in `<config>/magpie`). */
  readonly config: string;
  /** `XDG_CACHE_HOME` for magpie. */
  readonly cache: string;
  /** The bundled program, its licence and `upstream.json`. */
  readonly assets: string;
  /** The bundled magpie program (`magpie.exe` on Windows). */
  readonly binary: string;
  readonly env: NodeJS.ProcessEnv;
}

export function magpieLayout(stateDir: string, env: NodeJS.ProcessEnv = process.env, assets?: string): Layout {
  const root = join(stateDir, "magpie");
  const assetDir = assets ?? resolve(import.meta.dirname, "..", "assets");
  const binary = join(assetDir, process.platform === "win32" ? "magpie.exe" : "magpie");
  return { root, config: join(root, "config"), cache: join(root, "cache"), assets: assetDir, binary, env };
}

export interface Runtime {
  readonly apiVersion: 1;
  readonly gatewayPort: number;
  readonly webPort: number;
  readonly webKey: string;
  readonly accountDiscovery: boolean;
}

function port(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 1024 && value <= 65535 ? value : null;
}

function configuredPort(raw: string | undefined, fallback: number): number {
  return port(Number.parseInt(raw ?? "", 10)) ?? fallback;
}

function freshRuntime(env: NodeJS.ProcessEnv): Runtime {
  return {
    apiVersion: 1,
    gatewayPort: configuredPort(env["XUENESS_MAGPIE_PORT"], DEFAULT_GATEWAY_PORT),
    webPort: configuredPort(env["XUENESS_MAGPIE_WEB_PORT"], DEFAULT_WEB_PORT),
    webKey: randomBytes(16).toString("hex"),
    accountDiscovery: true,
  };
}

/** The persisted identity of this instance, or a fresh one on first run or after a corrupt file. */
export function readRuntime(layout: Layout): Runtime {
  try {
    const value = JSON.parse(readFileSync(join(layout.root, RUNTIME_FILE), "utf8")) as Record<string, unknown>;
    const gatewayPort = port(value["gatewayPort"]);
    const webPort = port(value["webPort"]);
    const webKey = value["webKey"];
    if (gatewayPort !== null && webPort !== null && gatewayPort !== webPort
      && typeof webKey === "string" && KEY_PATTERN.test(webKey)) {
      return { apiVersion: 1, gatewayPort, webPort, webKey, accountDiscovery: value["accountDiscovery"] !== false };
    }
  } catch { /* first run, or a corrupt file: start from a fresh identity */ }
  return freshRuntime(layout.env);
}

function writeAtomic(path: string, text: string): void {
  writeFileSync(`${path}.tmp`, text, { encoding: "utf8", mode: 0o600 });
  renameSync(`${path}.tmp`, path);
}

export function ensureLayout(layout: Layout): void {
  for (const dir of [layout.root, layout.config, layout.cache]) mkdirSync(dir, { recursive: true, mode: 0o700 });
}

export function writeRuntime(layout: Layout, runtime: Runtime): void {
  ensureLayout(layout);
  writeAtomic(join(layout.root, RUNTIME_FILE), `${JSON.stringify(runtime, null, 2)}\n`);
}

/** The version pinned in `upstream.json`, which the packaging step copies next to the program. */
export function bundledVersion(layout: Layout): string {
  try {
    const value = JSON.parse(readFileSync(join(layout.assets, "upstream.json"), "utf8")) as Record<string, unknown>;
    return typeof value["version"] === "string" ? value["version"] : "unknown";
  } catch { return "unknown"; }
}

/** The last model list magpie answered, or an empty list when none was kept. */
export function readModelsCache(layout: Layout): Model[] {
  try {
    const value = JSON.parse(readFileSync(join(layout.root, MODELS_FILE), "utf8")) as Record<string, unknown>;
    const rows = value["models"];
    // Older caches predate `profileId`; it is always derived from the real id.
    return Array.isArray(rows) ? rows.filter(isModel).map((row) => ({ ...row, profileId: profileIdFor(row.id) })) : [];
  } catch { return []; }
}

export function writeModelsCache(layout: Layout, models: readonly Model[]): void {
  ensureLayout(layout);
  writeAtomic(join(layout.root, MODELS_FILE), `${JSON.stringify({ updatedAt: new Date().toISOString(), models }, null, 2)}\n`);
}

function isModel(value: unknown): value is Model {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<string, unknown>;
  return typeof row["id"] === "string" && typeof row["name"] === "string" && typeof row["group"] === "boolean";
}
