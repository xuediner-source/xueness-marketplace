/**
 * SillyTavern-compatible character cards and world books, read as data.
 *
 * Accepted character cards: V1 (flat fields), V2 (`spec: "chara_card_v2"`, fields under `data`) and V3
 * (`chara_card_v3`). A PNG card carries the same JSON in a text chunk; the page extracts it in the browser, so
 * this module only ever sees JSON text. World books are SillyTavern world-info files (`entries` as a map or a
 * list) and the `character_book` embedded in a V2/V3 card. Everything is bounded and copied field by field;
 * unknown fields are dropped, and nothing in a card is executed or fetched.
 */
import { createHash, randomBytes } from "node:crypto";

type Row = Record<string, unknown>;
export const MAX_CARD_BYTES = 768 * 1024;
const MAX_TEXT = 64 * 1024, MAX_ENTRY_TEXT = 16 * 1024, MAX_ENTRIES = 500, MAX_GREETINGS = 32, MAX_KEYS = 32;

/** How secondary keys combine with a primary-key match (SillyTavern `selectiveLogic` 0..3). */
export type SelectiveLogic = "and_any" | "not_all" | "not_any" | "and_all";
export interface BookEntry {
  keys: string[]; secondary: string[]; content: string; constant: boolean; enabled: boolean; order: number; comment: string;
  /** Optional fields (Tavern 2): absent in libraries imported by Tavern 1, where the defaults apply. */
  selectiveLogic?: SelectiveLogic;
  /** Before or after the character definition. SillyTavern's author's-note and at-depth positions are read as "after". */
  position?: "before" | "after";
  /** 0..100; below 100 the entry fires on that share of the turns it matches. */
  probability?: number;
  /** null: use the preset's setting. */
  caseSensitive?: boolean | null;
  matchWholeWords?: boolean | null;
  /** Content of this entry is not scanned for further keys. */
  preventRecursion?: boolean;
}
export interface WorldBook { id: string; name: string; description: string; entries: BookEntry[]; importedAt: string; fileName: string; updatedAt?: string }
export interface Character {
  id: string; name: string; description: string; personality: string; scenario: string; firstMessage: string; alternateGreetings: string[];
  exampleMessages: string; systemPrompt: string; postHistoryInstructions: string; creator: string; creatorNotes: string; tags: string[]; spec: string;
  book: BookEntry[]; importedAt: string; fileName: string;
  /** A small picture taken from a PNG card by the page (data URL, at most 64 KB). */
  avatar?: string;
  /** Tavern 2.1: pinned to the top of the library; when it was last edited here. */
  favorite?: boolean;
  updatedAt?: string;
}
export class CardError extends Error {
  readonly code: string;
  constructor(code: string, message: string) { super(message); this.code = code; }
}

const isObject = (value: unknown): value is Row => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown, max = MAX_TEXT): string => typeof value === "string" ? value.replace(/\r\n/g, "\n").replace(/\u0000/g, "").slice(0, max) : "";
const line = (value: unknown, max: number): string => text(value, max).replace(/[\u0000-\u001f\u007f]+/g, " ").trim();
const LOGIC: readonly SelectiveLogic[] = ["and_any", "not_all", "not_any", "and_all"];
const flag = (value: unknown): boolean | null => typeof value === "boolean" ? value : null;
const strings = (value: unknown, count: number, max: number): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim() !== "").slice(0, count).map(item => line(item, max)) : [];
/** A stable file-safe id: a slug of the name plus a short digest of the content, so two cards with one name coexist. */
export function contentId(name: string, content: string): string {
  const slug = name.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32) || "item";
  return `${slug}-${createHash("sha256").update(content).digest("hex").slice(0, 8)}`;
}

function parseJson(source: unknown, what: string): Row {
  if (typeof source !== "string" || Buffer.byteLength(source, "utf8") > MAX_CARD_BYTES) throw new CardError("too_large", `${what} must be JSON text of at most ${MAX_CARD_BYTES / 1024} KB`);
  let value: unknown;
  try { value = JSON.parse(source.replace(/^﻿/, "")); } catch { throw new CardError("invalid_json", `${what} is not valid JSON`); }
  if (!isObject(value)) throw new CardError("invalid_card", `${what} must be a JSON object`);
  return value;
}

/** Entries of a world-info file (`key`, `keysecondary`, `disable`, `order`) or a `character_book` (`keys`, `secondary_keys`, `enabled`, `insertion_order`). */
export function bookEntries(value: unknown): BookEntry[] {
  const raw = isObject(value) ? Object.values(value) : Array.isArray(value) ? value : [];
  const entries: BookEntry[] = [];
  for (const item of raw) {
    if (!isObject(item) || entries.length >= MAX_ENTRIES) continue;
    const content = text(item.content, MAX_ENTRY_TEXT).trim();
    if (!content) continue;
    const order = Number(item.order ?? item.insertion_order ?? 100);
    entries.push({
      keys: strings(item.key ?? item.keys, MAX_KEYS, 120), secondary: strings(item.keysecondary ?? item.secondary_keys, MAX_KEYS, 120), content,
      constant: item.constant === true, enabled: item.disable === true ? false : item.enabled !== false,
      order: Number.isFinite(order) ? Math.max(-100000, Math.min(100000, Math.trunc(order))) : 100, comment: line(item.comment ?? item.name, 200),
      ...entryOptions(item),
    });
  }
  return entries;
}

/** World-info options as SillyTavern writes them, at the top level of an entry or under `extensions` in a card book. */
function entryOptions(item: Row): Partial<BookEntry> {
  const extra = isObject(item.extensions) ? item.extensions : {};
  const pick = (key: string): unknown => item[key] ?? extra[key];
  const out: Partial<BookEntry> = {};
  const logic = Number(pick("selectiveLogic"));
  if (Number.isInteger(logic) && logic >= 0 && logic <= 3) out.selectiveLogic = LOGIC[logic]!;
  const position = pick("position");
  if (position === 0 || position === "before_char") out.position = "before";
  else if (typeof position === "number" || position === "after_char") out.position = "after";
  const probability = Number(pick("probability"));
  if (pick("useProbability") !== false && Number.isFinite(probability) && probability >= 0 && probability < 100) out.probability = Math.round(probability);
  const caseSensitive = flag(pick("caseSensitive") ?? pick("case_sensitive")), whole = flag(pick("matchWholeWords") ?? pick("match_whole_words"));
  if (caseSensitive !== null) out.caseSensitive = caseSensitive;
  if (whole !== null) out.matchWholeWords = whole;
  if (pick("preventRecursion") === true || pick("prevent_recursion") === true) out.preventRecursion = true;
  return out;
}

/** A picture the page made from a PNG card: a small PNG, JPEG or WebP data URL, or nothing. */
export function avatarData(value: unknown): string | undefined {
  return typeof value === "string" && value.length <= 64 * 1024 && /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value) ? value : undefined;
}

export function parseCharacter(source: unknown, fileName: unknown, now: string): Character {
  const document = parseJson(source, "the character card");
  const data = isObject(document.data) ? document.data : document;
  const name = line(data.name ?? data.char_name, 120);
  if (!name) throw new CardError("invalid_card", "the character card has no name");
  const description = text(data.description ?? data.char_persona);
  const firstMessage = text(data.first_mes ?? data.char_greeting);
  if (!description.trim() && !firstMessage.trim() && !text(data.personality).trim()) throw new CardError("invalid_card", "the character card has no description, personality or first message");
  const book = isObject(data.character_book) ? bookEntries(data.character_book.entries) : [];
  return {
    id: contentId(name, JSON.stringify(data)), name, description, personality: text(data.personality), scenario: text(data.scenario ?? data.world_scenario),
    firstMessage, alternateGreetings: Array.isArray(data.alternate_greetings) ? data.alternate_greetings.filter((item): item is string => typeof item === "string" && item.trim() !== "").slice(0, MAX_GREETINGS).map(item => text(item)) : [],
    exampleMessages: text(data.mes_example ?? data.example_dialogue), systemPrompt: text(data.system_prompt), postHistoryInstructions: text(data.post_history_instructions),
    creator: line(data.creator, 120), creatorNotes: text(data.creator_notes ?? data.creatorcomment, 4000), tags: strings(data.tags, 24, 40),
    spec: line(document.spec, 40) || "chara_card_v1", book, importedAt: now, fileName: line(fileName, 200),
  };
}

/**
 * Entries as the panel edits them (this module's own `BookEntry` shape), bounded field by field. An entry
 * without content does nothing and is dropped, as on import.
 */
export function editedEntries(value: unknown): BookEntry[] {
  const entries: BookEntry[] = [];
  for (const item of Array.isArray(value) ? value : []) {
    if (!isObject(item) || entries.length >= MAX_ENTRIES) continue;
    const content = text(item.content, MAX_ENTRY_TEXT).trim();
    if (!content) continue;
    const order = Number(item.order), probability = Number(item.probability);
    const entry: BookEntry = {
      keys: strings(item.keys, MAX_KEYS, 120), secondary: strings(item.secondary, MAX_KEYS, 120), content,
      constant: item.constant === true, enabled: item.enabled !== false,
      order: Number.isFinite(order) ? Math.max(-100000, Math.min(100000, Math.trunc(order))) : 100, comment: line(item.comment, 200),
      position: item.position === "after" ? "after" : "before",
    };
    if (LOGIC.includes(item.selectiveLogic as SelectiveLogic)) entry.selectiveLogic = item.selectiveLogic as SelectiveLogic;
    if (Number.isFinite(probability) && probability >= 0 && probability < 100) entry.probability = Math.round(probability);
    const caseSensitive = flag(item.caseSensitive), whole = flag(item.matchWholeWords);
    if (caseSensitive !== null) entry.caseSensitive = caseSensitive;
    if (whole !== null) entry.matchWholeWords = whole;
    if (item.preventRecursion === true) entry.preventRecursion = true;
    entries.push(entry);
  }
  return entries;
}

/** The fields of a character the panel can create or change. */
const CHARACTER_TEXT = ["description", "personality", "scenario", "firstMessage", "exampleMessages", "systemPrompt", "postHistoryInstructions"] as const;

/**
 * A character written in the panel: a new one (no `existing`) or an edit of `existing`. Only the fields the
 * input names change; `avatar: null` removes the picture. A character needs a name, nothing else.
 */
export function editedCharacter(input: unknown, now: string, existing?: Character): Character {
  const raw = isObject(input) ? input : {};
  const has = (key: string): boolean => Object.prototype.hasOwnProperty.call(raw, key);
  const base: Character = existing ?? {
    id: "", name: "", description: "", personality: "", scenario: "", firstMessage: "", alternateGreetings: [], exampleMessages: "", systemPrompt: "",
    postHistoryInstructions: "", creator: "", creatorNotes: "", tags: [], spec: "chara_card_v2", book: [], importedAt: now, fileName: "",
  };
  const next: Character = { ...base, updatedAt: now };
  if (has("name")) next.name = line(raw.name, 120);
  if (!next.name) throw new CardError("invalid_card", "a character needs a name");
  for (const key of CHARACTER_TEXT) if (has(key)) next[key] = text(raw[key]);
  if (has("alternateGreetings")) next.alternateGreetings = Array.isArray(raw.alternateGreetings) ? raw.alternateGreetings.filter((item): item is string => typeof item === "string" && item.trim() !== "").slice(0, MAX_GREETINGS).map(item => text(item)) : [];
  if (has("creator")) next.creator = line(raw.creator, 120);
  if (has("creatorNotes")) next.creatorNotes = text(raw.creatorNotes, 4000);
  if (has("tags")) next.tags = [...new Set(strings(raw.tags, 24, 40))];
  if (has("book")) next.book = editedEntries(raw.book);
  if (has("favorite")) next.favorite = raw.favorite === true;
  if (has("avatar")) { const picture = avatarData(raw.avatar); if (picture) next.avatar = picture; else delete next.avatar; }
  if (!existing) next.id = contentId(next.name, `${now}\u0000${randomBytes(8).toString("hex")}`);
  return next;
}

/** A world book written in the panel: a new, empty one, or an edit of `existing` (name, description, entries). */
export function editedWorldBook(input: unknown, now: string, existing?: WorldBook): WorldBook {
  const raw = isObject(input) ? input : {};
  const has = (key: string): boolean => Object.prototype.hasOwnProperty.call(raw, key);
  const next: WorldBook = existing ? { ...existing, updatedAt: now } : { id: "", name: "", description: "", entries: [], importedAt: now, fileName: "", updatedAt: now };
  if (has("name") || !existing) next.name = line(raw.name, 120);
  if (!next.name) throw new CardError("invalid_book", "a world book needs a name");
  if (has("description")) next.description = text(raw.description, 2000);
  if (has("entries")) next.entries = editedEntries(raw.entries);
  if (!existing) next.id = contentId(next.name, `${now}\u0000${randomBytes(8).toString("hex")}`);
  return next;
}

export function parseWorldBook(source: unknown, fileName: unknown, now: string): WorldBook {
  const document = parseJson(source, "the world book");
  const entries = bookEntries(document.entries);
  if (!entries.length) throw new CardError("invalid_book", "the world book has no usable entries");
  const file = line(fileName, 200);
  const name = line(document.name, 120) || file.replace(/^.*[\\/]/, "").replace(/\.json$/i, "") || "World book";
  return { id: contentId(name, JSON.stringify(document.entries)), name, description: text(document.description, 2000), entries, importedAt: now, fileName: file };
}
