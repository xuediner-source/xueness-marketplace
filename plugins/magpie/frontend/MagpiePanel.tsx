/**
 * The Magpie panel: the adapter around the original magpie program. A status strip (start, stop, account
 * discovery, gateway address), magpie's own console embedded as is, and its models for Xueness conversations.
 * Nothing magpie already manages is rebuilt here. Opening the panel never starts the process by itself.
 */
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Play } from "lucide-react";
import { EmptyState } from "@xueness/host";
import { getConsole, getModels, getStatus, restartMagpie, saveSettings, startMagpie, stopMagpie, type Status } from "./api";
import { useTr } from "./i18n";
import { StatusStrip } from "./StatusStrip";
import { ConsoleView } from "./ConsoleView";
import { ModelsTab } from "./ModelsTab";
import { errText, useAction } from "./ui";
import "./magpie.css";

export type MagpiePanelProps = {
  embedded?: boolean;
  onModelsChanged?: () => void;
  onSelectModel?: (profileId: string) => void;
};

const VIEWS = [{ id: "console", label: "Magpie 控制台" }, { id: "models", label: "在 Xueness 中使用" }] as const;
type ViewId = typeof VIEWS[number]["id"];

export function MagpiePanel({ embedded, onModelsChanged, onSelectModel }: MagpiePanelProps) {
  const { t } = useTr();
  const [status, setStatus] = useState<Status | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [view, setView] = useState<ViewId>("console");
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

  /** Read magpie's models again (this also updates the list the composer shows), then tell the workbench. */
  const syncModels = useCallback(() => {
    void getModels().then(() => changed.current?.()).catch(() => undefined);
  }, []);
  const act = (task: (signal: AbortSignal) => Promise<Status>, pending?: Status["state"]) => {
    if (pending) setStatus(s => s && { ...s, state: pending, error: null });
    void action.run(task).then(next => { if (next) setStatus(next); else void refresh(); });
  };
  const openExternal = () => void action.run(async signal => {
    const { url } = await getConsole(signal);
    window.open(url, "_blank", "noopener");
  });

  const viewKeys = (event: KeyboardEvent) => {
    const current = VIEWS.findIndex(item => item.id === view);
    const nextIndex = event.key === "ArrowRight" ? (current + 1) % VIEWS.length
      : event.key === "ArrowLeft" ? (current - 1 + VIEWS.length) % VIEWS.length
      : event.key === "Home" ? 0
      : event.key === "End" ? VIEWS.length - 1
      : -1;
    if (nextIndex < 0) return;
    event.preventDefault();
    const next = VIEWS[nextIndex]!.id;
    setView(next);
    document.getElementById(`xn-mp-tab-${next}`)?.focus();
  };

  if (!status) {
    return <div className="xn-mp"><EmptyState compact tone={loadError ? "error" : "neutral"}
      title={loadError ? t("无法读取 magpie 状态") : t("正在加载…")} hint={loadError ? t(loadError) : undefined}
      action={loadError ? <button type="button" className="xn-mp-btn" onClick={() => void refresh()}>{t("重试")}</button> : undefined} /></div>;
  }

  const running = status.state === "running";
  const moving = status.state === "starting" || status.state === "stopping";

  return <div className={`xn-mp${embedded ? " xn-mp--embedded" : ""}`}>
    {!embedded && <header className="xn-mp-head">
      <h2>{t("Magpie 模型网关")}</h2>
      <p>{t("原版 magpie 本机网关。在这里启动它、使用它自己的控制台，并把它的模型用在 Xueness 的会话里。")}</p>
    </header>}
    <StatusStrip status={status} busy={action.busy} error={action.error}
      onStart={() => act(startMagpie, "starting")} onStop={() => act(stopMagpie, "stopping")} onRestart={() => act(restartMagpie, "starting")}
      onConsole={openExternal} onDiscovery={value => act(signal => saveSettings(value, signal))} />
    <div className="xn-mp-tabs" role="tablist" aria-label={t("Magpie 模型网关")} onKeyDown={viewKeys}>
      {VIEWS.map(item => <button key={item.id} id={`xn-mp-tab-${item.id}`} type="button" role="tab" className="xn-mp-tab"
        aria-selected={view === item.id} aria-controls="xn-mp-tabpanel" tabIndex={view === item.id ? 0 : -1}
        onClick={() => setView(item.id)}>{t(item.label)}</button>)}
    </div>
    <div id="xn-mp-tabpanel" className="xn-mp-panel" role="tabpanel" aria-labelledby={`xn-mp-tab-${view}`}>
      {!running
        ? <EmptyState compact
          title={moving ? (status.state === "starting" ? t("magpie 正在启动…") : t("magpie 正在停止…")) : status.state === "failed" ? t("magpie 启动失败") : t("magpie 未运行")}
          hint={moving ? t("通常需要几秒钟。") : t("启动后即可使用 magpie 控制台，它的模型也会出现在会话的模型选择里。")}
          action={moving ? undefined : <button type="button" className="xn-mp-btn xn-mp-btn--primary" disabled={action.busy} onClick={() => act(startMagpie, "starting")}><Play size={13} aria-hidden="true" />{t("启动")}</button>} />
        : view === "console"
          ? <ConsoleView key={status.startedAt ?? "running"} startedAt={status.startedAt} onOpenExternal={openExternal} onLeave={syncModels} />
          : <ModelsTab key={status.startedAt ?? "running"} onSelectModel={onSelectModel} onModelsChanged={() => changed.current?.()} />}
    </div>
  </div>;
}
