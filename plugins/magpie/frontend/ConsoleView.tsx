/**
 * Magpie's own web console, inside Xueness. Everything magpie manages (providers, API keys, sign-in accounts,
 * routing groups, quotas, usage) is managed in magpie's own interface; Xueness does not redo it. The page is
 * served by magpie on 127.0.0.1, the same site as the Xueness desktop window, so its sign-in cookie works here.
 */
import { useEffect, useRef, useState } from "react";
import { ExternalLink, RotateCw } from "lucide-react";
import { getConsole } from "./api";
import { useTr } from "./i18n";
import { Alert, errText } from "./ui";

export function ConsoleView({ startedAt, onOpenExternal, onLeave }: {
  /** A new value (magpie restarted) loads the console again. */
  startedAt: string | null;
  onOpenExternal(): void;
  /** Called when the view goes away, so changes made in the console reach the model picker. */
  onLeave(): void;
}) {
  const { t } = useTr();
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generation, setGeneration] = useState(0);
  const leave = useRef(onLeave);
  leave.current = onLeave;
  useEffect(() => {
    const sync = () => leave.current();
    const onVisibility = () => { if (document.visibilityState === "visible") sync(); };
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", onVisibility);
      sync();
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setUrl(null); setError(null);
    getConsole(controller.signal)
      .then(answer => { if (!controller.signal.aborted) setUrl(answer.url); })
      .catch(cause => { if (!controller.signal.aborted) setError(errText(cause)); });
    return () => controller.abort();
  }, [startedAt, generation]);

  return <div className="xn-mp-console">
    <div className="xn-mp-console__bar">
      <p className="xn-mp-muted">{t("这是 magpie 原版控制台：供应商、API 密钥、登录账号、路由组、额度与用量都在这里管理。")}</p>
      <div className="xn-mp-console__actions">
        <button type="button" className="xn-mp-btn" onClick={() => setGeneration(value => value + 1)}><RotateCw size={13} aria-hidden="true" />{t("重新载入")}</button>
        <button type="button" className="xn-mp-btn" onClick={onOpenExternal}><ExternalLink size={13} aria-hidden="true" />{t("在浏览器中打开")}</button>
      </div>
    </div>
    {error ? <Alert text={t(error)} />
      : !url ? <p className="xn-mp-muted xn-mp-pad">{t("正在打开控制台…")}</p>
      : <iframe key={`${url}\u0000${generation}`} className="xn-mp-console__frame" src={url} title={t("magpie 控制台")}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads"
        allow="clipboard-write" referrerPolicy="no-referrer" />}
  </div>;
}
