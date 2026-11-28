/**
 * Roleplay mode: the request hook the host calls for sessions the Tavern started.
 *
 * A Tavern chat is an ordinary Xueness session tagged `plugin_refs.tavern = <playthrough id>`. Before each
 * model request the host hands the request here. The playthrough names the character, preset, persona and
 * world books; this module rebuilds the request around them:
 *
 *   system      the preset's sections (main prompt, persona, character, world information, examples)
 *   greeting    the chosen opening, as the character's first message (the journal never holds it)
 *   history     the chat itself; workspace context, memory and tool catalogs are left out
 *   author's note  appended to the user turn at the preset's depth
 *   post-history   appended to the latest user turn
 *
 * Workspace tools are removed unless the preset keeps them. The session journal is never rewritten:
 * this is the request view only. In lightweight mode the host calls this before it builds its small-context
 * view, which then takes `systemPrompt` and adds its own JSON reply protocol and history budget; a request
 * that already is a lightweight JSON view (an older host) keeps one JSON reply.
 */
import type { Character, WorldBook } from "./cards.ts";
import { assembleRoleplay, fillMacros, greetingsOf, type Assembled } from "./assemble.ts";
import { defaultPreset, normalizeSettings, type Persona, type Playthrough, type Preset } from "./presets.ts";
import { TavernStore } from "./store.ts";

type Row = Record<string, unknown>;
export interface RoleplayRequest { messages: Row[]; tools: Row[]; [key: string]: unknown }
const isObject = (value: unknown): value is Row => typeof value === "object" && value !== null && !Array.isArray(value);
const JSON_REPLY = 'Reply format: answer with ONLY one JSON object and nothing else: {"answer":"<your in-character reply; Markdown allowed>","evidence":[]}. No tools are available in this chat.';
const TOUCH_MS = 60_000;

/** The readable text of a message: a lightweight JSON envelope's answer, or the content itself. */
function plain(message: Row): string {
  const content = typeof message.content === "string" ? message.content : "";
  if (message.role === "assistant" && content.startsWith("{")) {
    try { const value = JSON.parse(content) as unknown; if (isObject(value) && typeof value.answer === "string") return value.answer; } catch { /* not an envelope */ }
  }
  return content;
}

/** Workspace context the host adds for coding work; a roleplay request leaves it out. */
function hostContext(message: Row): boolean {
  if (message._meta_source !== undefined || message._input_kind === "tool_catalog" || message._input_kind === "host_guidance") return true;
  return message.role === "user" && typeof message.content === "string" && message.content.startsWith("UNTRUSTED optional context:");
}

// The host's per-step notes (work policy, reminders) ride at the end of the latest user turn; they are about
// coding work, so a roleplay request drops them. A repair note (the reply was not in the required format) stays.
const GUIDANCE = "Host guidance for this step (from Xueness, not the user; it applies to your next reply only):\n";
function withoutGuidance(message: Row): Row {
  if (message.role !== "user" || typeof message.content !== "string") return message;
  const at = message.content.indexOf(GUIDANCE.slice(0, 40));
  return at < 0 ? message : { ...message, content: message.content.slice(0, at).trimEnd() };
}

function appendTo(messages: Row[], index: number, text: string): void {
  const target = messages[index]!;
  messages[index] = { ...target, content: `${typeof target.content === "string" ? target.content : ""}\n\n${text}` };
}

export interface RoleplayContext { playthrough: Playthrough; character: Character; preset: Preset; persona: Persona | null; books: WorldBook[] }

/** The playthrough a tagged session belongs to, with everything it names; null when any part is missing. */
export function roleplayContext(store: TavernStore, ref: string, sessionId: string): RoleplayContext | null {
  const playthrough = store.get<Playthrough>("playthroughs", ref);
  if (!playthrough || playthrough.sessionId && playthrough.sessionId !== sessionId) return null;
  const character = store.get<Character>("characters", playthrough.characterId);
  if (!character) return null;
  const preset = (playthrough.presetId !== "default" ? store.get<Preset>("presets", playthrough.presetId) : null) ?? defaultPreset();
  const persona = playthrough.personaId ? store.get<Persona>("personas", playthrough.personaId) : null;
  const settings = normalizeSettings(store.settings());
  const books = [...new Set([...playthrough.worldbooks, ...settings.globalWorldbooks])]
    .map(id => store.get<WorldBook>("worldbooks", id)).filter((book): book is WorldBook => book !== null);
  return { playthrough, character, preset, persona, books };
}

/**
 * How a Tavern chat presents itself in the conversation view: the character's and the persona's names and
 * pictures (read from `/api/tavern/avatars/...`), and the chosen opening line with its macros filled, shown
 * before the first message when the preset sends the greeting as the character's first message.
 */
export function roleplayPresentation(options: { stateDir: string }, session: Row): Row | null {
  const refs = session.plugin_refs, ref = isObject(refs) && typeof refs.tavern === "string" ? refs.tavern : null;
  const sessionId = typeof session.id === "string" ? session.id : "";
  if (!ref || !sessionId) return null;
  const context = roleplayContext(new TavernStore(options.stateDir), ref, sessionId);
  if (!context) return null;
  const { playthrough, character, preset, persona } = context;
  const greetings = greetingsOf(character), index = Math.max(0, Math.min(greetings.length - 1, Math.trunc(playthrough.greeting) || 0));
  const values = { char: character.name, user: persona?.name || "User", persona: persona?.description ?? "", description: character.description, personality: character.personality, scenario: character.scenario };
  const seed = `${sessionId}:0`;
  const text = greetings.length && preset.greetingInHistory ? fillMacros(fillMacros(greetings[index]!, values, seed), values, seed).trim() : "";
  const picture = (kind: "characters" | "personas", id: string, has: boolean): string | null => has ? `/api/tavern/avatars/${kind}/${encodeURIComponent(id)}` : null;
  return {
    plugin: "tavern", panel: "tavern", chat: true,
    assistant: { name: character.name, avatarUrl: picture("characters", character.id, !!character.avatar) },
    user: persona ? { name: persona.name, avatarUrl: picture("personas", persona.id, !!persona.avatar) } : null,
    opening: text ? { text, index, total: greetings.length } : null,
  };
}

export function prepareRoleplayRequest(options: { stateDir: string }, session: Row, request: RoleplayRequest, view: { lightweight: boolean }): RoleplayRequest {
  const refs = session.plugin_refs, ref = isObject(refs) && typeof refs.tavern === "string" ? refs.tavern : null;
  const sessionId = typeof session.id === "string" ? session.id : "";
  if (!ref || !sessionId) return request;
  const store = new TavernStore(options.stateDir);
  const context = roleplayContext(store, ref, sessionId);
  if (!context) return request;
  const { playthrough, character, preset, persona, books } = context;

  const messages = request.messages;
  let lead = 0;
  while (lead < messages.length && messages[lead]!.role === "system" && messages[lead]!._input_kind !== "tool_catalog") lead += 1;
  const leading = messages.slice(0, lead);
  const history = messages.slice(lead).filter(message => !hostContext(message)).map(withoutGuidance)
    .filter(message => message.role !== "user" || typeof message.content !== "string" || message.content.trim());
  const jsonProtocol = view.lightweight && leading.some(message => message._response_format === "json_object");
  const turn = history.filter(message => message.role === "user").length;
  const assembled: Assembled = assembleRoleplay({
    character, persona, userName: "User", preset, books, greeting: playthrough.greeting,
    history: history.filter(message => message.role === "user" || message.role === "assistant").map(message => ({ role: String(message.role), content: plain(message) })),
    seed: `${sessionId}:${turn}`,
  });

  const system: Row = { role: "system", content: jsonProtocol ? `${assembled.system}\n\n${JSON_REPLY}` : assembled.system };
  if (jsonProtocol) system._response_format = "json_object";
  // Keeping tools means keeping the host's own instructions for them; a tool-free roleplay replaces them.
  const head: Row[] = preset.noTools ? [system] : [...leading, { role: "system", content: assembled.system }];
  const body: Row[] = history.map(message => ({ ...message }));
  if (preset.greetingInHistory && assembled.greeting && body[0]?.role === "user") {
    body.unshift({ role: "assistant", content: jsonProtocol ? JSON.stringify({ answer: assembled.greeting, evidence: [] }) : assembled.greeting });
  }
  const users = body.map((message, index) => message.role === "user" ? index : -1).filter(index => index >= 0);
  if (assembled.authorNote && users.length) {
    // The user turn nearest to `depth` messages from the end, so the note sits that far back in the chat.
    const goal = body.length - 1 - assembled.authorNote.depth;
    const target = [...users].reverse().find(index => index <= goal) ?? users[0]!;
    appendTo(body, target, `[Author's note: ${assembled.authorNote.text}]`);
  }
  if (assembled.postHistory && users.length) appendTo(body, users.at(-1)!, assembled.postHistory);
  // A built view already carried the repair note (stripped above with the rest); the lightweight view adds it itself.
  const repair = typeof request.repair === "string" ? request.repair.trim() : "";
  if (repair && users.length && !view.lightweight) appendTo(body, users.at(-1)!, GUIDANCE + repair);

  const now = Date.now();
  if (playthrough.sessionId !== sessionId || now - Date.parse(playthrough.lastUsedAt) > TOUCH_MS) {
    try { store.put("playthroughs", { ...playthrough, sessionId, lastUsedAt: new Date(now).toISOString() }); } catch { /* the chat still runs without the bookkeeping */ }
  }
  // The lightweight view takes its system prompt from `systemPrompt` and adds `injected` workspace context;
  // a roleplay request has its own prompt and no workspace context.
  return { ...request, messages: [...head, ...body], tools: preset.noTools ? [] : request.tools, systemPrompt: assembled.system, hostInstructions: [], injected: [] };
}
