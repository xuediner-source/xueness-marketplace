/** Sign-in flow: pick an agent, open the link, show the device code, poll until it finishes. */
import { useEffect, useRef, useState } from "react";
import { cancelSignIn, getAgents, getSignIn, signInCallback, startSignIn, type SignIn } from "./api";
import { useTr } from "./i18n";
import { Alert, CopyButton, Dialog, Pill, errText, useAction, useLoad } from "./ui";

const ACTIVE = (s: SignIn | null) => s?.state === "installing" || s?.state === "waiting";
const safeUrl = (url: string) => /^https?:\/\//i.test(url);

export function SignInDialog({ onClose, onDone }: { onClose(): void; onDone(): void }) {
  const { t } = useTr();
  const agents = useLoad(async signal => (await getAgents(signal)).agents);
  const action = useAction();
  const [agent, setAgent] = useState("");
  const [flow, setFlow] = useState<SignIn | null>(null);
  const [pasted, setPasted] = useState("");
  const [pollError, setPollError] = useState<string | null>(null);
  const done = useRef(onDone);
  done.current = onDone;

  const flowId = flow?.id;
  const active = ACTIVE(flow);
  useEffect(() => {
    if (!flowId || !active) return;
    const controller = new AbortController();
    const timer = window.setInterval(() => {
      getSignIn(flowId, controller.signal).then(next => { setFlow(next); setPollError(null); }, cause => { if (!controller.signal.aborted) setPollError(errText(cause)); });
    }, 2000);
    return () => { window.clearInterval(timer); controller.abort(); };
  }, [flowId, active]);
  const state = flow?.state;
  useEffect(() => { if (state === "done") done.current(); }, [state]);

  const chosen = agent || agents.data?.[0]?.id || "";
  const start = async () => {
    setPasted(""); setPollError(null);
    const next = await action.run(signal => startSignIn(chosen, signal));
    if (next) setFlow(next);
  };
  const cancel = async () => {
    if (!flow) return;
    const next = await action.run(signal => cancelSignIn(flow.id, signal));
    if (next) setFlow(next);
  };
  const close = () => { if (flow && active) void cancelSignIn(flow.id).catch(() => undefined); onClose(); };
  const submitCallback = async () => {
    if (!flow || !pasted.trim()) return;
    const next = await action.run(signal => signInCallback(flow.id, pasted.trim(), signal));
    if (next) { setFlow(next); setPasted(""); }
  };

  const tone = state === "done" ? "ok" : state === "failed" ? "error" : state === "canceled" ? "warn" : "info";
  const label = { installing: "正在准备…", waiting: "等待登录完成", done: "登录成功", failed: "登录失败", canceled: "已取消" } as const;

  return <Dialog title={t("登录订阅账号")} onClose={close} footer={<>
    {active && <button type="button" className="xn-mp-btn" disabled={action.busy} onClick={() => void cancel()}>{t("取消登录")}</button>}
    <button type="button" className="xn-mp-btn" onClick={close}>{state === "done" ? t("完成") : t("关闭")}</button>
    {!active && state !== "done" && <button type="button" className="xn-mp-btn xn-mp-btn--primary" disabled={action.busy || !chosen} onClick={() => void start()}>{flow ? t("重试") : t("开始登录")}</button>}
  </>}>
    <div className="xn-mp-form">
      <label className="xn-mp-field"><span>{t("登录方式")}</span>
        <select value={chosen} disabled={action.busy || active || agents.loading} onChange={event => setAgent(event.currentTarget.value)}>
          {agents.data?.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select></label>
      {agents.error && <Alert text={agents.error} />}
      {agents.data && agents.data.length === 0 && <Alert tone="info" text="没有可直接登录的订阅。请先开启账号发现。" />}
      {flow && <div className="xn-mp-signin" aria-live="polite">
        <Pill tone={tone}>{t(label[flow.state])}</Pill>
        {flow.url && safeUrl(flow.url) && active && <div className="xn-mp-signin__row">
          <a href={flow.url} target="_blank" rel="noopener noreferrer">{t("打开登录页面")}</a>
          <CopyButton text={flow.url} label={t("复制登录链接")} />
        </div>}
        {flow.code && active && <div className="xn-mp-signin__row">
          <span className="xn-mp-muted">{t("设备码")}</span><code className="xn-mp-code">{flow.code}</code>
          <CopyButton text={flow.code} label={t("复制设备码")} />
        </div>}
        {flow.pasteCallback && state === "waiting" && <form className="xn-mp-field" onSubmit={event => { event.preventDefault(); void submitCallback(); }}>
          <span>{t("登录后浏览器最终停留的地址")}</span>
          <div className="xn-mp-inline">
            <input type="text" value={pasted} disabled={action.busy} placeholder="http://localhost:…" autoComplete="off" spellCheck={false} aria-label={t("登录后浏览器最终停留的地址")} onChange={event => setPasted(event.currentTarget.value)} />
            <button type="submit" className="xn-mp-btn" disabled={action.busy || !pasted.trim()}>{t("提交")}</button>
          </div>
          <small className="xn-mp-muted">{t("如果页面显示无法访问，把地址栏里的完整地址粘贴到这里。")}</small>
        </form>}
        {flow.error && <Alert text={flow.error} />}
      </div>}
      {pollError && <Alert text={pollError} />}
      {action.error && <Alert text={action.error} />}
    </div>
  </Dialog>;
}
