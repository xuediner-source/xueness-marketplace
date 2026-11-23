/** Routing groups: one model name that spreads requests over several models. */
import { useState } from "react";
import { Plus } from "lucide-react";
import { deleteGroup, getGroups, getModels, updateGroup, type Group } from "./api";
import { GroupDialog, modeInfo } from "./GroupDialog";
import { useTr } from "./i18n";
import { Alert, ConfirmDialog, LoadState, Pill, Switch, useAction, useLoad } from "./ui";

export function GroupsTab({ onModelsChanged, onSelectModel }: { onModelsChanged(): void; onSelectModel?: (profileId: string) => void }) {
  const { t, tf } = useTr();
  const list = useLoad(async signal => {
    const [groups, models] = await Promise.all([getGroups(signal), getModels(signal)]);
    return { groups: groups.groups, models: models.models };
  });
  const action = useAction();
  const [dialog, setDialog] = useState<{ edit: Group | null } | null>(null);
  const [removing, setRemoving] = useState<Group | null>(null);

  const saved = (group: Group) => {
    list.update(d => ({ ...d, groups: d.groups.some(g => g.id === group.id) ? d.groups.map(g => g.id === group.id ? group : g) : [...d.groups, group] }));
    onModelsChanged();
    list.reload();
    setDialog(null);
  };
  const toggle = async (group: Group, enabled: boolean) => {
    const result = await action.run(signal => updateGroup(group.id, { enabled }, signal));
    if (result) saved(result.group);
  };
  const remove = async (group: Group) => {
    const result = await action.run(signal => deleteGroup(group.id, signal));
    if (!result) return;
    list.update(d => ({ ...d, groups: d.groups.filter(g => g.id !== group.id) }));
    setRemoving(null);
    onModelsChanged();
  };

  if (!list.data) return <LoadState loading={list.loading} error={list.error} data={list.data} retry={list.reload} />;
  const { groups, models } = list.data;
  // The group's own entry in the gateway's model list (`group/<id>`); absent until magpie lists it.
  const groupModel = (group: Group) => models.find(m => m.group && (m.id === `group/${group.id}` || m.id === group.id || m.name === group.name));
  const modelName = (id: string) => models.find(m => m.id === id)?.name ?? id;
  return <div className="xn-mp-stack">
    <div className="xn-mp-toolbar">
      <span className="xn-mp-muted">{tf("{0} 个路由组", [groups.length])}</span>
      <button type="button" className="xn-mp-btn xn-mp-btn--primary" disabled={action.busy} onClick={() => setDialog({ edit: null })}><Plus size={13} aria-hidden="true" />{t("新建路由组")}</button>
    </div>
    {action.error && !removing && <Alert text={action.error} />}
    {groups.length === 0 && <p className="xn-mp-muted xn-mp-pad">{t("还没有路由组。路由组把多个模型合成一个名字，按规则分配请求。")}</p>}
    {groups.map(g => <section key={g.id} className="xn-mp-card" data-off={g.enabled ? undefined : ""}>
      <header className="xn-mp-card__head">
        <div className="xn-mp-card__title"><h4>{g.name}</h4><Pill tone="info">{t(modeInfo(g.mode).label)}</Pill></div>
        <Switch checked={g.enabled} disabled={action.busy} label={tf(g.enabled ? "停用 {0}" : "启用 {0}", [g.name])} onChange={value => void toggle(g, value)} />
      </header>
      <p className="xn-mp-muted xn-mp-meta">{t(modeInfo(g.mode).hint)}</p>
      {g.members.length === 0 ? <p className="xn-mp-muted">{t("没有成员")}</p>
        : <ol className="xn-mp-members">{g.members.map((m, index) => <li key={`${m.model}-${index}`}>
          <span className="xn-mp-members__n">{index + 1}</span><span>{modelName(m.model)}</span>{m.account && <span className="xn-mp-chip">{m.account}</span>}
        </li>)}</ol>}
      <footer className="xn-mp-actions">
        {onSelectModel && (() => { const entry = groupModel(g); return <button type="button" className="xn-mp-btn" disabled={!g.enabled || !entry}
          onClick={() => entry && onSelectModel(entry.profileId)}>{t("在会话中使用")}</button>; })()}
        <button type="button" className="xn-mp-btn" disabled={action.busy} onClick={() => setDialog({ edit: g })}>{t("编辑")}</button>
        <button type="button" className="xn-mp-btn xn-mp-btn--quiet xn-mp-btn--danger-text" disabled={action.busy} onClick={() => { action.clear(); setRemoving(g); }}>{t("删除")}</button>
      </footer>
    </section>)}
    {dialog && <GroupDialog group={dialog.edit} models={models} onClose={() => setDialog(null)} onSaved={saved} />}
    {removing && <ConfirmDialog title={t("删除路由组")} text={tf("确定删除路由组「{0}」吗？", [removing.name])} confirm={t("删除")}
      busy={action.busy} error={action.error} onClose={() => setRemoving(null)} onConfirm={() => void remove(removing)} />}
  </div>;
}
