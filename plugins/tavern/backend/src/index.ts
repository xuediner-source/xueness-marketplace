/**
 * Tavern: roleplay with SillyTavern-compatible character cards, world books, prompt presets and personas.
 * An official optional plugin, downloaded from the plugin center; off until installed and enabled.
 *
 * Cards and books are imported as data. A roleplay chat is an ordinary Xueness session that the Tavern
 * starts and tags with a playthrough; for those sessions the host calls `prepareRoleplayRequest` before
 * each model request, and the request is rebuilt from the character, persona, preset and world books.
 */
import { definePlugin, type BundledPlugin } from "@xueness/kernel";
import manifest from "../manifest.json" with { type: "json" };

export { avatarData, bookEntries, CardError, contentId, MAX_CARD_BYTES, parseCharacter, parseWorldBook, type BookEntry, type Character, type SelectiveLogic, type WorldBook } from "./cards.ts";
export { assembleRoleplay, fillMacros, greetingsOf, type Assembled, type AssembleInput } from "./assemble.ts";
export { createTavernHttp, TAVERN_ROUTES, type TavernHttpOptions } from "./http.ts";
export { defaultPreset, importSillyTavernPreset, normalizePersona, normalizePreset, normalizeSettings, SECTION_IDS, type Persona, type Playthrough, type Preset, type SectionId, type TavernSettings, type WorldInfoSettings } from "./presets.ts";
export { applyMacros, roleplayBrief, selectEntries, type Brief, type BriefInput } from "./prompt.ts";
export { prepareRoleplayRequest, roleplayContext, type RoleplayRequest } from "./roleplay.ts";
export { TavernStore, type TavernKind } from "./store.ts";
export { activateWorldInfo, keyMatcher, type Activated, type Activation } from "./worldinfo.ts";

export const tavern: BundledPlugin = { manifest, plugin: definePlugin({ name: "tavern", apply() {} }) };
