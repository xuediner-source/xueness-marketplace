/**
 * World information activation, as SillyTavern does it, on every request of a roleplay chat.
 *
 * The latest `scanDepth` messages are searched for each entry's keys. A key is literal text, or a
 * `/pattern/flags` regular expression. Matching follows the entry's case and whole-word settings, or the
 * preset's when the entry has none. Secondary keys narrow a match by the entry's logic (AND ANY, AND ALL,
 * NOT ANY, NOT ALL). Constant entries always apply. An entry with a probability below 100 applies on that
 * share of turns, decided deterministically per chat and turn so a regenerated reply sees the same world.
 * With recursion on, activated entries are searched for further keys. Within the character budget, lower
 * `order` entries are dropped first; the result is returned in order, split before/after the character.
 */
import { createHash } from "node:crypto";
import type { BookEntry } from "./cards.ts";
import type { WorldInfoSettings } from "./presets.ts";

export interface SourcedEntry { entry: BookEntry; source: string }
export interface Activated { entry: BookEntry; source: string; reason: "constant" | "key" | "recursion"; key: string }
export interface Activation { before: Activated[]; after: Activated[]; dropped: number }

const MAX_REGEX_SOURCE = 300;
const escape = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A matcher for one key, or null for an empty or unusable one. */
export function keyMatcher(key: string, caseSensitive: boolean, wholeWords: boolean): ((text: string) => boolean) | null {
  const trimmed = key.trim();
  if (!trimmed) return null;
  const pattern = /^\/(.+)\/([imsu]*)$/.exec(trimmed);
  if (pattern) {
    if (pattern[1]!.length > MAX_REGEX_SOURCE) return null;
    try { const regex = new RegExp(pattern[1]!, pattern[2]!.replace(/[gy]/g, "")); return (text) => regex.test(text); } catch { return null; }
  }
  const flags = caseSensitive ? "u" : "iu";
  if (wholeWords && /[\p{L}\p{N}_]/u.test(trimmed) && !/\s/.test(trimmed) && /^[\x00-\x7f]+$/.test(trimmed)) {
    const regex = new RegExp(`(?:^|[^\\p{L}\\p{N}_])${escape(trimmed)}(?:$|[^\\p{L}\\p{N}_])`, flags);
    return (text) => regex.test(text);
  }
  // Scripts written without spaces (Chinese, Japanese) have no word boundaries: whole-word matching is plain matching there.
  if (caseSensitive) return (text) => text.includes(trimmed);
  const lowered = trimmed.toLowerCase();
  return (text) => text.toLowerCase().includes(lowered);
}

function firstMatch(keys: readonly string[], text: string, caseSensitive: boolean, wholeWords: boolean): string | null {
  for (const key of keys) { const match = keyMatcher(key, caseSensitive, wholeWords); if (match?.(text)) return key; }
  return null;
}

function secondaryAllows(entry: BookEntry, text: string, caseSensitive: boolean, wholeWords: boolean): boolean {
  const keys = entry.secondary.filter(key => key.trim());
  if (!keys.length) return true;
  const hits = keys.map(key => keyMatcher(key, caseSensitive, wholeWords)?.(text) === true);
  switch (entry.selectiveLogic ?? "and_any") {
    case "and_all": return hits.every(Boolean);
    case "not_any": return !hits.some(Boolean);
    case "not_all": return !hits.every(Boolean);
    default: return hits.some(Boolean);
  }
}

/** A stable 0..99 roll for this entry in this chat turn. */
function roll(seed: string, index: number): number {
  return createHash("sha256").update(`${seed}\u0000${index}`).digest().readUInt32BE(0) % 100;
}

export function activateWorldInfo(entries: readonly SourcedEntry[], scanText: string, settings: WorldInfoSettings, seed: string): Activation {
  const active = new Map<number, Activated>();
  const passes = settings.recursive ? 1 + settings.maxRecursion : 1;
  let text = scanText;
  entries.forEach(({ entry, source }, index) => {
    if (entry.enabled && entry.constant && entry.content.trim()) active.set(index, { entry, source, reason: "constant", key: "" });
  });
  for (let pass = 0; pass < passes; pass += 1) {
    const found: number[] = [];
    entries.forEach(({ entry, source }, index) => {
      if (active.has(index) || !entry.enabled || !entry.content.trim()) return;
      const caseSensitive = entry.caseSensitive ?? settings.caseSensitive, whole = entry.matchWholeWords ?? settings.matchWholeWords;
      const key = firstMatch(entry.keys, text, caseSensitive, whole);
      if (key === null || !secondaryAllows(entry, text, caseSensitive, whole)) return;
      if ((entry.probability ?? 100) < 100 && roll(seed, index) >= entry.probability!) return;
      active.set(index, { entry, source, reason: pass === 0 ? "key" : "recursion", key });
      found.push(index);
    });
    if (!found.length || pass + 1 >= passes) break;
    text += "\n" + found.map(index => entries[index]!.entry).filter(entry => !entry.preventRecursion).map(entry => entry.content).join("\n");
  }
  // Within the budget, keep constant entries first, then the highest order; present the result in order.
  const ranked = [...active.values()].sort((a, b) => Number(b.reason === "constant") - Number(a.reason === "constant") || b.entry.order - a.entry.order);
  const kept: Activated[] = [];
  let used = 0;
  for (const item of ranked) {
    if (used + item.entry.content.length > settings.budgetChars) continue;
    kept.push(item); used += item.entry.content.length;
  }
  kept.sort((a, b) => a.entry.order - b.entry.order);
  return { before: kept.filter(item => (item.entry.position ?? "before") === "before"), after: kept.filter(item => item.entry.position === "after"), dropped: active.size - kept.length };
}
