/**
 * Magpie's own English strings. The workbench translates only its own text, so this plugin carries the
 * translations of what it adds; anything not listed falls back to the workbench (server error texts too).
 */
import { t as hostT, tf as hostTf, useLocale, type Locale } from "@xueness/host";

const EN: Record<string, string> = {
  "Magpie 模型网关": "Magpie model gateway",
  "管理 magpie 的账号、API 密钥、路由组、额度与用量；它的模型会出现在会话的模型选择里。": "Manage magpie's accounts, API keys, routing groups, quotas and usage; its models show up in the conversation model picker.",
  "运行状态": "Status", "已停止": "Stopped", "启动中": "Starting", "运行中": "Running", "停止中": "Stopping", "失败": "Failed",
  "启动": "Start", "停止": "Stop", "重启": "Restart", "重试启动": "Retry start", "重试": "Retry",
  "打开完整 magpie 控制台": "Open full magpie console", "网关地址": "Gateway URL", "复制网关地址": "Copy gateway URL",
  "账号发现": "Account discovery",
  "读取你自己已登录的命令行工具账号；关闭后订阅登录也会一并停用。更改会重启 magpie。": "Reads the accounts your own signed-in command-line tools already use. Turning it off also disables subscription sign-ins. Changing it restarts magpie.",
  "最近输出": "Recent output",
  "无法读取 magpie 状态": "Could not read magpie status", "正在加载…": "Loading…", "加载失败": "Failed to load",
  "magpie 未运行": "magpie is not running", "magpie 启动失败": "magpie failed to start",
  "magpie 正在启动…": "Starting magpie…", "magpie 正在停止…": "Stopping magpie…",
  "通常需要几秒钟。": "This usually takes a few seconds.", "启动后才能查看和修改这里的内容。": "Start magpie to view and change this.",
  "概览": "Overview", "供应商与密钥": "Providers & keys", "登录账号": "Sign-in accounts", "路由组": "Routing groups", "模型": "Models", "用量": "Usage",
  "数量": "Counts", "供应商": "Providers", "API 密钥": "API keys", "额度": "Quotas", "今日用量": "Usage today",
  "还没有可显示的额度。登录订阅账号后会出现在这里。": "No quotas to show yet. Sign in to a subscription and it appears here.",
  "暂无用量数据。": "No usage data yet.", "请求": "Requests", "输入 Token": "Input tokens", "输出 Token": "Output tokens", "费用": "Cost",
  "没有额度信息": "No quota information", "即将": "soon",
  "时间范围": "Period", "今天": "Today", "近 7 天": "Last 7 days", "近 30 天": "Last 30 days", "合计": "Totals",
  "按模型": "By model", "按账号": "By account", "账号": "Account", "这段时间没有记录。": "Nothing recorded in this period.",
  "搜索模型": "Search models", "还没有模型。添加供应商密钥或登录账号后会出现在这里。": "No models yet. Add a provider key or sign in to an account and they appear here.",
  "没有匹配的模型。": "No matching models.", "上下文窗口": "Context window", "在会话中使用": "Use in conversation",
  "添加供应商": "Add provider", "还没有供应商。添加一个 API 密钥开始使用。": "No providers yet. Add an API key to get started.",
  "密钥": "Key", "订阅": "Subscription", "本地": "Local", "插件": "Plugin", "余额": "Balance", "已停用": "Disabled",
  "移除密钥": "Remove key", "添加密钥": "Add key", "测试": "Test", "测试中…": "Testing…", "刷新模型": "Refresh models", "刷新中…": "Refreshing…",
  "删除": "Delete", "删除供应商": "Delete provider", "连接正常": "Connection OK",
  "类型": "Type", "自定义": "Custom", "名称": "Name", "接口地址": "Base URL", "协议": "Protocol", "OpenAI 兼容": "OpenAI-compatible",
  "API 密钥（可选）": "API key (optional)", "备注（可选）": "Label (optional)", "添加": "Add", "取消": "Cancel", "关闭": "Close",
  "登录": "Sign in", "登录订阅账号": "Sign in to a subscription", "还没有登录账号。点击「登录」使用你的订阅。": "No sign-in accounts yet. Click “Sign in” to use your subscription.",
  "账号发现已关闭，订阅登录不可用。可在上方状态栏重新开启。": "Account discovery is off, so subscription sign-ins are unavailable. Turn it back on in the status strip above.",
  "当前使用": "In use", "切换到此账号": "Switch to this account", "停用": "Disable", "启用": "Enable", "移除": "Remove", "移除账号": "Remove account",
  "登录方式": "Sign in with", "没有可直接登录的订阅。请先开启账号发现。": "No subscriptions to sign in to directly. Turn on account discovery first.",
  "正在准备…": "Preparing…", "等待登录完成": "Waiting for sign-in to finish", "登录成功": "Signed in", "登录失败": "Sign-in failed", "已取消": "Canceled",
  "打开登录页面": "Open the sign-in page", "复制登录链接": "Copy sign-in link", "设备码": "Device code", "复制设备码": "Copy device code",
  "登录后浏览器最终停留的地址": "The address the browser ends on after signing in", "提交": "Submit",
  "如果页面显示无法访问，把地址栏里的完整地址粘贴到这里。": "If the page says it cannot be reached, paste the full address from the address bar here.",
  "取消登录": "Cancel sign-in", "完成": "Done", "开始登录": "Start sign-in",
  "新建路由组": "New routing group", "编辑路由组": "Edit routing group", "编辑": "Edit", "保存": "Save", "删除路由组": "Delete routing group",
  "还没有路由组。路由组把多个模型合成一个名字，按规则分配请求。": "No routing groups yet. A group combines several models under one name and spreads requests by a rule.",
  "没有成员": "No members", "分配方式": "Routing mode", "添加模型": "Add models", "从下面的列表添加模型。": "Add models from the list below.", "没有可添加的模型。": "No models to add.",
  "智能": "Smart", "顺序": "Order", "轮换": "Rotate", "用量均衡": "Balance by usage", "节奏": "Pace",
  "按请求和各成员当前的额度自动挑选。": "Picks automatically from each member's current quota.",
  "按列表顺序使用，前一个不可用时才用下一个。": "Uses members in list order; the next one only when the previous is unavailable.",
  "在成员之间轮流分配请求。": "Hands requests to the members in turn.",
  "优先使用已用额度最少的成员。": "Prefers the member with the least quota used.",
  "按额度窗口的消耗节奏，避免过早用完。": "Follows each quota window's pace so nothing runs out early.",
  "magpie 的其他分配方式；可在完整 magpie 控制台中修改。": "Another magpie routing mode; change it in the full magpie console.",
  "小时": "h", "分钟": "m", "天": "d",
};
const FORMATS: Record<string, string> = {
  "magpie {0}": "magpie {0}", "{0} 后重置": "resets in {0}", "{0} 个模型": "{0} models", "{0} 个供应商": "{0} providers",
  "{0} 个账号": "{0} accounts", "{0} 个路由组": "{0} routing groups", "停用 {0}": "Disable {0}", "启用 {0}": "Enable {0}",
  "移除密钥 {0}": "Remove key {0}", "为 {0} 添加密钥": "Add a key to {0}", "上移 {0}": "Move {0} up", "下移 {0}": "Move {0} down",
  "移除 {0}": "Remove {0}", "成员（{0}）": "Members ({0})",
  "确定删除「{0}」及其全部密钥吗？此操作无法撤销。": "Delete “{0}” and all its keys? This cannot be undone.",
  "确定删除路由组「{0}」吗？": "Delete the routing group “{0}”?",
  "确定让 magpie 忘记「{0}」吗？之后需要重新登录。": "Make magpie forget “{0}”? You will need to sign in again.",
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
