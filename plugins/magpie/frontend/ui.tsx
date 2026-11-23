/** Small shared pieces: request hooks, dialog, switch, pills, quota bars and formatters. */
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Check, Copy, TriangleAlert } from "lucide-react";
import { EmptyState } from "@xueness/host";
import { useTr } from "./i18n";
import type { QuotaWindow, UsageTotals } from "./api";

export const errText = (cause: unknown): string => cause instanceof Error ? cause.message : String(cause);

/** Load on mount and whenever `deps` change; aborts the request on unmount. */
export function useLoad<T>(load: (signal: AbortSignal) => Promise<T>, deps: unknown[] = []) {
  const [state, setState] = useState<{ data: T | null; error: string | null; loading: boolean }>({ data: null, error: null, loading: true });
  const [tick, setTick] = useState(0);
  const loader = useRef(load);
  loader.current = load;
  useEffect(() => {
    const controller = new AbortController();
    setState(s => ({ ...s, loading: true, error: null }));
    loader.current(controller.signal).then(
      data => { if (!controller.signal.aborted) setState({ data, error: null, loading: false }); },
      cause => { if (!controller.signal.aborted) setState(s => ({ ...s, loading: false, error: errText(cause) })); },
    );
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, ...deps]);
  const reload = useCallback(() => setTick(n => n + 1), []);
  const update = useCallback((change: (data: T) => T) => setState(s => s.data === null ? s : { ...s, data: change(s.data) }), []);
  return { ...state, reload, update };
}

/** Run one mutation at a time with a busy flag and the server's error text. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    controller.current = new AbortController();
    return () => controller.current?.abort();
  }, []);
  const run = useCallback(async <R,>(task: (signal: AbortSignal) => Promise<R>): Promise<R | undefined> => {
    const signal = controller.current?.signal;
    if (!signal || signal.aborted) return undefined;
    setBusy(true); setError(null);
    try { return await task(signal); }
    catch (cause) { if (!signal.aborted) setError(errText(cause)); return undefined; }
    finally { if (!signal.aborted) setBusy(false); }
  }, []);
  return { busy, error, run, clear: () => setError(null) };
}

export function Alert({ text, tone = "error" }: { text: string; tone?: "error" | "ok" | "info" }) {
  const { t } = useTr();
  return <div className={`xn-mp-alert xn-mp-alert--${tone}`} role={tone === "error" ? "alert" : "status"}>
    {tone === "error" && <TriangleAlert size={14} aria-hidden="true" />}<span>{t(text)}</span>
  </div>;
}

/** Loading / error placeholder for a whole tab; returns null when `data` is ready. */
export function LoadState({ loading, error, data, retry }: { loading: boolean; error: string | null; data: unknown; retry(): void }) {
  const { t } = useTr();
  if (error && data === null) {
    return <EmptyState tone="error" compact title={t("加载失败")} hint={t(error)}
      action={<button type="button" className="xn-mp-btn" onClick={retry}>{t("重试")}</button>} />;
  }
  if (data === null) return <p className="xn-mp-loading" role="status">{loading ? t("正在加载…") : ""}</p>;
  return null;
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange(value: boolean): void; label: string; disabled?: boolean }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} title={label} disabled={disabled}
    className="xn-mp-switch" onClick={() => onChange(!checked)}><span /></button>;
}

export function Pill({ tone = "neutral", children }: { tone?: "neutral" | "ok" | "warn" | "error" | "info"; children: ReactNode }) {
  return <span className={`xn-mp-pill xn-mp-pill--${tone}`}>{children}</span>;
}

export function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setDone(true); window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setDone(false), 1500); }
    catch { /* clipboard unavailable: nothing to do */ }
  };
  return <button type="button" className="xn-mp-icon" aria-label={label} title={label} onClick={() => void copy()}>
    {done ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
  </button>;
}

/** Modal dialog: Escape closes, focus moves in and returns to the opener. */
export function Dialog({ title, onClose, children, footer }: { title: string; onClose(): void; children: ReactNode; footer?: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const { t } = useTr();
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const first = root.current?.querySelector<HTMLElement>("[data-autofocus], input:not([type=hidden]), select, textarea");
    (first ?? root.current)?.focus();
    return () => { if (opener && document.contains(opener)) opener.focus(); };
  }, []);
  const keys = (event: KeyboardEvent) => {
    if (event.key === "Escape") { event.stopPropagation(); event.preventDefault(); onClose(); return; }
    if (event.key !== "Tab" || !root.current) return;
    const items = Array.from(root.current.querySelectorAll<HTMLElement>("button, input, select, textarea, a[href], [tabindex]:not([tabindex='-1'])")).filter(el => !el.hasAttribute("disabled"));
    if (!items.length) return;
    const first = items[0]!, last = items[items.length - 1]!;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };
  return <div className="xn-mp-scrim" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={root} className="xn-mp-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} onKeyDown={keys}>
      <header><h3 id={titleId}>{title}</h3><button type="button" className="xn-mp-icon" aria-label={t("关闭")} onClick={onClose}>×</button></header>
      <div className="xn-mp-dialog__body">{children}</div>
      {footer && <footer>{footer}</footer>}
    </div>
  </div>;
}

export function ConfirmDialog({ title, text, confirm, busy, error, onConfirm, onClose }: {
  title: string; text: string; confirm: string; busy: boolean; error: string | null; onConfirm(): void; onClose(): void;
}) {
  const { t } = useTr();
  return <Dialog title={title} onClose={onClose} footer={<>
    <button type="button" className="xn-mp-btn" onClick={onClose}>{t("取消")}</button>
    <button type="button" className="xn-mp-btn xn-mp-btn--danger" disabled={busy} data-autofocus onClick={onConfirm}>{confirm}</button>
  </>}>
    <p className="xn-mp-muted">{text}</p>
    {error && <Alert text={error} />}
  </Dialog>;
}

/** Quota windows with progress bars and reset times. */
export function Windows({ windows }: { windows: QuotaWindow[] }) {
  const { t, tf, locale } = useTr();
  if (!windows.length) return <p className="xn-mp-muted">{t("没有额度信息")}</p>;
  return <ul className="xn-mp-windows">{windows.map((w, index) => {
    const pct = w.usedPercent === null ? null : Math.max(0, Math.min(100, w.usedPercent));
    const tone = pct === null ? "" : pct >= 90 ? "high" : pct >= 70 ? "mid" : "low";
    return <li key={`${w.name}-${index}`}>
      <div className="xn-mp-windows__head"><span>{w.name}</span><strong>{pct === null ? "—" : `${Math.round(pct)}%`}</strong></div>
      <div className="xn-mp-bar" role="progressbar" aria-label={w.name} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct ?? undefined}>
        <span data-tone={tone} style={{ width: `${pct ?? 0}%` }} />
      </div>
      {w.resetsAt && <small title={new Date(w.resetsAt).toLocaleString(locale)}>{tf("{0} 后重置", [until(w.resetsAt, locale, t("即将"))])}</small>}
    </li>;
  })}</ul>;
}

function until(iso: string, locale: "zh" | "en", soon: string): string {
  const ms = Date.parse(iso) - Date.now();
  if (!Number.isFinite(ms)) return iso;
  const minutes = Math.round(ms / 60_000);
  if (minutes <= 0) return soon;
  const d = Math.floor(minutes / 1440), h = Math.floor((minutes % 1440) / 60), m = minutes % 60;
  const unit = locale === "en" ? { d: "d", h: "h", m: "m", gap: " " } : { d: "天", h: "小时", m: "分钟", gap: "" };
  if (d > 0) return `${d}${unit.d}${unit.gap}${h}${unit.h}`;
  if (h > 0) return `${h}${unit.h}${unit.gap}${m}${unit.m}`;
  return `${m}${unit.m}`;
}

export const fmtNumber = (value: number, locale: string) => new Intl.NumberFormat(locale).format(value);

export function fmtCost(totals: Pick<UsageTotals, "cost" | "currency">, locale: string): string {
  if (totals.cost === null) return "—";
  if (totals.currency) {
    try { return new Intl.NumberFormat(locale, { style: "currency", currency: totals.currency, maximumFractionDigits: 4 }).format(totals.cost); }
    catch { return `${totals.cost.toFixed(4)} ${totals.currency}`; }
  }
  return totals.cost.toFixed(4);
}

export const fmtContext = (n: number | null) => n === null ? "—" : n >= 1_000_000 ? `${+(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}K` : String(n);
