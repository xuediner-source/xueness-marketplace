/** The status strip above the tabs: process state, gateway URL and controls. */
import { ExternalLink, Play, RotateCw, Square } from "lucide-react";
import type { Status } from "./api";
import { useTr } from "./i18n";
import { Alert, CopyButton, Pill, Switch } from "./ui";

const TONE = { stopped: "neutral", starting: "info", running: "ok", stopping: "info", failed: "error" } as const;
const LABEL = { stopped: "已停止", starting: "启动中", running: "运行中", stopping: "停止中", failed: "失败" } as const;

export type StripProps = {
  status: Status; busy: boolean; error: string | null;
  onStart(): void; onStop(): void; onRestart(): void; onConsole(): void; onDiscovery(value: boolean): void;
};

export function StatusStrip({ status, busy, error, onStart, onStop, onRestart, onConsole, onDiscovery }: StripProps) {
  const { t, tf } = useTr();
  const moving = status.state === "starting" || status.state === "stopping";
  const running = status.state === "running";
  const version = status.version ?? status.bundledVersion;
  return <section className="xn-mp-card xn-mp-strip" aria-label={t("运行状态")}>
    <div className="xn-mp-strip__row">
      <div className="xn-mp-strip__id">
        <Pill tone={TONE[status.state]}>{t(LABEL[status.state])}</Pill>
        <span className="xn-mp-muted">{tf("magpie {0}", [version])}</span>
      </div>
      <div className="xn-mp-strip__actions">
        {running
          ? <>
            <button type="button" className="xn-mp-btn" disabled={busy || moving} onClick={onRestart}><RotateCw size={13} aria-hidden="true" />{t("重启")}</button>
            <button type="button" className="xn-mp-btn" disabled={busy || moving} onClick={onStop}><Square size={13} aria-hidden="true" />{t("停止")}</button>
          </>
          : <button type="button" className="xn-mp-btn xn-mp-btn--primary" disabled={busy || moving} onClick={onStart}><Play size={13} aria-hidden="true" />{status.state === "failed" ? t("重试启动") : t("启动")}</button>}
        <button type="button" className="xn-mp-btn" disabled={busy || moving} onClick={onConsole}><ExternalLink size={13} aria-hidden="true" />{t("打开完整 magpie 控制台")}</button>
      </div>
    </div>
    <div className="xn-mp-strip__gateway">
      <span className="xn-mp-muted">{t("网关地址")}</span>
      <code>{status.gatewayUrl}</code>
      <CopyButton text={status.gatewayUrl} label={t("复制网关地址")} />
    </div>
    <div className="xn-mp-strip__discovery">
      <Switch checked={status.accountDiscovery} disabled={busy || moving} label={t("账号发现")} onChange={onDiscovery} />
      <div>
        <strong>{t("账号发现")}</strong>
        <p className="xn-mp-muted">{t("读取你自己已登录的命令行工具账号；关闭后订阅登录也会一并停用。更改会重启 magpie。")}</p>
      </div>
    </div>
    {error && <Alert text={error} />}
    {status.state === "failed" && <>
      {status.error && <Alert text={status.error} />}
      {status.log.length > 0 && <details className="xn-mp-log">
        <summary>{t("最近输出")}</summary>
        <pre>{status.log.join("\n")}</pre>
      </details>}
    </>}
  </section>;
}
