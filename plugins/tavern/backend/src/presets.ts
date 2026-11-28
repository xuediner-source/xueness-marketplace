/**
 * Prompt presets, user personas, Tavern settings and playthroughs: the data a roleplay chat is built from.
 *
 * A preset decides how each request of a roleplay chat is assembled: the main prompt, which character
 * sections are sent and in what order, the author's note and its depth, the instructions placed after the
 * chat history, and how world information is scanned. It is SillyTavern's prompt manager, minus sampling:
 * Xueness keeps temperature and the like on the model connection, so imported sampling values are ignored.
 */
import { randomBytes } from "node:crypto";

type Row = Record<string, unknown>;
const isObject = (value: unknown): value is Row => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown, max: number): string => typeof value === "string" ? value.replace(/\r\n/g, "\n").replace(/\u0000/g, "").slice(0, max) : "";
const line = (value: unknown, max: number): string => text(value, max).replace(/[\u0000-\u001f\u007f]+/g, " ").trim();
const int = (value: unknown, low: number, high: number, fallback: number): number => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(low, Math.min(high, Math.round(number))) : fallback;
};
const bool = (value: unknown, fallback: boolean): boolean => typeof value === "boolean" ? value : fallback;
export const newId = (prefix: string): string => `${prefix}_${randomBytes(6).toString("hex")}`;

export const SECTION_IDS = ["main", "persona", "description", "personality", "scenario", "worldBefore", "examples", "worldAfter"] as const;
export type SectionId = typeof SECTION_IDS[number];
export interface PromptSection { id: SectionId; enabled: boolean }
export interface WorldInfoSettings {
  /** How many of the latest messages are searched for keys. */
  scanDepth: number;
  /** Most characters of world information in one request; lower-order entries are dropped first. */
  budgetChars: number;
  /** Search the text of activated entries for further keys. */
  recursive: boolean;
  maxRecursion: number;
  caseSensitive: boolean;
  matchWholeWords: boolean;
  /** Use the book embedded in the character card. */
  includeCharacterBook: boolean;
}
export interface Preset {
  id: string; name: string; builtin?: boolean;
  mainPrompt: string;
  sections: PromptSection[];
  /** The card's own system prompt replaces the main prompt when it has one. */
  preferCardSystemPrompt: boolean;
  postHistory: string;
  /** The card's post-history instructions replace the preset's when it has them. */
  preferCardPostHistory: boolean;
  authorNote: { text: string; depth: number };
  worldInfo: WorldInfoSettings;
  /** Send the chosen greeting as the character's first message of the chat. */
  greetingInHistory: boolean;
  /** Roleplay chats run without workspace tools. */
  noTools: boolean;
  updatedAt: string;
}
export interface Persona {
  id: string; name: string; description: string; updatedAt: string;
  /** Tavern 2.1: a small picture (data URL, at most 64 KB) and the characters this persona is the default for. */
  avatar?: string; characterIds?: string[];
}
export interface TavernSettings { activePresetId: string; activePersonaId: string | null; globalWorldbooks: string[] }
export interface Playthrough {
  id: string; title: string; characterId: string; greeting: number; presetId: string; personaId: string | null;
  worldbooks: string[]; sessionId: string | null; createdAt: string; lastUsedAt: string;
}

export const SECTION_TITLES: Readonly<Record<SectionId, string>> = {
  main: "Main prompt", persona: "Persona", description: "Character description", personality: "Personality", scenario: "Scenario",
  worldBefore: "World information (before)", examples: "Example dialogue", worldAfter: "World information (after)",
};
export const DEFAULT_MAIN_PROMPT = "Write {{char}}'s next reply in a fictional roleplay between {{char}} and {{user}}. Stay in character. Write only {{char}}'s words, actions and narration; never write {{user}}'s lines or decide what {{user}} does. Be vivid and specific, keep replies a natural length, and move the story forward.";
export const DEFAULT_WORLD_INFO: WorldInfoSettings = { scanDepth: 4, budgetChars: 8000, recursive: true, maxRecursion: 2, caseSensitive: false, matchWholeWords: false, includeCharacterBook: true };

export function defaultPreset(now = new Date(0).toISOString()): Preset {
  return {
    id: "default", name: "默认", builtin: true, mainPrompt: DEFAULT_MAIN_PROMPT,
    sections: SECTION_IDS.map(id => ({ id, enabled: true })), preferCardSystemPrompt: true,
    postHistory: "", preferCardPostHistory: true, authorNote: { text: "", depth: 4 },
    worldInfo: { ...DEFAULT_WORLD_INFO }, greetingInHistory: true, noTools: true, updatedAt: now,
  };
}

/** A preset from untrusted input: every field bounded, every section present exactly once. */
export function normalizePreset(value: unknown, now: string, id?: string): Preset {
  const raw = isObject(value) ? value : {};
  const base = defaultPreset(now);
  const seen = new Set<SectionId>(), sections: PromptSection[] = [];
  for (const item of Array.isArray(raw.sections) ? raw.sections : []) {
    if (!isObject(item) || !SECTION_IDS.includes(item.id as SectionId) || seen.has(item.id as SectionId)) continue;
    seen.add(item.id as SectionId); sections.push({ id: item.id as SectionId, enabled: item.enabled !== false });
  }
  for (const section of base.sections) if (!seen.has(section.id)) sections.push(section);
  const world = isObject(raw.worldInfo) ? raw.worldInfo : {};
  const note = isObject(raw.authorNote) ? raw.authorNote : {};
  return {
    id: id ?? (typeof raw.id === "string" && /^p_[0-9a-f]{12}$/.test(raw.id) ? raw.id : newId("p")),
    name: line(raw.name, 60) || "未命名预设", mainPrompt: text(raw.mainPrompt, 20_000), sections,
    preferCardSystemPrompt: bool(raw.preferCardSystemPrompt, true), postHistory: text(raw.postHistory, 8000),
    preferCardPostHistory: bool(raw.preferCardPostHistory, true),
    authorNote: { text: text(note.text, 4000), depth: int(note.depth, 0, 20, 4) },
    worldInfo: {
      scanDepth: int(world.scanDepth, 1, 50, DEFAULT_WORLD_INFO.scanDepth), budgetChars: int(world.budgetChars, 500, 40_000, DEFAULT_WORLD_INFO.budgetChars),
      recursive: bool(world.recursive, DEFAULT_WORLD_INFO.recursive), maxRecursion: int(world.maxRecursion, 1, 5, DEFAULT_WORLD_INFO.maxRecursion),
      caseSensitive: bool(world.caseSensitive, false), matchWholeWords: bool(world.matchWholeWords, false), includeCharacterBook: bool(world.includeCharacterBook, true),
    },
    greetingInHistory: bool(raw.greetingInHistory, true), noTools: bool(raw.noTools, true), updatedAt: now,
  };
}

/** SillyTavern prompt identifiers that map onto a section here. */
const IDENTIFIERS: Readonly<Record<string, SectionId>> = {
  main: "main", personaDescription: "persona", charDescription: "description", charPersonality: "personality", scenario: "scenario",
  worldInfoBefore: "worldBefore", dialogueExamples: "examples", worldInfoAfter: "worldAfter",
};

/**
 * A SillyTavern chat-completion preset (`prompts` + `prompt_order`) as a preset here. Known prompts become
 * sections in the same order and on/off state; custom prompts before the chat history join the main prompt,
 * those after it (and `jailbreak`) join the post-history instructions. Sampling values are reported, not used.
 */
export function importSillyTavernPreset(source: unknown, name: unknown, now: string): { preset: Preset; ignored: string[] } {
  let document: unknown;
  if (typeof source !== "string" || source.length > 1024 * 1024) throw new Error("the preset must be JSON text of at most 1 MB");
  try { document = JSON.parse(source.replace(/^﻿/, "")); } catch { throw new Error("the preset is not valid JSON"); }
  if (!isObject(document) || !Array.isArray(document.prompts)) throw new Error("this is not a SillyTavern chat-completion preset (no prompts)");
  const prompts = new Map<string, Row>();
  for (const item of document.prompts) if (isObject(item) && typeof item.identifier === "string") prompts.set(item.identifier, item);
  const orders = Array.isArray(document.prompt_order) ? document.prompt_order.filter(isObject) : [];
  const chosen = orders.find(item => item.character_id === 100001) ?? orders.at(-1);
  const order: { identifier: string; enabled: boolean }[] = (Array.isArray(chosen?.order) ? chosen.order : [...prompts.keys()].map(identifier => ({ identifier, enabled: true })))
    .filter(isObject).filter((item: Row) => typeof item.identifier === "string").map((item: Row) => ({ identifier: item.identifier as string, enabled: item.enabled !== false }));
  const sections: PromptSection[] = [], before: string[] = [], after: string[] = [];
  let afterHistory = false, main = "";
  for (const { identifier, enabled } of order) {
    if (identifier === "chatHistory") { afterHistory = true; continue; }
    const prompt = prompts.get(identifier), content = text(prompt?.content, 20_000).trim();
    const section = IDENTIFIERS[identifier];
    if (section) {
      sections.push({ id: section, enabled });
      if (section === "main" && content) main = content;
      continue;
    }
    if (!enabled || !content) continue;
    if (identifier === "jailbreak" || afterHistory) after.push(content); else before.push(content);
  }
  // A section SillyTavern's order leaves out is not sent there either.
  if (Array.isArray(chosen?.order)) for (const id of SECTION_IDS) if (!sections.some(section => section.id === id)) sections.push({ id, enabled: false });
  const ignored = ["temperature", "top_p", "top_k", "frequency_penalty", "presence_penalty", "repetition_penalty", "openai_max_tokens", "openai_max_context"].filter(key => key in document);
  const preset = normalizePreset({
    name: line(name, 60) || "导入的预设", mainPrompt: [main, ...before].filter(Boolean).join("\n\n") || DEFAULT_MAIN_PROMPT, sections,
    postHistory: after.join("\n\n"), preferCardSystemPrompt: true, preferCardPostHistory: true,
  }, now);
  return { preset, ignored };
}

export function normalizePersona(value: unknown, now: string): Persona {
  const raw = isObject(value) ? value : {};
  const name = line(raw.name, 60);
  if (!name) throw new Error("a persona needs a name");
  const avatar = typeof raw.avatar === "string" && raw.avatar.length <= 64 * 1024 && /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(raw.avatar) ? raw.avatar : undefined;
  const characterIds = Array.isArray(raw.characterIds) ? [...new Set(raw.characterIds.filter((item): item is string => typeof item === "string" && /^[A-Za-z0-9._-]{1,80}$/.test(item)))].slice(0, 64) : [];
  return {
    id: typeof raw.id === "string" && /^u_[0-9a-f]{12}$/.test(raw.id) ? raw.id : newId("u"), name, description: text(raw.description, 8000), updatedAt: now,
    ...(avatar ? { avatar } : {}), ...(characterIds.length ? { characterIds } : {}),
  };
}

export function normalizeSettings(value: unknown, current: Row = {}): TavernSettings {
  const raw = { ...current, ...(isObject(value) ? value : {}) };
  const ids = (list: unknown): string[] => Array.isArray(list) ? [...new Set(list.filter((item): item is string => typeof item === "string" && /^[A-Za-z0-9._-]{1,80}$/.test(item)))].slice(0, 32) : [];
  return {
    activePresetId: typeof raw.activePresetId === "string" && /^(?:default|p_[0-9a-f]{12})$/.test(raw.activePresetId) ? raw.activePresetId : "default",
    activePersonaId: typeof raw.activePersonaId === "string" && /^u_[0-9a-f]{12}$/.test(raw.activePersonaId) ? raw.activePersonaId : null,
    globalWorldbooks: ids(raw.globalWorldbooks),
  };
}
