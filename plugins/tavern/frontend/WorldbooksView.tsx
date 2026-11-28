/** World books: the library, which books are on for every roleplay chat, and each book's entries, editable. */
import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Download, Plus, Search, Trash2 } from 'lucide-react';
import { bookJson, createBook, failed, loadBook, remove, saveBook, saveFile, saveSettings, type WorldBook } from './api';
import { useTr } from './i18n';
import { EntryEditor, entryProblems, fromDrafts, toDrafts, type DraftEntry } from './EntryEditor';
import { ConfirmButton, Empty, Toggle, type ViewProps } from './shared';

type Draft = { name: string; description: string; entries: DraftEntry[] };
const snapshot = (draft: Draft): string => JSON.stringify({ ...draft, entries: fromDrafts(draft.entries) });

export function WorldbooksView({ library, busy, focus, run, setLibrary, explain, notify }: ViewProps) {
  const { t, tf } = useTr();
  const [selectedId, setSelectedId] = useState<string | null>(focus ?? library.worldbooks[0]?.id ?? null);
  const [book, setBook] = useState<WorldBook | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saved, setSaved] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [newName, setNewName] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedId) { setBook(null); setDraft(null); return; }
    let alive = true;
    void loadBook(selectedId).then(result => {
      if (!alive || failed(result)) return;
      const next: Draft = { name: result.item.name, description: result.item.description, entries: toDrafts(result.item.entries) };
      setBook(result.item); setDraft(next); setSaved(snapshot(next));
    }).catch(() => undefined);
    return () => { alive = false; };
  }, [selectedId]);
  useEffect(() => { if (selectedId && !library.worldbooks.some(item => item.id === selectedId)) setSelectedId(library.worldbooks[0]?.id ?? null); }, [library.worldbooks, selectedId]);
  const books = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return library.worldbooks.filter(item => words.every(word => `${item.name}\n${item.description}`.toLowerCase().includes(word)));
  }, [library.worldbooks, query]);

  const dirty = draft !== null && snapshot(draft) !== saved;
  const problems = draft ? [...(draft.name.trim() ? [] : [t('名称不能为空')]), ...entryProblems(draft.entries, t)] : [];
  const choose = (id: string) => { if (id === selectedId) return; if (dirty) setPending(id); else setSelectedId(id); };
  const global = library.settings.globalWorldbooks;
  const setGlobal = (id: string, on: boolean) => run(async () => {
    const result = await saveSettings({ globalWorldbooks: on ? [...global, id] : global.filter(item => item !== id) });
    if (failed(result)) explain(result); else setLibrary(result);
  });
  const save = () => run(async () => {
    if (!book || !draft || problems.length) return;
    const result = await saveBook(book.id, { name: draft.name.trim(), description: draft.description, entries: fromDrafts(draft.entries) });
    if (failed(result)) { explain(result); return; }
    setLibrary(result); setSaved(snapshot(draft)); notify(t('已保存'));
  });
  const create = (name: string) => run(async () => {
    const result = await createBook(name.trim());
    if (failed(result)) { explain(result); return; }
    setLibrary(result); setNewName(null); if (result.itemId) setSelectedId(result.itemId);
  });
  const drop = (id: string) => run(async () => { const result = await remove('worldbooks', id); if (failed(result)) explain(result); else setLibrary(result); });
  const exportBook = () => { if (draft) saveFile(`${draft.name || 'world'}.json`, bookJson({ name: draft.name, description: draft.description, entries: fromDrafts(draft.entries) })); };

  const creator = newName !== null && <form className="xn-tavern-inline-form" onSubmit={event => { event.preventDefault(); if (newName.trim()) void create(newName); }}>
    <input type="text" value={newName} maxLength={120} autoFocus placeholder={t('世界书名称')} aria-label={t('世界书名称')} onChange={event => setNewName(event.currentTarget.value)} />
    <button type="submit" className="xn-tavern-button xn-tavern-button--primary" disabled={busy || !newName.trim()}>{t('创建')}</button>
    <button type="button" className="xn-tavern-button xn-tavern-button--quiet" onClick={() => setNewName(null)}>{t('取消')}</button>
  </form>;
  if (!library.worldbooks.length) return <Empty icon={<BookOpen size={20} />} title={t('世界书')} hint={t('还没有世界书。世界书是可选的：条目在关键词出现在最近的对话里时才写进请求，常驻条目始终写入。')}>
    {creator || <button type="button" className="xn-tavern-button xn-tavern-button--primary" onClick={() => setNewName('')}><Plus size={14} aria-hidden="true" />{t('新建世界书')}</button>}
  </Empty>;

  return <div className="xn-tavern-split">
    <aside className="xn-tavern-list" aria-label={t('世界书')}>
      <div className="xn-tavern-list__actions"><button type="button" className="xn-tavern-button" disabled={busy} onClick={() => setNewName('')}><Plus size={14} aria-hidden="true" />{t('新建世界书')}</button></div>
      {creator}
      {library.worldbooks.length > 6 && <label className="xn-tavern-search"><Search size={14} aria-hidden="true" /><input type="search" value={query} placeholder={t('搜索世界书')} aria-label={t('搜索世界书')} onChange={event => setQuery(event.currentTarget.value)} /></label>}
      <ul>{books.map(item => <li key={item.id}>
        <button type="button" className="xn-tavern-row" aria-current={item.id === selectedId || undefined} onClick={() => choose(item.id)}>
          <span className="xn-tavern-row__icon" aria-hidden="true"><BookOpen size={16} /></span>
          <span className="xn-tavern-row__text"><strong>{item.name}</strong><small>{tf('{0} 条，常驻 {1} 条', [item.entries, item.constant])}</small></span>
          {global.includes(item.id) && <span className="xn-tavern-badge">{t('全局')}</span>}
        </button>
      </li>)}</ul>
    </aside>
    {book && draft ? <article className="xn-tavern-detail xn-tavern-form">
      {pending && <div className="xn-tavern-unsaved" role="alert"><span>{t('这本世界书还有没保存的修改。')}</span>
        <button type="button" className="xn-tavern-button" onClick={() => setPending(null)}>{t('继续编辑')}</button>
        <button type="button" className="xn-tavern-button xn-tavern-button--danger" onClick={() => { const id = pending; setPending(null); setSelectedId(id); }}>{t('放弃修改')}</button></div>}
      <header className="xn-tavern-hero xn-tavern-hero--compact">
        <span className="xn-tavern-row__icon xn-tavern-row__icon--large" aria-hidden="true"><BookOpen size={20} /></span>
        <div className="xn-tavern-hero__text">
          <label className="xn-tavern-field"><span>{t('名称')}</span><input type="text" value={draft.name} maxLength={120} disabled={busy} onChange={event => { const name = event.currentTarget.value; setDraft(current => current && { ...current, name }); }} /></label>
        </div>
        <div className="xn-tavern-hero__actions">
          <button type="button" className="xn-tavern-button" onClick={exportBook} title={t('导出为 SillyTavern 世界书 JSON')}><Download size={14} aria-hidden="true" />{t('导出')}</button>
          <ConfirmButton label={t('删除世界书')} confirm={t('确认删除')} quiet icon={<Trash2 size={15} aria-hidden="true" />} disabled={busy} onConfirm={() => void drop(book.id)} />
        </div>
      </header>
      <section className="xn-tavern-card">
        <label className="xn-tavern-field"><span>{t('说明')}</span>
          <textarea rows={2} value={draft.description} maxLength={2000} disabled={busy} placeholder={t('可选：这本书写的是什么')} onChange={event => { const description = event.currentTarget.value; setDraft(current => current && { ...current, description }); }} /></label>
        <Toggle checked={global.includes(book.id)} disabled={busy} onChange={on => void setGlobal(book.id, on)} hint={t('对所有角色扮演对话启用')}>{t('全局')}</Toggle>
      </section>
      <section className="xn-tavern-card">
        <h4>{t('条目')}</h4>
        <EntryEditor entries={draft.entries} disabled={busy} onChange={entries => setDraft(current => current && { ...current, entries })} />
      </section>
      {(dirty || problems.length > 0) && <footer className="xn-tavern-form__footer">
        {problems.length > 0 && <ul className="xn-tavern-problems" aria-label={t('保存前要处理')}>{problems.slice(0, 4).map(problem => <li key={problem}>{problem}</li>)}{problems.length > 4 && <li>{tf('还有 {0} 处', [problems.length - 4])}</li>}</ul>}
        <button type="button" className="xn-tavern-button" disabled={busy || !dirty} onClick={() => { const next = JSON.parse(saved) as { name: string; description: string; entries: WorldBook['entries'] }; setDraft({ ...next, entries: toDrafts(next.entries) }); }}>{t('放弃修改')}</button>
        <button type="button" className="xn-tavern-button xn-tavern-button--primary" disabled={busy || !dirty || problems.length > 0} onClick={() => void save()}>{t('保存')}</button>
      </footer>}
    </article> : <Empty title={t('在左侧选择一本世界书。')} />}
  </div>;
}
