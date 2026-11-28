# Magpie 模型网关 · `magpie`

Xueness 的可下载官方插件。它不改写 magpie：包里是 [yetone/magpie](https://github.com/yetone/magpie)（MIT，Copyright (c) 2026 yetone）发布页 [yetone/magpie-releases](https://github.com/yetone/magpie-releases) 的**原版命令行程序**（`magpie-cli-<os>-<arch>`，按平台各一个包），外加一层 Xueness 适配：

- 后端（`backend/src`）在用户启用插件后按需启动 `magpie serve --web=127.0.0.1:<网页端口>`，数据放在 Xueness 状态目录的 `magpie/` 下（`XDG_CONFIG_HOME`/`XDG_CACHE_HOME` 指向这里），固定自己的网关端口与网页密钥，关闭遥测（`DO_NOT_TRACK=1`、`MAGPIE_NO_STATS=1`）与自动更新；禁用或卸载插件时通过 `POST /api/window/quit` 正常退出，超时再结束进程。
- magpie 的模型与路由组经它的 OpenAI 兼容网关进入 Xueness 的会话模型选择，并在「模型设置」里以只读的「Magpie 模型网关」分组列出（可设为当前运行所用模型，或跳到本插件管理）。
- 界面（`frontend/`）只做适配，不另做一套管理界面：顶部是进程状态条（启动、停止、重启、账号发现开关、网关地址、最近输出），下面两个视图——「Magpie 控制台」把 magpie 原版网页控制台内嵌进来（供应商、密钥、登录账号、路由组、额度与用量都在那里管理，也可在系统浏览器中打开），「在 Xueness 中使用」列出它的模型并刷新会话的模型列表。

The original magpie CLI binary is bundled unmodified (one package per platform); the version and the SHA-256 of every binary are pinned in `backend/upstream.json`. `scripts/build.ts` reads the binaries from a local folder (`--bin-dir`), checks them against those digests and never downloads anything.

## Xueness 接口约定 · Route contract

All routes live under `/api/magpie` in the Xueness server, are only served while the plugin is enabled and installed (otherwise `403 {error, plugin: "magpie"}`), and answer JSON. The adapter talks to magpie from the backend only: magpie's page key and port never reach the browser, except through `GET /console`, which the panel asks for only while magpie is running and the user has its console view or the open-in-browser button in front of them (the embedded console is an iframe on that address). The provider, account, routing-group and usage routes below stay part of the contract for scripts and tests; the 1.1 panel leaves that management to magpie's own console. Field values that magpie does not report are `null`, never invented.

Routes marked *(starts)* start magpie on demand when it is stopped; the others never start it.

### Process

| Method & path | Body | Answer |
|---|---|---|
| `GET /status` | – | `Status` |
| `POST /start` | – | `Status` (waits until ready, at most 60 s) |
| `POST /stop` | – | `Status` |
| `POST /restart` | – | `Status` |
| `POST /settings` | `{accountDiscovery?: boolean}` | `Status` (restarts a running magpie when the value changes) |
| `GET /console` *(starts)* | – | `{url}`: magpie's own web console, `http://127.0.0.1:<webPort>/?k=<key>` |

```ts
type Status = {
  state: "stopped" | "starting" | "running" | "stopping" | "failed";
  version: string | null;          // reported by the running magpie
  bundledVersion: string;          // from upstream.json, e.g. "0.1.4685"
  gatewayUrl: string;              // "http://127.0.0.1:<port>/v1" (also while stopped)
  pid: number | null;
  startedAt: string | null;        // ISO time
  accountDiscovery: boolean;       // false = MAGPIE_NO_ACCOUNTS=1 (also disables subscription sign-ins)
  error: string | null;            // last start/stop failure, user-readable
  log: string[];                   // last ≤ 40 lines of magpie's stdout/stderr, secrets not included
};
```

### Overview

`GET /overview` *(starts)* → `{status: Status, counts: {providers, keys, accounts, models, groups}, quotas: Quota[], usage: UsageTotals | null}` — one call for the dashboard tab.

### Providers and API keys

| Method & path | Body | Answer |
|---|---|---|
| `GET /providers` *(starts)* | – | `{providers: Provider[]}` |
| `GET /presets` *(starts)* | – | `{presets: Preset[]}` (API-key presets magpie knows) |
| `POST /providers` *(starts)* | `{preset?: string, name?: string, baseUrl?: string, protocol?: "openai" \| "anthropic" \| "gemini", apiKey?: string}` | `{provider: Provider}` |
| `POST /providers/:id/:action` *(starts)* | `{}` | `{ok: true, provider: Provider \| null, message?: string}`; `action` ∈ `enable`, `disable`, `delete`, `test`, `refresh-models` |
| `POST /providers/:id/keys` *(starts)* | `{apiKey: string, label?: string}` | `{provider: Provider}` |
| `DELETE /providers/:id/keys/:keyId` *(starts)* | – | `{provider: Provider}` |

```ts
type Provider = {
  id: string; name: string;
  kind: "key" | "subscription" | "local" | "plugin";
  enabled: boolean;
  baseUrl: string | null; protocol: string | null;
  keys: { id: string; label: string; masked: string; enabled: boolean }[];   // never the secret
  models: number | null;                                                       // count magpie lists
  balance: string | null;                                                      // e.g. "$12.30", when magpie reports it
};
type Preset = { id: string; name: string; protocol: string | null; baseUrl: string | null; needsKey: boolean };
```

### Sign-in accounts and quotas

| Method & path | Body | Answer |
|---|---|---|
| `GET /accounts` *(starts)* | – | `{accounts: Account[], discovery: boolean}` |
| `POST /accounts/:id/:action` *(starts)* | `{}` | `{accounts: Account[]}`; `action` ∈ `enable`, `disable`, `forget`, `switch` |
| `GET /signin/agents` *(starts)* | – | `{agents: {id: string, name: string}[]}` (subscriptions magpie can sign in to directly) |
| `POST /signin` *(starts)* | `{agent: string}` | `SignIn` |
| `GET /signin/:id` *(starts)* | – | `SignIn` |
| `POST /signin/:id/cancel` *(starts)* | – | `SignIn` |
| `POST /signin/:id/callback` *(starts)* | `{url: string}` | `SignIn` (finish by pasting the address the browser ended on) |
| `GET /quotas` *(starts)* | – | `{quotas: Quota[]}` |

```ts
type Account = {
  id: string; agent: string; provider: string;
  label: string;                  // display name / masked e-mail, as magpie shows it
  plan: string | null; enabled: boolean; active: boolean;
  windows: QuotaWindow[];
};
type QuotaWindow = { name: string; usedPercent: number | null; resetsAt: string | null };
type Quota = { provider: string; account: string; plan: string | null; windows: QuotaWindow[] };
type SignIn = {
  id: string; agent: string;
  state: "installing" | "waiting" | "done" | "failed" | "canceled";
  url: string | null; code: string | null;          // open url; show code for device flows
  pasteCallback: boolean;                           // the UI should offer "paste the final address"
  error: string | null;
};
```

### Routing groups

| Method & path | Body | Answer |
|---|---|---|
| `GET /groups` *(starts)* | – | `{groups: Group[]}` |
| `POST /groups` *(starts)* | `{name: string, mode: GroupMode, members: string[]}` | `{group: Group}` |
| `POST /groups/:id` *(starts)* | `{name?, mode?, members?, enabled?}` | `{group: Group}` |
| `DELETE /groups/:id` *(starts)* | – | `{ok: true}` |

```ts
type GroupMode = "smart" | "order" | "rotate" | "usage" | "pace";
type Group = { id: string; name: string; mode: GroupMode; enabled: boolean; members: { model: string; account: string | null }[] };
```

### Models and usage

| Method & path | Answer |
|---|---|
| `GET /models` *(starts)* | `{models: Model[]}` — also refreshes the list the composer shows |
| `GET /usage?period=today\|week\|month` *(starts)* | `UsageReport` |

```ts
type Model = { id: string; name: string; provider: string | null; group: boolean; contextWindow: number | null;
  profileId: string };   // the composer id ("magpie.<slug>.<hash8>"), what "use in conversation" selects
type UsageTotals = { requests: number; inputTokens: number; outputTokens: number; cost: number | null; currency: string | null };
type UsageReport = { period: string; totals: UsageTotals; byModel: (UsageTotals & { model: string })[]; byAccount: (UsageTotals & { account: string })[] };
```

Errors: `400 {error}` for a bad body, `404 {error}` for an unknown id, `502 {error, detail?}` when magpie refuses or answers unexpectedly, `503 {error}` when magpie cannot start. `error` is a short user-readable sentence (Chinese is fine; the UI passes it through `t()`).

## Composer models

The adapter keeps the last `/v1/models` answer in `<state>/magpie/models.json` and publishes each entry as an account-backed profile: `id: Model.profileId` (Xueness profile ids allow only `[A-Za-z0-9._-]{1,64}`, so it is `magpie.` + a slug of magpie's id + `.` + the first 8 hex of its SHA-256), `model: <magpie's real id>`, `source: "subscription"`, `subscriptionId: "magpie"`, base URL the gateway, standard runtime only. Choosing one starts magpie on first use. Routing groups are listed first.

## 许可 · License

magpie: MIT, Copyright (c) 2026 yetone — `backend/assets/LICENSE-magpie.txt` ships in every package. This adapter: Apache-2.0, like the rest of this repository.
