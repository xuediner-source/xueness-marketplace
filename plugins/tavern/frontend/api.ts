/** Tavern data as the panel sees it, and the calls that change it. */
import { del, get, post } from '@xueness/host';

export type SectionId = 'main' | 'persona' | 'description' | 'personality' | 'scenario' | 'worldBefore' | 'examples' | 'worldAfter';
export type CharacterRow = {
  id: string; name: string; creator: string; tags: string[]; spec: string; description: string; scenario: string; greetings: string[];
  bookEntries: number; hasExamples: boolean; hasSystemPrompt: boolean; fileName: string; avatar: string | null; playthroughs: number; importedAt: string;
};
export type BookEntry = {
  keys: string[]; secondary: string[]; content: string; constant: boolean; enabled: boolean; order: number; comment: string;
  selectiveLogic?: 'and_any' | 'not_all' | 'not_any' | 'and_all'; position?: 'before' | 'after'; probability?: number;
};
export type Character = {
  id: string; name: string; description: string; personality: string; scenario: string; firstMessage: string; alternateGreetings: string[];
  exampleMessages: string; systemPrompt: string; postHistoryInstructions: string; creator: string; creatorNotes: string; tags: string[]; spec: string;
  book: BookEntry[]; avatar?: string;
};
export type BookRow = { id: string; name: string; description: string; entries: number; constant: number; disabled: number; fileName: string };
export type WorldBook = { id: string; name: string; description: string; entries: BookEntry[] };
export type WorldInfoSettings = { scanDepth: number; budgetChars: number; recursive: boolean; maxRecursion: number; caseSensitive: boolean; matchWholeWords: boolean; includeCharacterBook: boolean };
export type Preset = {
  id: string; name: string; builtin?: boolean; mainPrompt: string; sections: { id: SectionId; enabled: boolean }[];
  preferCardSystemPrompt: boolean; postHistory: string; preferCardPostHistory: boolean; authorNote: { text: string; depth: number };
  worldInfo: WorldInfoSettings; greetingInHistory: boolean; noTools: boolean; updatedAt: string;
};
export type Persona = { id: string; name: string; description: string; updatedAt: string };
export type Settings = { activePresetId: string; activePersonaId: string | null; globalWorldbooks: string[] };
export type Playthrough = { id: string; title: string; characterId: string; greeting: number; presetId: string; personaId: string | null; worldbooks: string[]; sessionId: string | null; createdAt: string; lastUsedAt: string };
export type Library = {
  characters: CharacterRow[]; worldbooks: BookRow[]; presets: Preset[]; personas: Persona[]; settings: Settings; playthroughs: Playthrough[];
  limits: { cardBytes: number; items: number };
};
export type Failure = { ok: false; error: { code: string; message: string } };
export type Changed = { ok: true; itemId?: string; ignored?: string[]; playthrough?: Playthrough } & Library;
export type Preview = {
  ok: true; system: string; sections: { id: SectionId; title: string; text: string }[]; greeting: string; postHistory: string; systemChars: number;
  authorNote: { text: string; depth: number } | null; droppedEntries: number;
  activated: { name: string; source: string; reason: 'constant' | 'key' | 'recursion'; key: string; position: 'before' | 'after' }[];
};

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
export async function avatarFromPng(file: File): Promise<string | undefined> {
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
