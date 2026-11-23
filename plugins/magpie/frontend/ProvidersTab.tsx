/** Providers and API keys. */
import { useState } from "react";
import { KeyRound, Plus, Trash2 } from "lucide-react";
import { getProviders, providerAction, removeKey, type Provider, type ProviderAction } from "./api";
import { useTr } from "./i18n";
import { AddKeyDialog, AddProviderDialog } from "./ProviderDialogs";
import { Alert, ConfirmDialog, LoadState, Pill, Switch, useAction, useLoad } from "./ui";

type Dialog = { kind: "add" } | { kind: "key"; provider: Provider } | { kind: "delete"; provider: Provider } | null;
const KIND = { key: "密钥", subscription: "订阅", local: "本地", plugin: "插件" } as const;

export function ProvidersTab({ onModelsChanged }: { onModelsChanged(): void }) {
  const { t, tf } = useTr();
  const list = useLoad(async signal => (await getProviders(signal)).providers);
  const action = useAction();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [working, setWorking] = useState<string | null>(null);

  const replace = (provider: Provider) => list.update(all => all.map(p => p.id === provider.id ? provider : p));
  const apply = (provider: Provider) => { replace(provider); onModelsChanged(); };

  const run = async (provider: Provider, name: ProviderAction) => {
    setWorking(`${provider.id}:${name}`);
    setNotes(n => { const { [provider.id]: _gone, ...rest } = n; return rest; });
    const result = await action.run(signal => providerAction(provider.id, name, signal));
    setWorking(null);
    if (!result) return;
    if (name === "delete") { list.update(all => all.filter(p => p.id !== provider.id)); setDialog(null); }
    else if (result.provider) replace(result.provider);
    if (result.message) setNotes(n => ({ ...n, [provider.id]: result.message! }));
    else if (name === "test") setNotes(n => ({ ...n, [provider.id]: t("连接正常") }));
    if (name !== "test") onModelsChanged();
  };
  const dropKey = async (provider: Provider, keyId: string) => {
    const result = await action.run(signal => removeKey(provider.id, keyId, signal));
    if (result) apply(result.provider);
  };

  if (!list.data) return <LoadState loading={list.loading} error={list.error} data={list.data} retry={list.reload} />;
  return <div className="xn-mp-stack">
    <div className="xn-mp-toolbar">
      <span className="xn-mp-muted">{tf("{0} 个供应商", [list.data.length])}</span>
      <button type="button" className="xn-mp-btn xn-mp-btn--primary" disabled={action.busy} onClick={() => setDialog({ kind: "add" })}><Plus size={13} aria-hidden="true" />{t("添加供应商")}</button>
    </div>
    {action.error && dialog === null && <Alert text={action.error} />}
    {list.data.length === 0 && <p className="xn-mp-muted xn-mp-pad">{t("还没有供应商。添加一个 API 密钥开始使用。")}</p>}
    {list.data.map(p => <section key={p.id} className="xn-mp-card" data-off={p.enabled ? undefined : ""}>
      <header className="xn-mp-card__head">
        <div className="xn-mp-card__title">
          <h4>{p.name}</h4>
          <Pill>{t(KIND[p.kind])}</Pill>
          {p.balance && <span className="xn-mp-chip" title={t("余额")}>{p.balance}</span>}
        </div>
        <Switch checked={p.enabled} disabled={action.busy} label={tf(p.enabled ? "停用 {0}" : "启用 {0}", [p.name])}
          onChange={value => void run(p, value ? "enable" : "disable")} />
      </header>
      <p className="xn-mp-muted xn-mp-meta">
        {[p.models === null ? null : tf("{0} 个模型", [p.models]), p.protocol, p.baseUrl].filter(Boolean).join(" · ") || "—"}
      </p>
      {p.keys.length > 0 && <ul className="xn-mp-keys">{p.keys.map(k => <li key={k.id}>
        <KeyRound size={13} aria-hidden="true" />
        <span className="xn-mp-keys__label">{k.label}</span>
        <code>{k.masked}</code>
        {!k.enabled && <Pill tone="warn">{t("已停用")}</Pill>}
        <button type="button" className="xn-mp-icon" disabled={action.busy} aria-label={tf("移除密钥 {0}", [k.label || k.masked])} title={t("移除密钥")} onClick={() => void dropKey(p, k.id)}><Trash2 size={14} aria-hidden="true" /></button>
      </li>)}</ul>}
      {notes[p.id] && <Alert tone="ok" text={notes[p.id]!} />}
      <footer className="xn-mp-actions">
        {p.kind === "key" && <button type="button" className="xn-mp-btn" disabled={action.busy} onClick={() => setDialog({ kind: "key", provider: p })}>{t("添加密钥")}</button>}
        <button type="button" className="xn-mp-btn" disabled={action.busy} onClick={() => void run(p, "test")}>{working === `${p.id}:test` ? t("测试中…") : t("测试")}</button>
        <button type="button" className="xn-mp-btn" disabled={action.busy} onClick={() => void run(p, "refresh-models")}>{working === `${p.id}:refresh-models` ? t("刷新中…") : t("刷新模型")}</button>
        <button type="button" className="xn-mp-btn xn-mp-btn--quiet xn-mp-btn--danger-text" disabled={action.busy} onClick={() => { action.clear(); setDialog({ kind: "delete", provider: p }); }}>{t("删除")}</button>
      </footer>
    </section>)}
    {dialog?.kind === "add" && <AddProviderDialog onClose={() => setDialog(null)} onAdded={provider => { list.update(all => [...all, provider]); onModelsChanged(); setDialog(null); }} />}
    {dialog?.kind === "key" && <AddKeyDialog provider={dialog.provider} onClose={() => setDialog(null)} onAdded={provider => { apply(provider); setDialog(null); }} />}
    {dialog?.kind === "delete" && <ConfirmDialog title={t("删除供应商")} text={tf("确定删除「{0}」及其全部密钥吗？此操作无法撤销。", [dialog.provider.name])}
      confirm={t("删除")} busy={action.busy} error={action.error} onClose={() => setDialog(null)} onConfirm={() => void run(dialog.provider, "delete")} />}
  </div>;
}
