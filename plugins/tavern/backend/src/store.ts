/**
 * Private Tavern data under `<state>/tavern/`: one JSON document per item in `<kind>/`, and the
 * Tavern-wide settings in `settings.json`. Nothing here is executed; every document is bounded.
 */
import { existsSync, lstatSync, mkdirSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { atomicWriteJson, isLink, protectPrivateDirectory, readJsonObject, validResourceId } from "@xueness/sessions";

export type TavernKind = "characters" | "worldbooks" | "presets" | "personas" | "playthroughs";
const MAX_DOCUMENT_BYTES = 2 * 1024 * 1024;
export const MAX_ITEMS = 200;
/** Each roleplay chat is one playthrough; they are small and outnumber characters. */
export const MAX_PLAYTHROUGHS = 1000;
const limit = (kind: TavernKind): number => kind === "playthroughs" ? MAX_PLAYTHROUGHS : MAX_ITEMS;

export class TavernStore {
  private readonly stateDir: string;
  constructor(stateDir: string) { this.stateDir = stateDir; }
  private base(): string | null {
    const base = join(this.stateDir, "tavern");
    return [this.stateDir, base].some(isLink) ? null : base;
  }
  private directory(kind: TavernKind): string | null {
    const base = this.base(), directory = base && join(base, kind);
    return directory && !isLink(directory) ? directory : null;
  }
  private file(kind: TavernKind, id: string): string | null {
    const directory = this.directory(kind);
    return directory && validResourceId(id) && !id.endsWith("\n") ? join(directory, id + ".json") : null;
  }
  private read(path: string, named = true): Record<string, unknown> | null {
    try { if (isLink(path) || !lstatSync(path).isFile() || lstatSync(path).size > MAX_DOCUMENT_BYTES) return null; } catch { return null; }
    const value = readJsonObject(path);
    return value && typeof value.id === "string" && (!named || typeof value.name === "string" || typeof value.title === "string") ? value : null;
  }
  private prepare(directory: string): void {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    protectPrivateDirectory(join(this.stateDir, "tavern")); protectPrivateDirectory(directory);
  }
  list<T>(kind: TavernKind): T[] {
    const directory = this.directory(kind);
    if (!directory || !existsSync(directory)) return [];
    return readdirSync(directory).filter(name => name.endsWith(".json")).sort().slice(0, limit(kind))
      .map(name => this.read(join(directory, name))).filter((item): item is Record<string, unknown> => item !== null) as unknown as T[];
  }
  count(kind: TavernKind): number {
    const directory = this.directory(kind);
    return directory && existsSync(directory) ? readdirSync(directory).filter(name => name.endsWith(".json")).length : 0;
  }
  full(kind: TavernKind): boolean { return this.count(kind) >= limit(kind); }
  get<T>(kind: TavernKind, id: unknown): T | null {
    const path = typeof id === "string" ? this.file(kind, id) : null;
    return path ? this.read(path) as unknown as T | null : null;
  }
  put<T extends { id: string }>(kind: TavernKind, item: T): void {
    const path = this.file(kind, item.id), directory = this.directory(kind);
    if (!path || !directory) throw new Error("the tavern store cannot be used");
    this.prepare(directory);
    atomicWriteJson(path, { ...item });
  }
  remove(kind: TavernKind, id: unknown): boolean {
    const path = typeof id === "string" ? this.file(kind, id) : null;
    if (!path || isLink(path) || !existsSync(path)) return false;
    unlinkSync(path);
    return true;
  }
  /** The Tavern-wide settings document, or an empty object. */
  settings(): Record<string, unknown> {
    const base = this.base(), path = base && join(base, "settings.json");
    if (!path || !existsSync(path)) return {};
    try { if (isLink(path) || !lstatSync(path).isFile() || lstatSync(path).size > 64 * 1024) return {}; } catch { return {}; }
    return readJsonObject(path) ?? {};
  }
  saveSettings(value: Record<string, unknown>): void {
    const base = this.base();
    if (!base) throw new Error("the tavern store cannot be used");
    this.prepare(base);
    atomicWriteJson(join(base, "settings.json"), value);
  }
}
