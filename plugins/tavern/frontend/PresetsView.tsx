/**
 * Presets: how each request of a roleplay chat is assembled. Main prompt, the order and on/off state of
 * the sections, the card's own prompts, the author's note and its depth, post-history instructions, world
 * information scanning, and the greeting and tool switches. The built-in preset is read-only.
 */
import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Copy, GripVertical, Plus, SlidersHorizontal, Star, Trash2 } from 'lucide-react';
import { useLocale } from '@xueness/host';
import { failed, remove, savePreset, saveSettings, type Preset, type SectionId } from './api';
import { useTr } from './i18n';
import { ConfirmButton, Count, Empty, NumberField, Toggle, type ViewProps } from './shared';

const SECTION_LABELS: Record<SectionId, string> = {
  main: '主提示', persona: '人设', description: '描述', personality: '性格', scenario: '场景',
  worldBefore: '世界书（角色前）', examples: '示例对话', worldAfter: '世界书（角色后）',
};
const SECTION_EN: Record<SectionId, string> = {
  main: 'Main prompt', persona: 'Persona', description: 'Description', personality: 'Personality', scenario: 'Scenario',
  worldBefore: 'World info (before)', examples: 'Example dialogue', worldAfter: 'World info (after)',
};

export function PresetsView({ library, busy, focus, run, setLibrary, explain, notify }: ViewProps) {
  const { t } = useTr();
  const [selectedId, setSelectedId] = useState(focus ?? library.settings.activePresetId);
  const selected = library.presets.find(item => item.id === selectedId) ?? library.presets[0]!;
  const [draft, setDraft] = useState<Preset>(selected);
  useEffect(() => { setDraft(selected); }, [selected]);
  const english = useLocale() === 'en';
  const active = library.settings.activePresetId;
  const readOnly = !!draft.builtin;
  const dirty = JSON.stringify(draft) !== JSON.stringify(selected);

  const create = (from: Preset) => run(async () => {
    const result = await savePreset({ ...from, id: undefined, builtin: undefined, name: `${from.name} ${t('副本')}` });
    if (failed(result)) explain(result); else { setLibrary(result); if (result.itemId) setSelectedId(result.itemId); }
  });
  const save = () => run(async () => {
    const result = await savePreset(draft);
    if (failed(result)) explain(result); else { setLibrary(result); notify(t('已保存')); }
  });
  const activate = (id: string) => run(async () => { const result = await saveSettings({ activePresetId: id }); if (failed(result)) explain(result); else setLibrary(result); });
  const drop = (id: string) => run(async () => {
    const result = await remove('presets', id);
    if (failed(result)) explain(result); else { setLibrary(result); setSelectedId(result.settings.activePresetId); }
  });
  const set = <K extends keyof Preset>(key: K, value: Preset[K]) => setDraft(current => ({ ...current, [key]: value }));
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);
  const move = (index: number, by: number) => setDraft(current => {
    const sections = [...current.sections], target = index + by;
    if (target < 0 || target >= sections.length) return current;
    const [item] = sections.splice(index, 1);
    sections.splice(target, 0, item!);
    return { ...current, sections };
  });
  const world = (patch: Partial<Preset['worldInfo']>) => setDraft(current => ({ ...current, worldInfo: { ...current.worldInfo, ...patch } }));

  if (!library.presets.length) return <Empty icon={<SlidersHorizontal size={20} />} title={t('在左侧选择一个预设。')} />;
  return <div className="xn-tavern-split">
    <aside className="xn-tavern-list" aria-label={t('预设')}>
      <div className="xn-tavern-list__actions">
        <button type="button" className="xn-tavern-button" disabled={busy} onClick={() => void create(library.presets[0]!)}><Plus size={14} aria-hidden="true" />{t('新建')}</button>
      </div>
      <ul>{library.presets.map(item => <li key={item.id}>
        <button type="button" className="xn-tavern-row" aria-current={item.id === selectedId || undefined} onClick={() => setSelectedId(item.id)}>
          <span className="xn-tavern-row__icon" aria-hidden="true"><SlidersHorizontal size={16} /></span>
          <span className="xn-tavern-row__text"><strong>{item.name}</strong><small>{item.builtin ? t('内置') : new Date(item.updatedAt).toLocaleDateString()}</small></span>
          {item.id === active && <span className="xn-tavern-badge">{t('当前')}</span>}
        </button>
      </li>)}</ul>
    </aside>
    <article className="xn-tavern-detail xn-tavern-form">
      <header className="xn-tavern-hero xn-tavern-hero--compact">
        <div className="xn-tavern-hero__text">
          <label className="xn-tavern-field"><span>{t('名称')}</span><input type="text" value={draft.name} maxLength={60} disabled={readOnly} onChange={event => set('name', event.currentTarget.value)} /></label>
        </div>
        <div className="xn-tavern-hero__actions">
          {draft.id !== active && <button type="button" className="xn-tavern-button" disabled={busy} onClick={() => void activate(draft.id)}><Star size={14} aria-hidden="true" />{t('设为当前')}</button>}
          <button type="button" className="xn-tavern-button" disabled={busy} onClick={() => void create(draft)}><Copy size={14} aria-hidden="true" />{t('复制')}</button>
          {!readOnly && <ConfirmButton label={t('删除预设')} confirm={t('确认删除')} quiet icon={<Trash2 size={15} aria-hidden="true" />} disabled={busy} onConfirm={() => void drop(draft.id)} />}
        </div>
      </header>
      {readOnly && <p className="xn-tavern-note">{t('内置预设不能直接修改，复制后编辑。')}</p>}
      <p className="xn-tavern-note">{t('采样参数（温度等）由模型连接决定；导入时会忽略。')}</p>

      <section className="xn-tavern-card">
        <h4>{t('主提示')}</h4>
        <textarea rows={5} aria-label={t('主提示')} value={draft.mainPrompt} disabled={readOnly} onChange={event => set('mainPrompt', event.currentTarget.value)} />
        <Count text={draft.mainPrompt} />
        <small className="xn-tavern-muted">{'{{char}} {{user}} {{persona}} {{scenario}} {{time}} {{date}} {{random:a,b}}'}</small>
        <Toggle checked={draft.preferCardSystemPrompt} disabled={readOnly} onChange={value => set('preferCardSystemPrompt', value)}>{t('角色卡自带系统提示时替换主提示')}</Toggle>
      </section>

      <section className="xn-tavern-card">
        <header><h4>{t('段落顺序')}</h4><span className="xn-tavern-muted">{t('拖动或用箭头调整；越靠前越早发给模型。取消勾选的段落不发送。')}</span></header>
        <ol className="xn-tavern-sections">{draft.sections.map((section, index) => <li key={section.id} data-off={!section.enabled || undefined} data-drop={dropAt === index || undefined}
          draggable={!readOnly} onDragStart={event => { setDragFrom(index); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', section.id); }}
          onDragOver={event => { if (dragFrom === null) return; event.preventDefault(); setDropAt(index); }} onDragLeave={() => setDropAt(current => current === index ? null : current)}
          onDrop={event => { event.preventDefault(); if (dragFrom !== null && dragFrom !== index) move(dragFrom, index - dragFrom); setDragFrom(null); setDropAt(null); }}
          onDragEnd={() => { setDragFrom(null); setDropAt(null); }}>
          {!readOnly && <GripVertical size={14} aria-hidden="true" className="xn-tavern-grip" />}
          <input type="checkbox" aria-label={english ? SECTION_EN[section.id] : SECTION_LABELS[section.id]} checked={section.enabled} disabled={readOnly}
            onChange={event => { const enabled = event.currentTarget.checked; setDraft(current => ({ ...current, sections: current.sections.map(item => item.id === section.id ? { ...item, enabled } : item) })); }} />
          <span>{english ? SECTION_EN[section.id] : SECTION_LABELS[section.id]}</span>
          <button type="button" className="xn-tavern-icon" aria-label={t('上移')} disabled={readOnly || index === 0} onClick={() => move(index, -1)}><ArrowUp size={14} aria-hidden="true" /></button>
          <button type="button" className="xn-tavern-icon" aria-label={t('下移')} disabled={readOnly || index === draft.sections.length - 1} onClick={() => move(index, 1)}><ArrowDown size={14} aria-hidden="true" /></button>
        </li>)}</ol>
      </section>

      <section className="xn-tavern-card">
        <h4>{t('作者注释')}</h4>
        <textarea rows={3} aria-label={t('作者注释')} value={draft.authorNote.text} disabled={readOnly} onChange={event => { const text = event.currentTarget.value; setDraft(current => ({ ...current, authorNote: { ...current.authorNote, text } })); }} />
        <NumberField label={t('深度')} value={draft.authorNote.depth} min={0} max={20} disabled={readOnly} onChange={depth => setDraft(current => ({ ...current, authorNote: { ...current.authorNote, depth } }))} />
      </section>

      <section className="xn-tavern-card">
        <h4>{t('后置指令')}</h4>
        <textarea rows={3} aria-label={t('后置指令')} value={draft.postHistory} disabled={readOnly} onChange={event => set('postHistory', event.currentTarget.value)} />
        <Toggle checked={draft.preferCardPostHistory} disabled={readOnly} onChange={value => set('preferCardPostHistory', value)}>{t('角色卡自带后置指令时替换后置指令')}</Toggle>
      </section>

      <section className="xn-tavern-card">
        <h4>{t('世界书扫描')}</h4>
        <div className="xn-tavern-grid">
          <NumberField label={t('扫描深度')} value={draft.worldInfo.scanDepth} min={1} max={50} disabled={readOnly} onChange={scanDepth => world({ scanDepth })} />
          <NumberField label={t('字符预算')} value={draft.worldInfo.budgetChars} min={500} max={40000} step={500} disabled={readOnly} onChange={budgetChars => world({ budgetChars })} />
          <NumberField label={t('最大递归层数')} value={draft.worldInfo.maxRecursion} min={1} max={5} disabled={readOnly || !draft.worldInfo.recursive} onChange={maxRecursion => world({ maxRecursion })} />
        </div>
        <Toggle checked={draft.worldInfo.recursive} disabled={readOnly} onChange={recursive => world({ recursive })}>{t('递归扫描')}</Toggle>
        <Toggle checked={draft.worldInfo.caseSensitive} disabled={readOnly} onChange={caseSensitive => world({ caseSensitive })}>{t('区分大小写')}</Toggle>
        <Toggle checked={draft.worldInfo.matchWholeWords} disabled={readOnly} onChange={matchWholeWords => world({ matchWholeWords })}>{t('整词匹配')}</Toggle>
        <Toggle checked={draft.worldInfo.includeCharacterBook} disabled={readOnly} onChange={includeCharacterBook => world({ includeCharacterBook })}>{t('使用角色卡内嵌世界书')}</Toggle>
      </section>

      <section className="xn-tavern-card">
        <Toggle checked={draft.greetingInHistory} disabled={readOnly} onChange={value => set('greetingInHistory', value)}>{t('把开场白作为角色的第一条消息')}</Toggle>
        <Toggle checked={draft.noTools} disabled={readOnly} onChange={value => set('noTools', value)}>{t('角色扮演时不提供工作区工具')}</Toggle>
      </section>

      {!readOnly && <footer className="xn-tavern-form__footer">
        <button type="button" className="xn-tavern-button" disabled={busy || !dirty} onClick={() => setDraft(selected)}>{t('放弃修改')}</button>
        <button type="button" className="xn-tavern-button xn-tavern-button--primary" disabled={busy || !dirty} onClick={() => void save()}>{t('保存')}</button>
      </footer>}
    </article>
  </div>;
}
