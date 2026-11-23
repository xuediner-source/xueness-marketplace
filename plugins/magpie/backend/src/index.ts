/**
 * Magpie model gateway: a plugin-owned instance of the original magpie
 * program (yetone/magpie, MIT) that keeps API keys, subscription sign-ins and
 * routing groups, and exposes its models and groups to conversations.
 *
 * The plugin starts nothing at boot. magpie is started on the first request
 * that needs it, so a disabled or unused plugin costs no process.
 */
import { definePlugin, type BundledPlugin } from "@xueness/kernel";
import manifest from "../manifest.json" with { type: "json" };

export { createMagpie, type MagpieOptions } from "./api.ts";
export { MagpieError } from "./client.ts";
export { createMagpieHttp, MAGPIE_ROUTES, ownsMagpieRoute, type MagpieHttpOptions, type MagpieService } from "./http.ts";
export { ensureLayout, magpieLayout, readRuntime, writeRuntime, type Layout, type Runtime } from "./layout.ts";
export { isGroupId, modelsFromGateway, type Model } from "./models.ts";
export { createProfiles, ModelStore, PROFILE_PREFIX, type MagpieProfiles } from "./profiles.ts";
export { ADAPTER_OUTPUT_CAP, GATEWAY_TOKEN, MagpieProvider } from "./provider.ts";
export { MagpieStartError, Supervisor, type ProcessStatus } from "./supervisor.ts";

export const magpie: BundledPlugin = { manifest, plugin: definePlugin({ name: "magpie", apply() {} }) };
