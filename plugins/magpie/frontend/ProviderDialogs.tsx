/** Dialogs of the providers tab: add a provider, add an API key. */
import { useState } from "react";
import { addKey, addProvider, getPresets, type NewProvider, type Protocol, type Provider } from "./api";
import { useTr } from "./i18n";
import { Alert, Dialog, useAction, useLoad } from "./ui";

const PROTOCOLS: { id: Protocol; label: string }[] = [
  { id: "openai", label: "OpenAI 兼容" }, { id: "anthropic", label: "Anthropic" }, { id: "gemini", label: "Gemini" },
];

export function AddProviderDialog({ onClose, onAdded }: { onClose(): void; onAdded(provider: Provider): void }) {
  const { t } = useTr();
  const presets = useLoad(async signal => (await getPresets(signal)).presets);
  const action = useAction();
  const [presetId, setPresetId] = useState("");
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [protocol, setProtocol] = useState<Protocol>("openai");
  const [apiKey, setApiKey] = useState("");
  const preset = presets.data?.find(p => p.id === presetId);
  const custom = presetId === "";
  const needsKey = custom ? false : preset?.needsKey ?? true;
  const valid = custom ? name.trim() !== "" && baseUrl.trim() !== "" : !needsKey || apiKey.trim() !== "";

  const submit = async () => {
    const body: NewProvider = custom
      ? { name: name.trim(), baseUrl: baseUrl.trim(), protocol, ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}) }
      : { preset: presetId, ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}) };
    const result = await action.run(signal => addProvider(body, signal));
    if (result) onAdded(result.provider);
  };

  return <Dialog title={t("添加供应商")} onClose={onClose} footer={<>
    <button type="button" className="xn-mp-btn" onClick={onClose}>{t("取消")}</button>
    <button type="button" className="xn-mp-btn xn-mp-btn--primary" disabled={action.busy || !valid} onClick={() => void submit()}>{t("添加")}</button>
  </>}>
    <form className="xn-mp-form" onSubmit={event => { event.preventDefault(); if (valid && !action.busy) void submit(); }}>
      <label className="xn-mp-field"><span>{t("类型")}</span>
        <select value={presetId} disabled={action.busy || presets.loading} onChange={event => setPresetId(event.currentTarget.value)}>
          <option value="">{t("自定义")}</option>
          {presets.data?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>
      {presets.error && <Alert text={presets.error} />}
      {custom ? <>
        <label className="xn-mp-field"><span>{t("名称")}</span>
          <input type="text" value={name} disabled={action.busy} onChange={event => setName(event.currentTarget.value)} autoComplete="off" /></label>
        <label className="xn-mp-field"><span>{t("接口地址")}</span>
          <input type="text" value={baseUrl} placeholder="https://api.example.com/v1" disabled={action.busy} onChange={event => setBaseUrl(event.currentTarget.value)} autoComplete="off" spellCheck={false} /></label>
        <label className="xn-mp-field"><span>{t("协议")}</span>
          <select value={protocol} disabled={action.busy} onChange={event => setProtocol(event.currentTarget.value as Protocol)}>
            {PROTOCOLS.map(p => <option key={p.id} value={p.id}>{t(p.label)}</option>)}
          </select></label>
      </> : preset && <p className="xn-mp-muted">{[preset.protocol, preset.baseUrl].filter(Boolean).join(" · ")}</p>}
      <label className="xn-mp-field"><span>{needsKey ? t("API 密钥") : t("API 密钥（可选）")}</span>
        <input type="password" value={apiKey} disabled={action.busy} onChange={event => setApiKey(event.currentTarget.value)} autoComplete="off" spellCheck={false} /></label>
      <button type="submit" hidden />
    </form>
    {action.error && <Alert text={action.error} />}
  </Dialog>;
}

export function AddKeyDialog({ provider, onClose, onAdded }: { provider: Provider; onClose(): void; onAdded(provider: Provider): void }) {
  const { t, tf } = useTr();
  const action = useAction();
  const [apiKey, setApiKey] = useState("");
  const [label, setLabel] = useState("");
  const valid = apiKey.trim() !== "";
  const submit = async () => {
    const result = await action.run(signal => addKey(provider.id, apiKey.trim(), label.trim() || undefined, signal));
    if (result) onAdded(result.provider);
  };
  return <Dialog title={tf("为 {0} 添加密钥", [provider.name])} onClose={onClose} footer={<>
    <button type="button" className="xn-mp-btn" onClick={onClose}>{t("取消")}</button>
    <button type="button" className="xn-mp-btn xn-mp-btn--primary" disabled={action.busy || !valid} onClick={() => void submit()}>{t("添加")}</button>
  </>}>
    <form className="xn-mp-form" onSubmit={event => { event.preventDefault(); if (valid && !action.busy) void submit(); }}>
      <label className="xn-mp-field"><span>{t("API 密钥")}</span>
        <input type="password" value={apiKey} disabled={action.busy} onChange={event => setApiKey(event.currentTarget.value)} autoComplete="off" spellCheck={false} /></label>
      <label className="xn-mp-field"><span>{t("备注（可选）")}</span>
        <input type="text" value={label} disabled={action.busy} onChange={event => setLabel(event.currentTarget.value)} autoComplete="off" /></label>
      <button type="submit" hidden />
    </form>
    {action.error && <Alert text={action.error} />}
  </Dialog>;
}
