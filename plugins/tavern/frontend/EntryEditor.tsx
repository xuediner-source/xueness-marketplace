/**
 * World entries as an editable list: the rows show what each entry is and when it fires; the open row
 * edits every field the activation engine reads. Used for world books and for a card's embedded book.
 */
import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Copy, Plus, Search, Trash2 } from 'lucide-react';
import type { BookEntry, SelectiveLogic } from './api';
import { useTr } from './i18n';
import { Count, TagInput } from './shared';

/** An entry being edited, with a key that survives reordering and deletion. */
export type DraftEntry = BookEntry & { uid: string };
let next = 0;
const uid = (): string => `e${Date.now().toString(36)}${(next += 1).toString(36)}`;
export const toDrafts = (entries: readonly BookEntry[]): DraftEntry[] => entries.map(entry => ({ ...entry, uid: uid() }));
export const fromDrafts = (entries: readonly DraftEntry[]): BookEntry[] => entries.map(({ uid: _uid, ...entry }) => entry);
export const blankEntry = (order = 100): DraftEntry => ({ uid: uid(), keys: [], secondary: [], content: '', constant: false, enabled: true, order, comment: '', position: 'before' });

const LOGIC: { id: SelectiveLogic; label: string }[] = [
  { id: 'and_any', label: '还含其中任一' }, { id: 'and_all', label: '还含全部' }, { id: 'not_any', label: '都不含' }, { id: 'not_all', label: '不全含' },
];

/** Problems that stop a save: an entry without content does nothing and would be dropped. */
export function entryProblems(entries: readonly DraftEntry[], t: (text: string) => string): string[] {
  return entries.flatMap((entry, index) => {
    const name = entry.comment || entry.keys[0] || `#${index + 1}`;
    const out: string[] = [];
    if (!entry.content.trim()) out.push(`${name}：${t('没有内容')}`);
    if (!entry.constant && !entry.keys.length) out.push(`${name}：${t('不是常驻条目，却没有关键词')}`);
    return out;
  });
}

export function EntryEditor({ entries, onChange, disabled }: { entries: DraftEntry[]; onChange(entries: DraftEntry[]): void; disabled?: boolean }) {
  const { t, tf } = useTr();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const shown = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return entries.filter(entry => words.every(word => `${entry.comment}\n${entry.keys.join(' ')}\n${entry.secondary.join(' ')}\n${entry.content}`.toLowerCase().includes(word)));
  }, [entries, query]);
  const patch = (id: string, change: Partial<BookEntry>) => onChange(entries.map(entry => entry.uid === id ? { ...entry, ...change } : entry));
  const add = () => { const entry = blankEntry(Math.max(100, ...entries.map(item => item.order))); onChange([...entries, entry]); setOpen(entry.uid); setQuery(''); };
  const duplicate = (entry: DraftEntry) => {
    const copy = { ...entry, uid: uid(), comment: entry.comment ? `${entry.comment} ${t('副本')}` : '' };
    const at = entries.findIndex(item => item.uid === entry.uid);
    onChange([...entries.slice(0, at + 1), copy, ...entries.slice(at + 1)]); setOpen(copy.uid);
  };
  const constant = entries.filter(entry => entry.constant && entry.enabled).length, off = entries.filter(entry => !entry.enabled).length;

  return <div className="xn-tavern-entrylist">
    <div className="xn-tavern-toolbar">
      <label className="xn-tavern-search xn-tavern-toolbar__grow"><Search size={14} aria-hidden="true" /><input type="search" value={query} placeholder={t('搜索标题、关键词或内容')} aria-label={t('搜索条目')} onChange={event => setQuery(event.currentTarget.value)} /></label>
      <span className="xn-tavern-muted">{tf('{0} 条 · 常驻 {1} · 停用 {2}', [entries.length, constant, off])}</span>
      <button type="button" className="xn-tavern-button" disabled={disabled || !entries.length} onClick={() => onChange(entries.map(entry => ({ ...entry, enabled: true })))}>{t('全部启用')}</button>
      <button type="button" className="xn-tavern-button" disabled={disabled || !entries.length} onClick={() => onChange(entries.map(entry => ({ ...entry, enabled: false })))}>{t('全部停用')}</button>
      <button type="button" className="xn-tavern-button xn-tavern-button--primary" disabled={disabled} onClick={add}><Plus size={14} aria-hidden="true" />{t('添加条目')}</button>
    </div>
    {!entries.length ? <p className="xn-tavern-muted xn-tavern-entrylist__empty">{t('还没有条目。一条只写一个人物、地点或规则：关键词出现在最近的对话里时，内容才写进请求。')}</p>
      : !shown.length ? <p className="xn-tavern-muted xn-tavern-entrylist__empty">{t('没有符合搜索的条目。')}</p>
      : <ul className="xn-tavern-entrylist__rows">{shown.map(entry => {
        const expanded = open === entry.uid;
        return <li key={entry.uid} className="xn-tavern-entry" data-open={expanded || undefined} data-off={!entry.enabled || undefined}>
          <div className="xn-tavern-entry__row">
            <input type="checkbox" aria-label={t('启用')} title={t('启用')} checked={entry.enabled} disabled={disabled} onChange={event => patch(entry.uid, { enabled: event.currentTarget.checked })} />
            <button type="button" className="xn-tavern-entry__title" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : entry.uid)}>
              {expanded ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
              <span className="xn-tavern-entry__name">
                <strong>{entry.comment || entry.keys.join(', ') || t('未命名条目')}</strong>
                <small>{entry.constant ? t('常驻') : entry.keys.join(', ') || t('没有关键词')}{entry.secondary.length ? ` · ${t(LOGIC.find(item => item.id === (entry.selectiveLogic ?? 'and_any'))!.label)} ${entry.secondary.join(', ')}` : ''}</small>
              </span>
            </button>
            <span className="xn-tavern-entry__meta" aria-hidden={expanded || undefined}>
              {entry.constant && <span className="xn-tavern-pill xn-tavern-pill--accent">{t('常驻')}</span>}
              <span className="xn-tavern-pill">{entry.position === 'after' ? t('角色后') : t('角色前')}</span>
              <span className="xn-tavern-pill" title={t('顺序')}>#{entry.order}</span>
              {(entry.probability ?? 100) < 100 && <span className="xn-tavern-pill" title={t('概率')}>{entry.probability}%</span>}
            </span>
            <button type="button" className="xn-tavern-icon" disabled={disabled} aria-label={t('复制条目')} title={t('复制条目')} onClick={() => duplicate(entry)}><Copy size={14} aria-hidden="true" /></button>
            <button type="button" className="xn-tavern-icon" disabled={disabled} aria-label={t('删除条目')} title={t('删除条目')} onClick={() => { onChange(entries.filter(item => item.uid !== entry.uid)); if (expanded) setOpen(null); }}><Trash2 size={14} aria-hidden="true" /></button>
          </div>
          {expanded && <EntryFields entry={entry} disabled={disabled} onChange={change => patch(entry.uid, change)} />}
        </li>;
      })}</ul>}
  </div>;
}

function EntryFields({ entry, onChange, disabled }: { entry: DraftEntry; onChange(change: Partial<BookEntry>): void; disabled?: boolean }) {
  const { t } = useTr();
  const tri = (value: boolean | null | undefined): string => value === true ? 'yes' : value === false ? 'no' : 'preset';
  const fromTri = (value: string): boolean | null => value === 'yes' ? true : value === 'no' ? false : null;
  return <div className="xn-tavern-entry__fields">
    <label className="xn-tavern-field"><span>{t('标题')}</span>
      <input type="text" value={entry.comment} maxLength={200} disabled={disabled} placeholder={t('只给你看，例如「林晓君」「学生会」')} onChange={event => onChange({ comment: event.currentTarget.value })} /></label>
    <div className="xn-tavern-seg" role="radiogroup" aria-label={t('激活方式')}>
      <button type="button" role="radio" aria-checked={!entry.constant} disabled={disabled} onClick={() => onChange({ constant: false })}><strong>{t('关键词触发')}</strong><small>{t('关键词出现在最近的对话里时写入')}</small></button>
      <button type="button" role="radio" aria-checked={entry.constant} disabled={disabled} onClick={() => onChange({ constant: true })}><strong>{t('常驻')}</strong><small>{t('每轮都写入，不看关键词')}</small></button>
    </div>
    <div className="xn-tavern-field"><span>{t('关键词')}</span>
      <TagInput label={t('关键词')} value={entry.keys} disabled={disabled} placeholder={t('回车或逗号添加；/正则/ 也可以')} onChange={keys => onChange({ keys })} /></div>
    <div className="xn-tavern-entry__secondary">
      <div className="xn-tavern-field"><span>{t('次要关键词')}</span>
        <TagInput label={t('次要关键词')} value={entry.secondary} disabled={disabled} placeholder={t('可选：进一步限定')} onChange={secondary => onChange({ secondary })} /></div>
      <label className="xn-tavern-field"><span>{t('次要关键词的要求')}</span>
        <select value={entry.selectiveLogic ?? 'and_any'} disabled={disabled || !entry.secondary.length} onChange={event => onChange({ selectiveLogic: event.currentTarget.value as SelectiveLogic })}>
          {LOGIC.map(item => <option key={item.id} value={item.id}>{t(item.label)}</option>)}
        </select></label>
    </div>
    <label className="xn-tavern-field"><span>{t('内容')}</span>
      <textarea rows={6} value={entry.content} maxLength={16384} disabled={disabled} placeholder={t('满足条件时写进请求的设定文字。支持 {{char}} 和 {{user}}。')} onChange={event => onChange({ content: event.currentTarget.value })} />
      <Count text={entry.content} max={16384} /></label>
    <div className="xn-tavern-grid xn-tavern-grid--tight">
      <label className="xn-tavern-field"><span>{t('位置')}</span>
        <select value={entry.position ?? 'before'} disabled={disabled} onChange={event => onChange({ position: event.currentTarget.value as 'before' | 'after' })}>
          <option value="before">{t('角色定义之前')}</option><option value="after">{t('角色定义之后')}</option>
        </select></label>
      <label className="xn-tavern-field" title={t('顺序（大的更靠后，超预算时先保留）')}><span>{t('顺序')}<small>{t('大的靠后')}</small></span>
        <input type="number" value={entry.order} min={-100000} max={100000} disabled={disabled} onChange={event => { const value = Number(event.currentTarget.value); if (Number.isFinite(value)) onChange({ order: Math.trunc(value) }); }} /></label>
      <label className="xn-tavern-field"><span>{t('触发概率 %')}</span>
        <input type="number" value={entry.probability ?? 100} min={0} max={100} disabled={disabled} onChange={event => { const value = Math.max(0, Math.min(100, Math.round(Number(event.currentTarget.value)))); if (Number.isFinite(value)) onChange({ probability: value >= 100 ? undefined : value }); }} /></label>
      <label className="xn-tavern-field"><span>{t('区分大小写')}</span>
        <select value={tri(entry.caseSensitive)} disabled={disabled} onChange={event => onChange({ caseSensitive: fromTri(event.currentTarget.value) })}>
          <option value="preset">{t('跟随预设')}</option><option value="yes">{t('区分')}</option><option value="no">{t('不区分')}</option>
        </select></label>
      <label className="xn-tavern-field"><span>{t('整词匹配')}</span>
        <select value={tri(entry.matchWholeWords)} disabled={disabled} onChange={event => onChange({ matchWholeWords: fromTri(event.currentTarget.value) })}>
          <option value="preset">{t('跟随预设')}</option><option value="yes">{t('是')}</option><option value="no">{t('否')}</option>
        </select></label>
    </div>
    <label className="xn-tavern-toggle"><input type="checkbox" checked={entry.preventRecursion === true} disabled={disabled} onChange={event => onChange({ preventRecursion: event.currentTarget.checked || undefined })} />
      <span><span>{t('不参与递归')}</span><small>{t('这条内容里的词不会再触发别的条目')}</small></span></label>
  </div>;
}
