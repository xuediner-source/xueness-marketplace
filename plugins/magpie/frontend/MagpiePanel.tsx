/**
 * The Magpie panel: a status strip plus tabs over the adapter routes. Tabs only fetch while magpie is running,
 * so opening the panel never starts the process by itself.
 */
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Play } from "lucide-react";
import { EmptyState } from "@xueness/host";
import { getConsole, getStatus, restartMagpie, saveSettings, startMagpie, stopMagpie, type Status } from "./api";
import { useTr } from "./i18n";
import { StatusStrip } from "./StatusStrip";
import { OverviewTab } from "./OverviewTab";
import { ProvidersTab } from "./ProvidersTab";
import { AccountsTab } from "./AccountsTab";
import { GroupsTab } from "./GroupsTab";
import { ModelsTab } from "./ModelsTab";
import { UsageTab } from "./UsageTab";
import { errText, useAction } from "./ui";
import "./magpie.css";

export type MagpiePanelProps = {
  embedded?: boolean;
  onModelsChanged?: () => void;
  onSelectModel?: (profileId: string) => void;
};

const TABS = [
  { id: "overview", label: "概览" }, { id: "providers", label: "供应商与密钥" }, { id: "accounts", label: "登录账号" },
  { id: "groups", label: "路由组" }, { id: "models", label: "模型" }, { id: "usage", label: "用量" },
] as const;
type TabId = typeof TABS[number]["id"];

export function MagpiePanel({ embedded, onModelsChanged, onSelectModel }: MagpiePanelProps) {
  const { t } = useTr();
  const [status, setStatus] = useState<Status | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("overview");
  const action = useAction();
  const changed = useRef(onModelsChanged);
  changed.current = onModelsChanged;
  const previous = useRef<Status["state"] | null>(null);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    try { const next = await getStatus(signal); if (!signal?.aborted) { setStatus(next); setLoadError(null); } }
    catch (cause) { if (!signal?.aborted) setLoadError(errText(cause)); }
  }, []);
  useEffect(() => { const controller = new AbortController(); void refresh(controller.signal); return () => controller.abort(); }, [refresh]);

  const state = status?.state;
  useEffect(() => {
    if (state !== "starting" && state !== "stopping") return;
    const controller = new AbortController();
    const timer = window.setInterval(() => void refresh(controller.signal), 2000);
    return () => { window.clearInterval(timer); controller.abort(); };
  }, [state, refresh]);
  // The model list changes whenever magpie goes up or down.
  useEffect(() => {
    if (!state) return;
    const was = previous.current;
    previous.current = state;
    if (was !== null && (was === "running") !== (state === "running")) changed.current?.();
  }, [state]);

  const act = (task: (signal: AbortSignal) => Promise<Status>, pending?: Status["state"]) => {
    if (pending) setStatus(s => s && { ...s, state: pending, error: null });
    void action.run(task).then(next => { if (next) setStatus(next); else void refresh(); });
  };
  const openConsole = () => void action.run(async signal => {
    const { url } = await getConsole(signal);
    window.open(url, "_blank", "noopener");
  });

  const tabKeys = (event: KeyboardEvent) => {
    const index = TABS.findIndex(item => item.id === tab);
    const next = event.key === "ArrowRight" ? index + 1 : event.key === "ArrowLeft" ? index - 1 : event.key === "Home" ? 0 : event.key === "End" ? TABS.length - 1 : -1;
    if (next < 0) return;
    event.preventDefault();
    const target = TABS[(next + TABS.length) % TABS.length]!.id;
    setTab(target);
    document.getElementById(`xn-mp-tab-${target}`)?.focus();
  };

  if (!status) {
    return <div className="xn-mp"><EmptyState compact tone={loadError ? "error" : "neutral"}
      title={loadError ? t("无法读取 magpie 状态") : t("正在加载…")} hint={loadError ? t(loadError) : undefined}
      action={loadError ? <button type="button" className="xn-mp-btn" onClick={() => void refresh()}>{t("重试")}</button> : undefined} /></div>;
  }

  const running = status.state === "running";
  const moving = status.state === "starting" || status.state === "stopping";
  const props = { onModelsChanged: () => changed.current?.(), onSelectModel };

  return <div className={`xn-mp${embedded ? " xn-mp--embedded" : ""}`}>
    {!embedded && <header className="xn-mp-head">
      <h2>{t("Magpie 模型网关")}</h2>
      <p>{t("管理 magpie 的账号、API 密钥、路由组、额度与用量；它的模型会出现在会话的模型选择里。")}</p>
    </header>}
    <StatusStrip status={status} busy={action.busy} error={action.error}
      onStart={() => act(startMagpie, "starting")} onStop={() => act(stopMagpie, "stopping")} onRestart={() => act(restartMagpie, "starting")}
      onConsole={openConsole} onDiscovery={value => act(signal => saveSettings(value, signal))} />
    <div className="xn-mp-tabs" role="tablist" aria-label={t("Magpie 模型网关")} onKeyDown={tabKeys}>
      {TABS.map(item => <button key={item.id} id={`xn-mp-tab-${item.id}`} type="button" role="tab" className="xn-mp-tab"
        aria-selected={tab === item.id} aria-controls="xn-mp-tabpanel" tabIndex={tab === item.id ? 0 : -1}
        onClick={() => setTab(item.id)}>{t(item.label)}</button>)}
    </div>
    <div id="xn-mp-tabpanel" className="xn-mp-panel" role="tabpanel" aria-labelledby={`xn-mp-tab-${tab}`}>
      {!running
        ? <EmptyState compact
          title={moving ? (status.state === "starting" ? t("magpie 正在启动…") : t("magpie 正在停止…")) : status.state === "failed" ? t("magpie 启动失败") : t("magpie 未运行")}
          hint={moving ? t("通常需要几秒钟。") : t("启动后才能查看和修改这里的内容。")}
          action={moving ? undefined : <button type="button" className="xn-mp-btn xn-mp-btn--primary" disabled={action.busy} onClick={() => act(startMagpie, "starting")}><Play size={13} aria-hidden="true" />{t("启动")}</button>} />
        : <div key={status.startedAt ?? "running"}>
          {tab === "overview" && <OverviewTab />}
          {tab === "providers" && <ProvidersTab {...props} />}
          {tab === "accounts" && <AccountsTab {...props} />}
          {tab === "groups" && <GroupsTab {...props} />}
          {tab === "models" && <ModelsTab {...props} />}
          {tab === "usage" && <UsageTab />}
        </div>}
    </div>
  </div>;
}
