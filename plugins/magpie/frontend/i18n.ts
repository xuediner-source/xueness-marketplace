/**
 * Magpie's own English strings. The workbench translates only its own text, so this plugin carries the
 * translations of what it adds; anything not listed falls back to the workbench (server error texts too).
 */
import { t as hostT, tf as hostTf, useLocale, type Locale } from "@xueness/host";

const EN: Record<string, string> = {
  "Magpie 模型网关": "Magpie model gateway",
  "原版 magpie 本机网关。在这里启动它、使用它自己的控制台，并把它的模型用在 Xueness 的会话里。": "The original magpie local gateway. Start it here, use its own console, and use its models in Xueness conversations.",
  "运行状态": "Status", "已停止": "Stopped", "启动中": "Starting", "运行中": "Running", "停止中": "Stopping", "失败": "Failed",
  "启动": "Start", "停止": "Stop", "重启": "Restart", "重试启动": "Retry start", "重试": "Retry",
  "网关地址": "Gateway URL", "复制网关地址": "Copy gateway URL",
  "账号发现": "Account discovery",
  "读取你自己已登录的命令行工具账号；关闭后订阅登录也会一并停用。更改会重启 magpie。": "Reads the accounts your own signed-in command-line tools already use. Turning it off also disables subscription sign-ins. Changing it restarts magpie.",
  "最近输出": "Recent output",
  "无法读取 magpie 状态": "Could not read magpie status", "正在加载…": "Loading…", "加载失败": "Failed to load",
  "magpie 未运行": "magpie is not running", "magpie 启动失败": "magpie failed to start",
  "magpie 正在启动…": "Starting magpie…", "magpie 正在停止…": "Stopping magpie…",
  "通常需要几秒钟。": "This usually takes a few seconds.",
  "启动后即可使用 magpie 控制台，它的模型也会出现在会话的模型选择里。": "Start it to use the magpie console; its models also show up in the conversation model picker.",
  "Magpie 控制台": "Magpie console", "在 Xueness 中使用": "Use in Xueness", "magpie 控制台": "magpie console",
  "这是 magpie 原版控制台：供应商、API 密钥、登录账号、路由组、额度与用量都在这里管理。": "This is magpie's own console: manage providers, API keys, sign-in accounts, routing groups, quotas and usage here.",
  "重新载入": "Reload", "在浏览器中打开": "Open in browser", "在系统浏览器中打开 magpie 控制台": "Open the magpie console in your system browser",
  "正在打开控制台…": "Opening the console…",
  "magpie 控制台里配置的模型和路由组会出现在这里，也会出现在会话的模型选择和「模型设置」里。": "Models and routing groups set up in the magpie console show up here, in the conversation model picker and in Model settings.",
  "搜索模型": "Search models", "刷新": "Refresh",
  "还没有模型。在「Magpie 控制台」里添加供应商或登录账号后，点「刷新」。": "No models yet. Add a provider or sign in to an account in the Magpie console, then choose Refresh.",
  "没有匹配的模型。": "No matching models.", "路由组": "Routing group", "上下文窗口": "Context window", "在会话中使用": "Use in conversation",
  // Server error texts surfaced through the panel.
  "magpie 插件已停用": "The magpie plugin is disabled",
  "内置的 magpie 程序缺失": "The bundled magpie binary is missing",
  "magpie 没有在预期时间内启动": "magpie did not start within the expected time",
  "无法连接 magpie": "Could not reach magpie",
  "magpie 拒绝了请求": "magpie rejected the request",
};
const FORMATS: Record<string, string> = {
  "magpie {0}": "magpie {0}", "{0} 个模型": "{0} models",
};

export type Tr = { t: (text: string) => string; tf: (text: string, values: unknown[]) => string; locale: Locale };

/** Translation for the current interface language; re-renders when it changes. */
export function useTr(): Tr {
  const locale = useLocale();
  return {
    locale,
    t: text => locale === "en" ? EN[text] ?? hostT(text) : text,
    tf: (text, values) => locale === "en" && FORMATS[text]
      ? FORMATS[text]!.replace(/\{(\d+)\}/g, (_, index) => String(values[Number(index)] ?? ""))
      : hostTf(text, values),
  };
}
