/** Tavern data as the panel sees it, and the calls that change it. */
import { del, get, post } from '@xueness/host';

export type SectionId = 'main' | 'persona' | 'description' | 'personality' | 'scenario' | 'worldBefore' | 'examples' | 'worldAfter';
export type CharacterRow = {
  id: string; name: string; creator: string; tags: string[]; spec: string; description: string; scenario: string; greetings: string[];
  bookEntries: number; hasExamples: boolean; hasSystemPrompt: boolean; fileName: string; avatar: string | null; playthroughs: number; importedAt: string;
  favorite?: boolean; updatedAt?: string; lastPlayedAt?: string | null;
};
export type SelectiveLogic = 'and_any' | 'not_all' | 'not_any' | 'and_all';
export type BookEntry = {
  keys: string[]; secondary: string[]; content: string; constant: boolean; enabled: boolean; order: number; comment: string;
  selectiveLogic?: SelectiveLogic; position?: 'before' | 'after'; probability?: number;
  caseSensitive?: boolean | null; matchWholeWords?: boolean | null; preventRecursion?: boolean;
};
export type Character = {
  id: string; name: string; description: string; personality: string; scenario: string; firstMessage: string; alternateGreetings: string[];
  exampleMessages: string; systemPrompt: string; postHistoryInstructions: string; creator: string; creatorNotes: string; tags: string[]; spec: string;
  book: BookEntry[]; avatar?: string; favorite?: boolean; importedAt?: string; updatedAt?: string;
};
export type BookRow = { id: string; name: string; description: string; entries: number; constant: number; disabled: number; fileName: string; updatedAt?: string };
export type WorldBook = { id: string; name: string; description: string; entries: BookEntry[] };
export type WorldInfoSettings = { scanDepth: number; budgetChars: number; recursive: boolean; maxRecursion: number; caseSensitive: boolean; matchWholeWords: boolean; includeCharacterBook: boolean };
export type Preset = {
  id: string; name: string; builtin?: boolean; mainPrompt: string; sections: { id: SectionId; enabled: boolean }[];
  preferCardSystemPrompt: boolean; postHistory: string; preferCardPostHistory: boolean; authorNote: { text: string; depth: number };
  worldInfo: WorldInfoSettings; greetingInHistory: boolean; noTools: boolean; updatedAt: string;
};
export type Persona = { id: string; name: string; description: string; updatedAt: string; avatar?: string; characterIds?: string[] };
export type Settings = { activePresetId: string; activePersonaId: string | null; globalWorldbooks: string[] };
export type Playthrough = { id: string; title: string; characterId: string; greeting: number; presetId: string; personaId: string | null; worldbooks: string[]; sessionId: string | null; createdAt: string; lastUsedAt: string };
export type Library = {
  characters: CharacterRow[]; worldbooks: BookRow[]; presets: Preset[]; personas: Persona[]; settings: Settings; playthroughs: Playthrough[];
  limits: { cardBytes: number; items: number };
};
export type Failure = { ok: false; error: { code: string; message: string } };
export type Changed = { ok: true; itemId?: string; ignored?: string[]; playthrough?: Playthrough; item?: unknown } & Library;
export type Preview = {
  ok: true; system: string; sections: { id: SectionId; title: string; text: string }[]; greeting: string; postHistory: string; systemChars: number;
  authorNote: { text: string; depth: number } | null; droppedEntries: number;
  activated: { name: string; source: string; reason: 'constant' | 'key' | 'recursion'; key: string; position: 'before' | 'after'; content?: string }[];
};
/** The character fields the panel writes. */
export type CharacterDraft = Omit<Character, 'id' | 'spec' | 'importedAt' | 'updatedAt' | 'avatar'> & { avatar?: string | null };

const API = '/api/tavern';
export const failed = (value: unknown): value is Failure => Boolean(value && typeof value === 'object' && (value as Failure).ok === false);

export const loadLibrary = () => get<Library>(API);
export const loadCharacter = (id: string) => get<{ ok: true; item: Character } | Failure>(`${API}/characters/${encodeURIComponent(id)}`);
export const loadBook = (id: string) => get<{ ok: true; item: WorldBook } | Failure>(`${API}/worldbooks/${encodeURIComponent(id)}`);
export const importCharacter = (card: string, fileName: string, avatar?: string) => post<Changed | Failure>(`${API}/characters`, { card, fileName, ...(avatar ? { avatar } : {}) });
export const importBook = (book: string, fileName: string) => post<Changed | Failure>(`${API}/worldbooks`, { book, fileName });
export const patchBook = (id: string, entries: { index: number; enabled?: boolean; constant?: boolean }[]) => post<Changed | Failure>(`${API}/worldbooks/${encodeURIComponent(id)}`, { entries });
export const savePreset = (preset: Partial<Preset>) => post<Changed | Failure>(`${API}/presets`, { preset });
export const importPreset = (json: string, name: string) => post<Changed | Failure>(`${API}/presets/import`, { json, name });
export const savePersona = (persona: Partial<Persona>) => post<Changed | Failure>(`${API}/personas`, { persona });
export const saveSettings = (settings: Partial<Settings>) => post<Changed | Failure>(`${API}/settings`, settings);
export const startPlaythrough = (input: { characterId: string; greeting: number; presetId: string; personaId: string | null; worldbooks: string[] }) =>
  post<Changed | Failure>(`${API}/playthroughs`, input);
export const renamePlaythrough = (id: string, title: string) => post<Changed | Failure>(`${API}/playthroughs/${encodeURIComponent(id)}`, { title });
export const updatePlaythrough = (id: string, patch: Partial<Pick<Playthrough, 'title' | 'presetId' | 'personaId' | 'worldbooks' | 'greeting'>>) =>
  post<Changed | Failure>(`${API}/playthroughs/${encodeURIComponent(id)}`, patch);
export const createCharacter = (character: Partial<CharacterDraft>) => post<Changed | Failure>(`${API}/characters`, { character });
export const updateCharacter = (id: string, character: Partial<CharacterDraft>) => post<Changed | Failure>(`${API}/characters/${encodeURIComponent(id)}`, { character });
export const createBook = (name: string) => post<Changed | Failure>(`${API}/worldbooks`, { create: { name } });
export const saveBook = (id: string, book: { name?: string; description?: string; entries?: BookEntry[] }) => post<Changed | Failure>(`${API}/worldbooks/${encodeURIComponent(id)}`, { book });

const LOGIC_INDEX: Record<SelectiveLogic, number> = { and_any: 0, not_all: 1, not_any: 2, and_all: 3 };

/** A SillyTavern V2 character card (`chara_card_v2`) of a character, with its embedded book. */
export function cardJson(character: Character): string {
  const data = {
    name: character.name, description: character.description, personality: character.personality, scenario: character.scenario,
    first_mes: character.firstMessage, mes_example: character.exampleMessages, creator_notes: character.creatorNotes, system_prompt: character.systemPrompt,
    post_history_instructions: character.postHistoryInstructions, alternate_greetings: character.alternateGreetings, tags: character.tags,
    creator: character.creator, character_version: '', extensions: {},
    ...(character.book.length ? { character_book: { name: character.name, entries: character.book.map((entry, index) => ({
      id: index, keys: entry.keys, secondary_keys: entry.secondary, content: entry.content, enabled: entry.enabled, constant: entry.constant,
      insertion_order: entry.order, comment: entry.comment, selective: entry.secondary.length > 0, position: entry.position === 'after' ? 'after_char' : 'before_char',
      extensions: entryExtensions(entry),
    })) } } : {}),
  };
  return JSON.stringify({ spec: 'chara_card_v2', spec_version: '2.0', data }, null, 2);
}
function entryExtensions(entry: BookEntry): Record<string, unknown> {
  return {
    selectiveLogic: LOGIC_INDEX[entry.selectiveLogic ?? 'and_any'], position: entry.position === 'after' ? 1 : 0,
    probability: entry.probability ?? 100, useProbability: entry.probability !== undefined,
    ...(entry.caseSensitive != null ? { case_sensitive: entry.caseSensitive } : {}), ...(entry.matchWholeWords != null ? { match_whole_words: entry.matchWholeWords } : {}),
    prevent_recursion: entry.preventRecursion === true,
  };
}

/** A SillyTavern world-info file of a book. */
export function bookJson(book: { name: string; description: string; entries: BookEntry[] }): string {
  const entries: Record<string, unknown> = {};
  book.entries.forEach((entry, uid) => {
    entries[uid] = {
      uid, key: entry.keys, keysecondary: entry.secondary, comment: entry.comment, content: entry.content, constant: entry.constant,
      selective: entry.secondary.length > 0, selectiveLogic: LOGIC_INDEX[entry.selectiveLogic ?? 'and_any'], order: entry.order,
      position: entry.position === 'after' ? 1 : 0, disable: !entry.enabled, probability: entry.probability ?? 100, useProbability: entry.probability !== undefined,
      caseSensitive: entry.caseSensitive ?? null, matchWholeWords: entry.matchWholeWords ?? null, preventRecursion: entry.preventRecursion === true,
    };
  });
  return JSON.stringify({ name: book.name, description: book.description, entries }, null, 2);
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) { let c = n; for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; table[n] = c >>> 0; }
  return table;
})();
function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * A PNG character card: the character's picture (or its initial), with the V2 card JSON in a `chara` text
 * chunk as SillyTavern writes it. The library keeps only a small picture, so the image is small too.
 */
export async function cardPng(character: Character): Promise<Blob> {
  const size = 400, canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('canvas unavailable');
  if (character.avatar) {
    const image = new Image();
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('picture unreadable')); image.src = character.avatar!; });
    context.drawImage(image, 0, 0, size, size);
  } else {
    let hash = 0;
    for (const char of character.name) hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
    context.fillStyle = `hsl(${hash % 360} 32% 82%)`; context.fillRect(0, 0, size, size);
    context.fillStyle = `hsl(${hash % 360} 30% 28%)`; context.font = '600 180px sans-serif'; context.textAlign = 'center'; context.textBaseline = 'middle';
    context.fillText(Array.from(character.name.trim())[0]?.toUpperCase() ?? '?', size / 2, size / 2 + 8);
  }
  const drawn = await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('png failed')), 'image/png'));
  const png = new Uint8Array(await drawn.arrayBuffer());
  const utf8 = new TextEncoder().encode(cardJson(character));
  let binary = '';
  for (let i = 0; i < utf8.length; i += 0x8000) binary += String.fromCharCode(...utf8.subarray(i, i + 0x8000));
  const payload = new TextEncoder().encode(`chara\u0000${btoa(binary)}`);
  const chunk = new Uint8Array(12 + payload.length), view = new DataView(chunk.buffer);
  view.setUint32(0, payload.length);
  chunk.set(new TextEncoder().encode('tEXt'), 4); chunk.set(payload, 8);
  view.setUint32(8 + payload.length, crc32(chunk.subarray(4, 8 + payload.length)));
  // The IEND chunk is the last 12 bytes of a PNG; the text chunk goes right before it.
  const end = png.length - 12, out = new Uint8Array(png.length + chunk.length);
  out.set(png.subarray(0, end)); out.set(chunk, end); out.set(png.subarray(end), end + chunk.length);
  return new Blob([out], { type: 'image/png' });
}

/** Save a file the page made (a card or a book) through the browser's download. */
export function saveFile(name: string, content: Blob | string, type = 'application/json'): void {
  const blob = typeof content === 'string' ? new Blob([content], { type }) : content;
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = name.replace(/[\\/:*?"<>|]+/g, '_').slice(0, 120) || 'tavern';
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
export const preview = (input: { characterId: string; greeting: number; presetId: string; personaId: string | null; worldbooks: string[]; sample?: string }) =>
  post<Preview | Failure>(`${API}/preview`, input);
export const remove = (kind: 'characters' | 'worldbooks' | 'presets' | 'personas' | 'playthroughs', id: string) =>
  del<Changed | Failure>(`${API}/${kind}/${encodeURIComponent(id)}`);
export const brief = (input: { characterId: string; greeting: number; worldbooks: string[]; userName: string }) =>
  post<{ ok: true; character: string; text: string } | Failure>(`${API}/brief`, input);

/** The card JSON inside a PNG character card: a `tEXt` chunk named `ccv3` (V3) or `chara` (V1/V2), base64 of UTF-8 JSON. */
export function cardJsonFromPng(bytes: Uint8Array): string | null {
  const text = (part: Uint8Array) => { let out = ''; for (let i = 0; i < part.length; i += 0x8000) out += String.fromCharCode(...part.subarray(i, i + 0x8000)); return out; };
  const found: Record<string, string> = {};
  for (let offset = 8; offset + 12 <= bytes.length;) {
    const length = ((bytes[offset]! << 24) | (bytes[offset + 1]! << 16) | (bytes[offset + 2]! << 8) | bytes[offset + 3]!) >>> 0;
    const type = text(bytes.subarray(offset + 4, offset + 8));
    if (type === 'IEND' || offset + 12 + length > bytes.length) break;
    if (type === 'tEXt') {
      const data = bytes.subarray(offset + 8, offset + 8 + length), split = data.indexOf(0);
      if (split > 0) found[text(data.subarray(0, split))] = text(data.subarray(split + 1));
    }
    offset += 12 + length;
  }
  const encoded = found.ccv3 ?? found.chara;
  if (!encoded) return null;
  try { return new TextDecoder().decode(Uint8Array.from(atob(encoded), char => char.charCodeAt(0))); } catch { return null; }
}

/** A small square picture of a PNG card for the library (WebP, or JPEG where WebP is unavailable), at most 64 KB. */
export const avatarFromPng = (file: File): Promise<string | undefined> => avatarFromImage(file);

/** A small square picture from any image the browser can read (PNG, JPEG, WebP, GIF), at most 64 KB. */
export async function avatarFromImage(file: Blob): Promise<string | undefined> {
  try {
    const bitmap = await createImageBitmap(file);
    const size = 192, canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const context = canvas.getContext('2d');
    if (!context) return undefined;
    const scale = Math.max(size / bitmap.width, size / bitmap.height);
    const width = bitmap.width * scale, height = bitmap.height * scale;
    // Character art is usually a portrait: keep the top, where the face is.
    context.drawImage(bitmap, (size - width) / 2, 0, width, height);
    bitmap.close();
    for (const [type, quality] of [['image/webp', 0.82], ['image/jpeg', 0.8], ['image/jpeg', 0.6]] as const) {
      const url = canvas.toDataURL(type, quality);
      if (url.startsWith(`data:${type}`) && url.length <= 64 * 1024) return url;
    }
  } catch { /* a picture is optional */ }
  return undefined;
}
