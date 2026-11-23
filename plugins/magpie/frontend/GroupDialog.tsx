/** Create / edit a routing group: name, mode and an ordered member list. */
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import { createGroup, updateGroup, type Group, type GroupMode, type Model } from "./api";
import { useTr } from "./i18n";
import { Alert, Dialog, useAction } from "./ui";

export const MODES: Record<GroupMode, { label: string; hint: string }> = {
  smart: { label: "智能", hint: "按请求和各成员当前的额度自动挑选。" },
  order: { label: "顺序", hint: "按列表顺序使用，前一个不可用时才用下一个。" },
  rotate: { label: "轮换", hint: "在成员之间轮流分配请求。" },
  usage: { label: "用量均衡", hint: "优先使用已用额度最少的成员。" },
  pace: { label: "节奏", hint: "按额度窗口的消耗节奏，避免过早用完。" },
};
/** magpie has more routing modes than this panel edits (weight, fast, cheap, …); those are shown by name. */
const OTHER_MODE_HINT = "magpie 的其他分配方式；可在完整 magpie 控制台中修改。";
export const isEditableMode = (mode: string): mode is GroupMode => Object.hasOwn(MODES, mode);
export const modeInfo = (mode: string): { label: string; hint: string } => isEditableMode(mode) ? MODES[mode] : { label: mode, hint: OTHER_MODE_HINT };

export function GroupDialog({ group, models, onClose, onSaved }: { group: Group | null; models: Model[]; onClose(): void; onSaved(group: Group): void }) {
  const { t, tf } = useTr();
  const action = useAction();
  const [name, setName] = useState(group?.name ?? "");
  // An existing group keeps a mode this panel cannot edit until the user picks another one.
  const [mode, setMode] = useState<string>(group?.mode ?? "smart");
  const [members, setMembers] = useState<string[]>(group?.members.map(m => m.model) ?? []);
  const [query, setQuery] = useState("");

  const choices = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return models.filter(m => !m.group && !members.includes(m.id) && (!needle || `${m.name} ${m.id} ${m.provider ?? ""}`.toLowerCase().includes(needle))).slice(0, 60);
  }, [models, members, query]);
  const label = (id: string) => models.find(m => m.id === id)?.name ?? id;
  const move = (index: number, by: number) => setMembers(list => {
    const next = [...list]; const [item] = next.splice(index, 1); next.splice(index + by, 0, item!); return next;
  });
  const valid = name.trim() !== "" && members.length > 0;

  const submit = async () => {
    const editable = isEditableMode(mode) ? mode : null;
    const result = await action.run(signal => group
      ? updateGroup(group.id, { name: name.trim(), members, ...(editable ? { mode: editable } : {}) }, signal)
      : createGroup({ name: name.trim(), mode: editable ?? "smart", members }, signal));
    if (result) onSaved(result.group);
  };

  return <Dialog title={group ? t("编辑路由组") : t("新建路由组")} onClose={onClose} footer={<>
    <button type="button" className="xn-mp-btn" onClick={onClose}>{t("取消")}</button>
    <button type="button" className="xn-mp-btn xn-mp-btn--primary" disabled={action.busy || !valid} onClick={() => void submit()}>{t("保存")}</button>
  </>}>
    <div className="xn-mp-form">
      <label className="xn-mp-field"><span>{t("名称")}</span>
        <input type="text" value={name} disabled={action.busy} onChange={event => setName(event.currentTarget.value)} autoComplete="off" /></label>
      <label className="xn-mp-field"><span>{t("分配方式")}</span>
        <select value={mode} disabled={action.busy} onChange={event => setMode(event.currentTarget.value)}>
          {!isEditableMode(mode) && <option value={mode}>{mode}</option>}
          {(Object.keys(MODES) as GroupMode[]).map(id => <option key={id} value={id}>{t(MODES[id].label)}</option>)}
        </select>
        <small className="xn-mp-muted">{t(modeInfo(mode).hint)}</small></label>
      <div className="xn-mp-field">
        <span id="xn-mp-members-label">{tf("成员（{0}）", [members.length])}</span>
        {members.length === 0 ? <p className="xn-mp-muted">{t("从下面的列表添加模型。")}</p>
          : <ol className="xn-mp-picked" aria-labelledby="xn-mp-members-label">{members.map((id, index) => <li key={id}>
            <span className="xn-mp-members__n">{index + 1}</span><span className="xn-mp-picked__name">{label(id)}</span>
            <button type="button" className="xn-mp-icon" disabled={action.busy || index === 0} aria-label={tf("上移 {0}", [label(id)])} onClick={() => move(index, -1)}><ArrowUp size={14} aria-hidden="true" /></button>
            <button type="button" className="xn-mp-icon" disabled={action.busy || index === members.length - 1} aria-label={tf("下移 {0}", [label(id)])} onClick={() => move(index, 1)}><ArrowDown size={14} aria-hidden="true" /></button>
            <button type="button" className="xn-mp-icon" disabled={action.busy} aria-label={tf("移除 {0}", [label(id)])} onClick={() => setMembers(list => list.filter(m => m !== id))}><X size={14} aria-hidden="true" /></button>
          </li>)}</ol>}
      </div>
      <div className="xn-mp-field">
        <span>{t("添加模型")}</span>
        <input type="search" value={query} placeholder={t("搜索模型")} aria-label={t("搜索模型")} onChange={event => setQuery(event.currentTarget.value)} />
        <ul className="xn-mp-choices">{choices.length === 0 ? <li className="xn-mp-muted">{t("没有可添加的模型。")}</li>
          : choices.map(m => <li key={m.id}><button type="button" disabled={action.busy} onClick={() => setMembers(list => [...list, m.id])}>
            <span>{m.name}</span>{m.provider && <small className="xn-mp-muted">{m.provider}</small>}
          </button></li>)}</ul>
      </div>
    </div>
    {action.error && <Alert text={action.error} />}
  </Dialog>;
}
