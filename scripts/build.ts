/**
 * Build the downloadable plugin packages and their pins.
 *
 *   node scripts/build.ts [--core <path>] [--write-core] [--prune]
 *
 * --core        the Xueness checkout to build against (default: ../xueness). Its
 *               webapp toolchain builds the interfaces, and its descriptors are
 *               checked against the manifests here.
 * --write-core  copy the new pins into the checkout's kernel
 *               (ts/packages/kernel/src/optional-packages.json), which is what
 *               makes a core build trust these exact packages.
 * --prune       delete package files in packages/ that the new pins do not name.
 *               Leave them by default: a released core pins its own versions.
 *
 * For each plugin a package is `{id, version, files[]}` as gzipped JSON:
 *   backend/package.json, backend/manifest.json, backend/src/**, the manifest's
 *   backendAssets and dataFiles, and frontend/optional-<id>.js (+ .css).
 * The pin is the SHA-256 and size of the uncompressed JSON, not of the gzip
 * stream, which differs between zlib builds for identical input.
 */
import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { gzipSync } from "node:zlib";

const REPO = resolve(import.meta.dirname, "..");
const URL_BASE = "https://raw.githubusercontent.com/xuediner-source/xueness-marketplace/main/packages/";
/** Globals the workbench sets before it loads a plugin (webapp/src/plugins/extensions/optionalFrontend.ts in core). */
const HOST_GLOBALS = { react: "__xnHostReact", "react/jsx-runtime": "__xnHostJsx", "@xueness/host": "__xnHost" } as const;

const args = process.argv.slice(2);
const flag = (name: string): boolean => args.includes(name);
const option = (name: string): string | undefined => { const at = args.indexOf(name); return at >= 0 ? args[at + 1] : undefined; };
const core = resolve(REPO, option("--core") ?? "../xueness");
if (!existsSync(join(core, "ts/packages/kernel/src/optional-packages.ts"))) throw new Error(`Not a Xueness checkout: ${core} (pass --core <path>)`);

const sha = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");
const readJson = (path: string): Record<string, unknown> => JSON.parse(readFileSync(path, "utf8"));
function walk(directory: string, prefix: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, "en")).flatMap((entry) => {
    const relative = `${prefix}/${entry.name}`, path = join(directory, entry.name);
    if (lstatSync(path).isSymbolicLink()) throw new Error(`Refusing a link: ${relative}`);
    return entry.isDirectory() ? walk(path, relative) : [relative];
  });
}

// The core's allowlist decides which plugins may load code at all, and in which order they are pinned.
const ids = (/OPTIONAL_IDS = \[([^\]]+)\]/.exec(readFileSync(join(core, "ts/packages/kernel/src/optional-packages.ts"), "utf8"))?.[1] ?? "")
  .split(",").map((item) => item.trim().replace(/["']/g, "")).filter(Boolean);
const here = readdirSync(join(REPO, "plugins")).filter((name) => existsSync(join(REPO, "plugins", name, "backend/manifest.json"))).sort();
if (!ids.length || !isDeepStrictEqual([...ids].sort(), here)) throw new Error(`Plugins here (${here.join(", ")}) differ from the core allowlist (${ids.join(", ")})`);

const webapp = createRequire(join(core, "webapp/package.json"));
const vite = await import(pathToFileURL(webapp.resolve("vite")).href) as typeof import("vite");
const lucide = join(core, "webapp/node_modules/lucide-react", readJson(join(core, "webapp/node_modules/lucide-react/package.json")).module as string);

/** One IIFE per plugin that reads React, its JSX runtime and the host API from the workbench's globals. */
async function buildFrontend(id: string): Promise<{ name: string; bytes: Buffer }[]> {
  const source = join(REPO, "plugins", id, "frontend"), out = mkdtempSync(join(tmpdir(), `xn-market-${id}-`));
  try {
    await vite.build({
      configFile: false, logLevel: "warn", root: source,
      resolve: { alias: [{ find: /^lucide-react$/, replacement: lucide }] },
      esbuild: { jsx: "automatic", legalComments: "none" },
      define: { "process.env.NODE_ENV": JSON.stringify("production") },
      build: {
        outDir: out, emptyOutDir: true, minify: true, target: "es2022", cssCodeSplit: false, reportCompressedSize: false, copyPublicDir: false,
        lib: { entry: join(source, "entry.ts"), formats: ["iife"], name: `__xn_optional_${id}`, fileName: () => `optional-${id}.js`, cssFileName: `optional-${id}` },
        rollupOptions: {
          external: Object.keys(HOST_GLOBALS), output: { globals: HOST_GLOBALS },
          // lucide-react marks its modules "use client"; that directive means nothing in a browser bundle.
          onwarn(warning, warn) { if (warning.code !== "MODULE_LEVEL_DIRECTIVE") warn(warning); },
        },
      },
    });
    const built = readdirSync(out).sort();
    if (!built.includes(`optional-${id}.js`)) throw new Error(`Vite did not produce optional-${id}.js (got ${built.join(", ")})`);
    const unexpected = built.filter((name) => name !== `optional-${id}.js` && name !== `optional-${id}.css`);
    if (unexpected.length) throw new Error(`Unexpected interface files for ${id}: ${unexpected.join(", ")}`);
    return built.map((name) => ({ name, bytes: readFileSync(join(out, name)) }));
  } finally { rmSync(out, { recursive: true, force: true }); }
}

const packages = join(REPO, "packages"); mkdirSync(packages, { recursive: true });
const pins: Record<string, unknown> = {};
for (const id of ids) {
  const backend = join(REPO, "plugins", id, "backend");
  const manifest = readJson(join(backend, "manifest.json"));
  // Core keeps each plugin's descriptor (catalog, routes, features). It must be the manifest that ships.
  for (const file of ["manifest.json", "package.json"]) {
    const descriptor = join(core, "ts/plugins", id, file);
    if (!existsSync(descriptor) || !isDeepStrictEqual(readJson(descriptor), readJson(join(backend, file)))) throw new Error(`${id}/${file} differs from the core descriptor ts/plugins/${id}/${file}`);
  }
  const packageId = manifest.installPackage;
  if (typeof packageId !== "string" || !packageId || manifest.id !== id || typeof manifest.version !== "string") throw new Error(`${id}: manifest needs id, version and installPackage`);
  const paths = [...new Set(["package.json", "manifest.json", ...walk(join(backend, "src"), "src"),
    ...(manifest.backendAssets as string[] | undefined ?? []), ...(manifest.dataFiles as string[] | undefined ?? [])])].sort();
  const files: { path: string; bytes: Buffer; executable: boolean }[] = paths.map((path) => {
    if (path.includes("..") || path.includes("auths") || path.includes("\\") || lstatSync(join(backend, path)).isSymbolicLink()) throw new Error(`Unsafe source path ${id}/${path}`);
    const stat = lstatSync(join(backend, path));
    return { path: `backend/${path}`, bytes: readFileSync(join(backend, path)), executable: (stat.mode & 0o111) !== 0 && /\.(?:sh|mjs)$/.test(path) };
  });
  files.push(...(await buildFrontend(id)).map((file) => ({ path: `frontend/${file.name}`, bytes: file.bytes, executable: false })));
  const plain = Buffer.from(JSON.stringify({ id, version: manifest.version, files: files.map((file) => ({ path: file.path, content: file.bytes.toString("base64") })) }));
  const digest = sha(plain), filename = `${packageId}-${manifest.version}-${digest.slice(0, 16)}.json.gz`;
  writeFileSync(join(packages, filename), gzipSync(plain, { level: 9 }));
  pins[id] = { id, packageId, version: manifest.version, sha256: digest, bytes: plain.length, url: URL_BASE + filename,
    files: files.map((file) => ({ path: file.path, bytes: file.bytes.length, sha256: sha(file.bytes), executable: file.executable })) };
  process.stdout.write(`${id}: ${filename} (${files.length} files, ${plain.length} bytes)\n`);
}

const encoded = JSON.stringify(pins, null, 2) + "\n";
writeFileSync(join(REPO, "pins.json"), encoded);
if (flag("--prune")) {
  const keep = new Set(Object.values(pins).map((pin) => (pin as { url: string }).url.slice(URL_BASE.length)));
  for (const name of readdirSync(packages)) if (name.endsWith(".json.gz") && !keep.has(name)) { rmSync(join(packages, name)); process.stdout.write(`pruned ${name}\n`); }
}
if (flag("--write-core")) {
  writeFileSync(join(core, "ts/packages/kernel/src/optional-packages.json"), encoded);
  // Keep an existing generated backend consistent with the source pins.
  for (const path of ["ts/dist/packages/kernel/src/optional-packages.json", "ts/dist/node_modules/@xueness/kernel/src/optional-packages.json"]) {
    if (existsSync(join(core, path))) writeFileSync(join(core, path), encoded);
  }
  process.stdout.write(`Pins written to ${join(core, "ts/packages/kernel/src/optional-packages.json")}\n`);
}
