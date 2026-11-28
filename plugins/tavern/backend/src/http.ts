/**
 * `/api/tavern`: the library, presets, personas, settings, playthroughs and the prompt preview.
 *
 *   GET    /api/tavern                          everything the panel lists (summaries)
 *   GET    /api/tavern/characters/:id           one character in full
 *   GET    /api/tavern/avatars/:kind/:id        { avatar } of a character or persona (the conversation view reads it)
 *   POST   /api/tavern/characters               { card, fileName?, avatar? }   card is JSON text (the page reads PNG cards)
 *                                               { character }                  a new character written in the panel
 *   POST   /api/tavern/characters/:id           { character }                  change the fields it names (favorite, avatar: null, …)
 *   DELETE /api/tavern/characters/:id
 *   GET    /api/tavern/worldbooks/:id           one book with its entries
 *   POST   /api/tavern/worldbooks               { book, fileName? }            import
 *                                               { create: { name, description? } }   a new, empty book
 *   POST   /api/tavern/worldbooks/:id           { book: { name?, description?, entries? } }   edit; or the older
 *                                               { entries: [{ index, enabled?, constant? }] } switches
 *   DELETE /api/tavern/worldbooks/:id
 *   POST   /api/tavern/presets                  { preset }            create or update
 *   POST   /api/tavern/presets/import           { json, name? }       a SillyTavern chat-completion preset
 *   DELETE /api/tavern/presets/:id
 *   POST   /api/tavern/personas                 { persona }           create or update
 *   DELETE /api/tavern/personas/:id
 *   POST   /api/tavern/settings                 { activePresetId?, activePersonaId?, globalWorldbooks? }
 *   POST   /api/tavern/playthroughs             { characterId, greeting?, presetId?, personaId?, worldbooks?, title? }
 *   POST   /api/tavern/playthroughs/:id         { title?, presetId?, personaId?, worldbooks?, greeting? }   takes effect on the next request
 *   DELETE /api/tavern/playthroughs/:id         forgets the playthrough; the chat session stays
 *   POST   /api/tavern/preview                  { characterId, greeting?, presetId?, personaId?, worldbooks?, sample? }
 *   POST   /api/tavern/brief                    Tavern 1's opening message, kept for older pages
 *
 * Refused requests answer 200 with `ok: false` and a stable code. No model request is made here.
 */
import { avatarData, CardError, editedCharacter, editedWorldBook, MAX_CARD_BYTES, parseCharacter, parseWorldBook, type Character, type WorldBook } from "./cards.ts";
import { assembleRoleplay, greetingsOf } from "./assemble.ts";
import { defaultPreset, importSillyTavernPreset, newId, normalizePersona, normalizePreset, normalizeSettings, type Persona, type Playthrough, type Preset } from "./presets.ts";
import { roleplayBrief } from "./prompt.ts";
import { MAX_ITEMS, TavernStore, type TavernKind } from "./store.ts";

export const TAVERN_ROUTES = ["GET /api/tavern", "GET /api/tavern/:kind/:id", "POST /api/tavern/:kind", "POST /api/tavern/:kind/:id", "DELETE /api/tavern/:kind/:id"] as const;
export interface TavernHttpOptions { stateDir: string; enabled(id: string): boolean; now?: () => string }
type Reply = [number, unknown];
type Row = Record<string, unknown>;
const isObject = (value: unknown): value is Row => typeof value === "object" && value !== null && !Array.isArray(value);
const refuse = (code: string, message: string): Reply => [200, { ok: false, error: { code, message } }];
const clip = (text: string, max: number): string => text.length > max ? text.slice(0, max) + "…" : text;
const ids = (value: unknown): string[] => Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === "string"))].slice(0, 16) : [];

const characterSummary = (item: Character, playthroughs: readonly Playthrough[]) => {
  const own = playthroughs.filter(row => row.characterId === item.id);
  return {
    id: item.id, name: item.name, creator: item.creator, tags: item.tags, spec: item.spec, importedAt: item.importedAt, fileName: item.fileName,
    avatar: item.avatar ?? null, description: clip(item.description.trim(), 400), scenario: clip(item.scenario.trim(), 300),
    greetings: greetingsOf(item).map(text => clip(text.trim(), 240)), bookEntries: item.book.length,
    hasExamples: item.exampleMessages.trim() !== "", hasSystemPrompt: item.systemPrompt.trim() !== "",
    playthroughs: own.length, favorite: item.favorite === true, updatedAt: item.updatedAt ?? item.importedAt,
    // Playthroughs come newest first.
    lastPlayedAt: own[0]?.lastUsedAt ?? null,
  };
};
const bookSummary = (item: WorldBook) => ({
  id: item.id, name: item.name, description: clip(item.description.trim(), 300), importedAt: item.importedAt, fileName: item.fileName, updatedAt: item.updatedAt ?? item.importedAt,
  entries: item.entries.length, constant: item.entries.filter(entry => entry.enabled && entry.constant).length, disabled: item.entries.filter(entry => !entry.enabled).length,
});

export function createTavernHttp(options: TavernHttpOptions) {
  const store = new TavernStore(options.stateDir);
  const now = options.now ?? (() => new Date().toISOString());
  const owns = (_method: string, parts: readonly string[]): boolean => parts[0] === "api" && parts[1] === "tavern";
  const presets = (): Preset[] => [defaultPreset(), ...store.list<Preset>("presets")];
  const preset = (id: unknown): Preset | null => id === "default" || id === undefined ? defaultPreset() : store.get<Preset>("presets", id);
  const listing = () => {
    const playthroughs = store.list<Playthrough>("playthroughs").sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt));
    return {
      characters: store.list<Character>("characters").map(item => characterSummary(item, playthroughs)), worldbooks: store.list<WorldBook>("worldbooks").map(bookSummary),
      presets: presets(), personas: store.list<Persona>("personas"), settings: normalizeSettings(store.settings()), playthroughs,
      limits: { cardBytes: MAX_CARD_BYTES, items: MAX_ITEMS },
    };
  };
  const ok = (extra: Row = {}): Reply => [200, { ok: true, ...extra, ...listing() }];
  const contextFor = (body: Row) => {
    const character = store.get<Character>("characters", body.characterId);
    if (!character) return null;
    const chosen = preset(body.presetId ?? normalizeSettings(store.settings()).activePresetId) ?? defaultPreset();
    const persona = typeof body.personaId === "string" ? store.get<Persona>("personas", body.personaId) : null;
    const settings = normalizeSettings(store.settings());
    const books = [...new Set([...ids(body.worldbooks), ...settings.globalWorldbooks])].map(id => store.get<WorldBook>("worldbooks", id)).filter((book): book is WorldBook => book !== null);
    return { character, preset: chosen, persona, books };
  };

  return {
    routes: TAVERN_ROUTES,
    owns,
    dispatch(method: string, parts: readonly string[], _query: Record<string, string[]>, data: unknown): Reply | null {
      if (!owns(method, parts)) return null;
      if (!options.enabled("tavern")) return [403, { error: "plugin disabled or dependency unavailable: tavern", plugin: "tavern" }];
      const body = isObject(data) ? data : {};
      const [, , kind, id, action] = parts;
      try {
        if (method === "GET" && parts.length === 2) return [200, listing()];
        if (method === "GET" && parts.length === 5 && kind === "avatars" && (id === "characters" || id === "personas")) {
          const item = store.get<{ avatar?: string }>(id, action);
          return item?.avatar ? [200, { ok: true, avatar: item.avatar }] : refuse("not_found", "that picture is not in the library");
        }
        if (method === "GET" && parts.length === 4 && (kind === "characters" || kind === "worldbooks")) {
          const item = store.get<Character | WorldBook>(kind, id);
          return item ? [200, { ok: true, item }] : refuse("not_found", "that item is not in the library");
        }
        if (method === "DELETE" && parts.length === 4 && ["characters", "worldbooks", "presets", "personas", "playthroughs"].includes(kind!)) {
          if (kind === "presets" && id === "default") return refuse("builtin", "the built-in preset cannot be removed");
          if (!store.remove(kind as TavernKind, id)) return refuse("not_found", "that item is not in the library");
          if (kind === "characters") for (const row of store.list<Playthrough>("playthroughs")) if (row.characterId === id) store.remove("playthroughs", row.id);
          return ok();
        }
        if (method !== "POST") return [405, { error: "method not allowed" }];

        if ((kind === "characters" || kind === "worldbooks") && parts.length === 3) {
          if (store.full(kind)) return refuse("library_full", `the library holds at most ${MAX_ITEMS} ${kind}`);
          const item = kind === "characters"
            ? isObject(body.character) && body.card === undefined ? editedCharacter(body.character, now())
              : { ...parseCharacter(body.card, body.fileName, now()), ...(avatarData(body.avatar) ? { avatar: avatarData(body.avatar) } : {}) }
            : isObject(body.create) && body.book === undefined ? editedWorldBook(body.create, now())
              : parseWorldBook(body.book, body.fileName, now());
          const replaced = store.get(kind, item.id) !== null;
          store.put(kind, item);
          return ok({ replaced, itemId: item.id });
        }
        if (kind === "characters" && parts.length === 4) {
          const existing = store.get<Character>("characters", id);
          if (!existing) return refuse("not_found", "that character is not in the library");
          const item = editedCharacter(isObject(body.character) ? body.character : {}, now(), existing);
          store.put("characters", item);
          return ok({ itemId: item.id, item });
        }
        if (kind === "worldbooks" && parts.length === 4) {
          const book = store.get<WorldBook>("worldbooks", id);
          if (!book) return refuse("not_found", "that world book is not in the library");
          if (isObject(body.book)) {
            const item = editedWorldBook(body.book, now(), book);
            store.put("worldbooks", item);
            return ok({ itemId: item.id, item });
          }
          const entries = book.entries.map(entry => ({ ...entry }));
          for (const patch of Array.isArray(body.entries) ? body.entries.slice(0, 1000) : []) {
            if (!isObject(patch) || !Number.isInteger(patch.index) || !entries[patch.index as number]) continue;
            const entry = entries[patch.index as number]!;
            if (typeof patch.enabled === "boolean") entry.enabled = patch.enabled;
            if (typeof patch.constant === "boolean") entry.constant = patch.constant;
          }
          store.put("worldbooks", { ...book, entries });
          return ok({ item: { ...book, entries } });
        }
        if (kind === "presets" && parts.length === 3) {
          const incoming = isObject(body.preset) ? body.preset : {};
          if (incoming.id === "default") return refuse("builtin", "copy the built-in preset to change it");
          const existing = typeof incoming.id === "string" ? store.get<Preset>("presets", incoming.id) : null;
          if (!existing && store.full("presets")) return refuse("library_full", "too many presets");
          const saved = normalizePreset(incoming, now(), existing?.id);
          store.put("presets", saved);
          return ok({ itemId: saved.id });
        }
        if (kind === "presets" && id === "import" && parts.length === 4) {
          if (store.full("presets")) return refuse("library_full", "too many presets");
          const { preset: saved, ignored } = importSillyTavernPreset(body.json, body.name, now());
          store.put("presets", saved);
          return ok({ itemId: saved.id, ignored });
        }
        if (kind === "personas" && parts.length === 3) {
          const persona = normalizePersona(body.persona, now());
          if (!store.get("personas", persona.id) && store.full("personas")) return refuse("library_full", "too many personas");
          store.put("personas", persona);
          return ok({ itemId: persona.id });
        }
        if (kind === "settings" && parts.length === 3) {
          store.saveSettings(normalizeSettings(body, store.settings()) as unknown as Row);
          return ok();
        }
        if (kind === "playthroughs" && parts.length === 3) {
          const context = contextFor(body);
          if (!context) return refuse("not_found", "that character is not in the library");
          if (store.full("playthroughs")) return refuse("library_full", "too many playthroughs; remove some first");
          const count = store.list<Playthrough>("playthroughs").filter(row => row.characterId === context.character.id).length;
          const stamp = now();
          const playthrough: Playthrough = {
            id: newId("pt"), title: typeof body.title === "string" && body.title.trim() ? body.title.trim().slice(0, 80) : `${context.character.name} #${count + 1}`,
            characterId: context.character.id, greeting: Math.max(0, Math.trunc(Number(body.greeting) || 0)), presetId: context.preset.id,
            personaId: context.persona?.id ?? null, worldbooks: ids(body.worldbooks), sessionId: null, createdAt: stamp, lastUsedAt: stamp,
          };
          store.put("playthroughs", playthrough);
          return ok({ playthrough });
        }
        if (kind === "playthroughs" && parts.length === 4) {
          const row = store.get<Playthrough>("playthroughs", id);
          if (!row) return refuse("not_found", "that playthrough no longer exists");
          const next: Playthrough = { ...row };
          if (typeof body.title === "string" && body.title.trim()) next.title = body.title.trim().slice(0, 80);
          if (body.presetId !== undefined) {
            if (!preset(body.presetId)) return refuse("not_found", "that preset is not in the library");
            next.presetId = String(body.presetId);
          }
          if (body.personaId !== undefined) {
            if (body.personaId !== null && !store.get<Persona>("personas", body.personaId)) return refuse("not_found", "that persona is not in the library");
            next.personaId = body.personaId === null ? null : String(body.personaId);
          }
          if (body.worldbooks !== undefined) next.worldbooks = ids(body.worldbooks).filter(book => store.get<WorldBook>("worldbooks", book) !== null);
          if (body.greeting !== undefined) next.greeting = Math.max(0, Math.trunc(Number(body.greeting) || 0));
          store.put("playthroughs", next);
          return ok({ playthrough: next });
        }
        if (kind === "preview" && parts.length === 3) {
          const context = contextFor(body);
          if (!context) return refuse("not_found", "that character is not in the library");
          const sample = typeof body.sample === "string" ? body.sample.slice(0, 4000) : "";
          const assembled = assembleRoleplay({ ...context, userName: "User", greeting: Number(body.greeting) || 0, history: sample ? [{ role: "user", content: sample }] : [], seed: "preview" });
          return [200, { ok: true, ...assembled, systemChars: assembled.system.length }];
        }
        if (kind === "brief" && parts.length === 3) {
          const character = store.get<Character>("characters", body.characterId);
          if (!character) return refuse("not_found", "that character is not in the library");
          const books = ids(body.worldbooks).map(item => store.get<WorldBook>("worldbooks", item)).filter((book): book is WorldBook => book !== null);
          const brief = roleplayBrief({ character, books, userName: typeof body.userName === "string" ? body.userName : "", greeting: typeof body.greeting === "number" ? body.greeting : 0 });
          return [200, { ok: true, character: character.name, ...brief }];
        }
        return [404, { error: "tavern route not found" }];
      } catch (error) {
        if (error instanceof CardError) return refuse(error.code, error.message);
        if (error instanceof Error && /preset|persona/.test(error.message)) return refuse("invalid", error.message);
        return refuse("storage_failed", "the tavern library could not complete the operation");
      }
    },
  };
}
