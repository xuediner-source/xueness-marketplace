/**
 * The roleplay context of one request: the system prompt from the preset's sections, the greeting, the
 * author's note and the post-history instructions, with SillyTavern macros filled in. Pure: the caller
 * supplies the character, persona, preset, books and the recent chat text, and decides where each part goes.
 */
import { createHash } from "node:crypto";
import type { Character, WorldBook } from "./cards.ts";
import type { Persona, Preset, SectionId } from "./presets.ts";
import { activateWorldInfo, type Activated, type SourcedEntry } from "./worldinfo.ts";

export interface AssembleInput {
  character: Character; persona: Persona | null; userName: string; preset: Preset; books: readonly WorldBook[];
  greeting: number; history: readonly { role: string; content: string }[]; seed: string; now?: Date;
}
export interface AssembledSection { id: SectionId; title: string; text: string }
export interface Assembled {
  system: string; sections: AssembledSection[]; greeting: string; authorNote: { text: string; depth: number } | null; postHistory: string;
  activated: { name: string; source: string; reason: Activated["reason"]; key: string; position: "before" | "after" }[]; droppedEntries: number;
}

const MAX_SYSTEM_CHARS = 120_000;
const TITLES: Readonly<Record<SectionId, string>> = {
  main: "", persona: "{{user}}", description: "{{char}}", personality: "{{char}}'s personality", scenario: "Scenario",
  worldBefore: "World information", examples: "Example dialogue", worldAfter: "World information",
};

/** SillyTavern macros: {{char}} {{user}} (and <BOT> <USER>), {{persona}} {{description}} {{personality}} {{scenario}}, {{time}} {{date}} {{weekday}}, {{random:a,b}}, {{newline}}, {{trim}}, {{noop}}. */
export function fillMacros(text: string, values: { char: string; user: string; persona: string; description: string; personality: string; scenario: string }, seed: string, now = new Date()): string {
  let counter = 0;
  return text
    .replace(/\{\{char\}\}|<BOT>/gi, values.char).replace(/\{\{user\}\}|<USER>/gi, values.user)
    .replace(/\{\{persona\}\}/gi, values.persona).replace(/\{\{description\}\}/gi, values.description)
    .replace(/\{\{personality\}\}/gi, values.personality).replace(/\{\{scenario\}\}/gi, values.scenario)
    .replace(/\{\{time\}\}/gi, now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }))
    .replace(/\{\{date\}\}/gi, now.toISOString().slice(0, 10))
    .replace(/\{\{weekday\}\}/gi, now.toLocaleDateString("en-GB", { weekday: "long" }))
    .replace(/\{\{random(?:::|:)([^}]*)\}\}/gi, (_whole, list: string) => {
      const options = list.split(list.includes("::") ? "::" : ",").map(item => item.trim()).filter(Boolean);
      if (!options.length) return "";
      const index = createHash("sha256").update(`${seed}\u0000random\u0000${counter++}`).digest().readUInt32BE(0) % options.length;
      return options[index]!;
    })
    .replace(/\{\{newline\}\}/gi, "\n").replace(/\{\{noop\}\}/gi, "").replace(/\s*\{\{trim\}\}\s*/gi, "");
}

/** The greetings of a card in order: the first message, then the alternates. */
export const greetingsOf = (character: Character): string[] => [character.firstMessage, ...character.alternateGreetings].filter(text => text.trim());

export function assembleRoleplay(input: AssembleInput): Assembled {
  const { character, preset, persona } = input;
  const user = (persona?.name || input.userName).trim().slice(0, 60) || "User";
  const raw = { char: character.name, user, persona: persona?.description ?? "", description: character.description, personality: character.personality, scenario: character.scenario };
  const fill = (text: string): string => fillMacros(fillMacros(text, raw, input.seed, input.now), raw, input.seed, input.now).trim();
  const greetings = greetingsOf(character);
  const greeting = fill(greetings[Math.max(0, Math.min(greetings.length - 1, Math.trunc(input.greeting) || 0))] ?? "");

  const sourced: SourcedEntry[] = [
    ...(preset.worldInfo.includeCharacterBook ? character.book.map(entry => ({ entry, source: character.name })) : []),
    ...input.books.flatMap(book => book.entries.map(entry => ({ entry, source: book.name }))),
  ];
  // Early in a chat the greeting is part of what the characters are talking about.
  const recent = input.history.slice(-preset.worldInfo.scanDepth).map(message => message.content);
  if (input.history.length < preset.worldInfo.scanDepth && greeting) recent.unshift(greeting);
  const world = activateWorldInfo(sourced, recent.join("\n"), preset.worldInfo, input.seed);
  const worldText = (items: readonly Activated[]): string => items.map(item => fill(item.entry.content)).join("\n\n");

  const main = preset.preferCardSystemPrompt && character.systemPrompt.trim()
    ? fill(character.systemPrompt.replace(/\{\{original\}\}/gi, preset.mainPrompt)) : fill(preset.mainPrompt);
  const bodies: Readonly<Record<SectionId, string>> = {
    main, persona: fill(persona?.description ?? ""), description: fill(character.description), personality: fill(character.personality),
    scenario: fill(character.scenario), worldBefore: worldText(world.before), examples: fill(character.exampleMessages.replace(/<START>/gi, "")), worldAfter: worldText(world.after),
  };
  const sections: AssembledSection[] = preset.sections.filter(section => section.enabled && bodies[section.id].trim())
    .map(section => ({ id: section.id, title: fill(TITLES[section.id]), text: bodies[section.id] }));
  const system = sections.map(section => section.title ? `## ${section.title}\n${section.text}` : section.text).join("\n\n").slice(0, MAX_SYSTEM_CHARS);
  const postHistory = fill(preset.preferCardPostHistory && character.postHistoryInstructions.trim()
    ? character.postHistoryInstructions.replace(/\{\{original\}\}/gi, preset.postHistory) : preset.postHistory);
  const note = fill(preset.authorNote.text);
  return {
    system, sections, greeting, postHistory, authorNote: note ? { text: note, depth: preset.authorNote.depth } : null,
    activated: [...world.before, ...world.after].map(item => ({ name: item.entry.comment || item.entry.keys[0] || item.entry.content.slice(0, 40), source: item.source, reason: item.reason, key: item.key, position: item.entry.position ?? "before" })),
    droppedEntries: world.dropped,
  };
}
