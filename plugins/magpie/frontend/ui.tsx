/** Small shared pieces: request hooks, alert, switch, pills, copy button and the context-window formatter. */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Check, Copy, TriangleAlert } from "lucide-react";
import { EmptyState } from "@xueness/host";
import { useTr } from "./i18n";

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
  return { ...state, reload };
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

/** Loading / error placeholder for a whole view; returns null when `data` is ready. */
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

export const fmtContext = (n: number | null) => n === null ? "—" : n >= 1_000_000 ? `${+(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}K` : String(n);
