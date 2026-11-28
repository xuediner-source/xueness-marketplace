/**
 * Models in Xueness: what magpie's gateway offers, routing groups first, each one usable in a conversation.
 * Loading the list also refreshes what the composer and Model settings show.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Layers, RotateCw, Search } from "lucide-react";
import { getModels } from "./api";
import { useTr } from "./i18n";
import { LoadState, Pill, fmtContext, useLoad } from "./ui";

export function ModelsTab({ onSelectModel, onModelsChanged }: { onSelectModel?: (profileId: string) => void; onModelsChanged?: () => void }) {
  const { t, tf } = useTr();
  const { data, loading, error, reload } = useLoad(async signal => (await getModels(signal)).models);
  const [query, setQuery] = useState("");
  const changed = useRef(onModelsChanged);
  changed.current = onModelsChanged;
  // Each fresh list is what the composer should offer too.
  useEffect(() => { if (data) changed.current?.(); }, [data]);
  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = (data ?? []).filter(m => !needle || `${m.name} ${m.id} ${m.provider ?? ""}`.toLowerCase().includes(needle));
    return list.sort((a, b) => Number(b.group) - Number(a.group) || a.name.localeCompare(b.name));
  }, [data, query]);
  if (!data) return <LoadState loading={loading} error={error} data={data} retry={reload} />;
  return <div className="xn-mp-stack">
    <p className="xn-mp-muted">{t("magpie 控制台里配置的模型和路由组会出现在这里，也会出现在会话的模型选择和「模型设置」里。")}</p>
    <div className="xn-mp-toolbar">
      <label className="xn-mp-search"><Search size={14} aria-hidden="true" />
        <input type="search" value={query} placeholder={t("搜索模型")} aria-label={t("搜索模型")} onChange={event => setQuery(event.currentTarget.value)} />
      </label>
      <span className="xn-mp-toolbar__end">
        <span className="xn-mp-muted">{tf("{0} 个模型", [shown.length])}</span>
        <button type="button" className="xn-mp-btn" disabled={loading} onClick={reload}><RotateCw size={13} aria-hidden="true" />{t("刷新")}</button>
      </span>
    </div>
    {shown.length === 0
      ? <p className="xn-mp-muted xn-mp-pad">{data.length === 0 ? t("还没有模型。在「Magpie 控制台」里添加供应商或登录账号后，点「刷新」。") : t("没有匹配的模型。")}</p>
      : <ul className="xn-mp-rows">{shown.map(m => <li key={m.id} className="xn-mp-row">
        <div className="xn-mp-row__main">
          <strong>{m.group && <Layers size={13} aria-hidden="true" />}{m.name}</strong>
          <small className="xn-mp-mono">{m.id}</small>
        </div>
        <div className="xn-mp-row__meta">
          {m.group && <Pill tone="info">{t("路由组")}</Pill>}
          {m.provider && <span className="xn-mp-chip">{m.provider}</span>}
          {m.contextWindow !== null && <span className="xn-mp-muted" title={t("上下文窗口")}>{fmtContext(m.contextWindow)}</span>}
        </div>
        {onSelectModel && <button type="button" className="xn-mp-btn" onClick={() => onSelectModel(m.profileId)}>{t("在会话中使用")}</button>}
      </li>)}</ul>}
  </div>;
}
