/** Sign-in accounts: subscriptions magpie found or signed in to. */
import { useState } from "react";
import { LogIn } from "lucide-react";
import { accountAction, getAccounts, type Account, type AccountAction } from "./api";
import { useTr } from "./i18n";
import { SignInDialog } from "./SignInDialog";
import { Alert, ConfirmDialog, LoadState, Pill, Windows, useAction, useLoad } from "./ui";

export function AccountsTab({ onModelsChanged }: { onModelsChanged(): void }) {
  const { t, tf } = useTr();
  const list = useLoad(signal => getAccounts(signal));
  const action = useAction();
  const [signIn, setSignIn] = useState(false);
  const [forget, setForget] = useState<Account | null>(null);

  const run = async (account: Account, name: AccountAction) => {
    const result = await action.run(signal => accountAction(account.id, name, signal));
    if (!result) return;
    list.update(data => ({ ...data, accounts: result.accounts }));
    setForget(null);
    onModelsChanged();
  };

  if (!list.data) return <LoadState loading={list.loading} error={list.error} data={list.data} retry={list.reload} />;
  const { accounts, discovery } = list.data;
  return <div className="xn-mp-stack">
    <div className="xn-mp-toolbar">
      <span className="xn-mp-muted">{tf("{0} 个账号", [accounts.length])}</span>
      <button type="button" className="xn-mp-btn xn-mp-btn--primary" disabled={action.busy} onClick={() => setSignIn(true)}><LogIn size={13} aria-hidden="true" />{t("登录")}</button>
    </div>
    {!discovery && <Alert tone="info" text="账号发现已关闭，订阅登录不可用。可在上方状态栏重新开启。" />}
    {action.error && !forget && <Alert text={action.error} />}
    {accounts.length === 0 && <p className="xn-mp-muted xn-mp-pad">{t("还没有登录账号。点击「登录」使用你的订阅。")}</p>}
    {accounts.map(a => <section key={a.id} className="xn-mp-card" data-off={a.enabled ? undefined : ""}>
      <header className="xn-mp-card__head">
        <div className="xn-mp-card__title">
          <h4>{a.label}</h4>
          {a.plan && <span className="xn-mp-chip">{a.plan}</span>}
          {a.active && <Pill tone="ok">{t("当前使用")}</Pill>}
          {!a.enabled && <Pill tone="warn">{t("已停用")}</Pill>}
        </div>
      </header>
      <p className="xn-mp-muted xn-mp-meta">{[a.agent, a.provider].filter((v, i, all) => v && all.indexOf(v) === i).join(" · ")}</p>
      <Windows windows={a.windows} />
      <footer className="xn-mp-actions">
        {!a.active && a.enabled && <button type="button" className="xn-mp-btn" disabled={action.busy} onClick={() => void run(a, "switch")}>{t("切换到此账号")}</button>}
        <button type="button" className="xn-mp-btn" disabled={action.busy} onClick={() => void run(a, a.enabled ? "disable" : "enable")}>{a.enabled ? t("停用") : t("启用")}</button>
        <button type="button" className="xn-mp-btn xn-mp-btn--quiet xn-mp-btn--danger-text" disabled={action.busy} onClick={() => { action.clear(); setForget(a); }}>{t("移除")}</button>
      </footer>
    </section>)}
    {signIn && <SignInDialog onClose={() => setSignIn(false)} onDone={() => { list.reload(); onModelsChanged(); }} />}
    {forget && <ConfirmDialog title={t("移除账号")} text={tf("确定让 magpie 忘记「{0}」吗？之后需要重新登录。", [forget.label])}
      confirm={t("移除")} busy={action.busy} error={action.error} onClose={() => setForget(null)} onConfirm={() => void run(forget, "forget")} />}
  </div>;
}
