/** World books: the library, which books are on for every roleplay chat, and each book's entries. */
import { useEffect, useState } from 'react';
import { BookOpen, Trash2 } from 'lucide-react';
import { failed, loadBook, patchBook, remove, saveSettings, type BookEntry, type WorldBook } from './api';
import { useTr } from './i18n';
import { Empty, Toggle, type ViewProps } from './shared';

const LOGIC = { and_any: 'AND ANY', and_all: 'AND ALL', not_any: 'NOT ANY', not_all: 'NOT ALL' } as const;

export function WorldbooksView({ library, busy, focus, run, setLibrary, explain }: ViewProps) {
  const { t, tf } = useTr();
  const [selectedId, setSelectedId] = useState<string | null>(focus ?? library.worldbooks[0]?.id ?? null);
  const [book, setBook] = useState<WorldBook | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  useEffect(() => {
    if (!selectedId) { setBook(null); return; }
    let alive = true;
    void loadBook(selectedId).then(result => { if (alive && !failed(result)) setBook(result.item); }).catch(() => undefined);
    return () => { alive = false; };
  }, [selectedId]);
  useEffect(() => { if (selectedId && !library.worldbooks.some(item => item.id === selectedId)) setSelectedId(library.worldbooks[0]?.id ?? null); }, [library.worldbooks, selectedId]);
  if (!library.worldbooks.length) return <Empty icon={<BookOpen size={20} />} title={t('世界书')} hint={t('还没有世界书。世界书是可选的：条目在关键词出现在最近的对话里时才写进请求，常驻条目始终写入。')} />;

  const global = library.settings.globalWorldbooks;
  const setGlobal = (id: string, on: boolean) => run(async () => {
    const result = await saveSettings({ globalWorldbooks: on ? [...global, id] : global.filter(item => item !== id) });
    if (failed(result)) explain(result); else setLibrary(result);
  });
  const toggle = (index: number, patch: Pick<Partial<BookEntry>, 'enabled' | 'constant'>) => run(async () => {
    if (!book) return;
    setBook({ ...book, entries: book.entries.map((entry, at) => at === index ? { ...entry, ...patch } : entry) });
    const result = await patchBook(book.id, [{ index, ...patch }]);
    if (failed(result)) explain(result); else setLibrary(result);
  });
  const drop = (id: string) => run(async () => { const result = await remove('worldbooks', id); if (failed(result)) explain(result); else setLibrary(result); });

  return <div className="xn-tavern-split">
    <aside className="xn-tavern-list" aria-label={t('世界书')}>
      <ul>{library.worldbooks.map(item => <li key={item.id}>
        <button type="button" className="xn-tavern-row" aria-current={item.id === selectedId || undefined} onClick={() => { setSelectedId(item.id); setOpen(null); }}>
          <span className="xn-tavern-row__icon" aria-hidden="true"><BookOpen size={16} /></span>
          <span className="xn-tavern-row__text"><strong>{item.name}</strong><small>{tf('{0} 条，常驻 {1} 条', [item.entries, item.constant])}</small></span>
          {global.includes(item.id) && <span className="xn-tavern-badge">{t('全局')}</span>}
        </button>
      </li>)}</ul>
    </aside>
    {book ? <article className="xn-tavern-detail">
      <header className="xn-tavern-hero xn-tavern-hero--compact">
        <div className="xn-tavern-hero__text"><h3>{book.name}</h3>{book.description && <p>{book.description}</p>}</div>
        <button type="button" className="xn-tavern-icon" disabled={busy} aria-label={t('移除')} title={t('移除')} onClick={() => void drop(book.id)}><Trash2 size={15} aria-hidden="true" /></button>
      </header>
      <section className="xn-tavern-card">
        <Toggle checked={global.includes(book.id)} disabled={busy} onChange={on => void setGlobal(book.id, on)} hint={t('对所有角色扮演对话启用')}>{t('全局')}</Toggle>
      </section>
      <section className="xn-tavern-card">
        <h4>{t('条目')} · {book.entries.length}</h4>
        <div className="xn-tavern-entries" role="table" aria-label={t('条目')}>
          <div role="row" className="xn-tavern-entries__head">
            <span role="columnheader">{t('启用')}</span><span role="columnheader">{t('常驻')}</span><span role="columnheader">{t('关键词')}</span>
            <span role="columnheader">{t('位置')}</span><span role="columnheader">{t('顺序')}</span><span role="columnheader">{t('概率')}</span>
          </div>
          {book.entries.map((entry, index) => <div role="row" key={index} className="xn-tavern-entries__row" data-off={!entry.enabled || undefined}>
            <span role="cell"><input type="checkbox" aria-label={t('启用')} checked={entry.enabled} disabled={busy} onChange={event => void toggle(index, { enabled: event.currentTarget.checked })} /></span>
            <span role="cell"><input type="checkbox" aria-label={t('常驻')} checked={entry.constant} disabled={busy} onChange={event => void toggle(index, { constant: event.currentTarget.checked })} /></span>
            <span role="cell" className="xn-tavern-entries__keys">
              <button type="button" className="xn-tavern-link" aria-expanded={open === index} onClick={() => setOpen(open === index ? null : index)}>
                {entry.comment || entry.keys.join(', ') || '—'}
              </button>
              <small>{entry.keys.join(', ')}{entry.secondary.length ? ` · ${LOGIC[entry.selectiveLogic ?? 'and_any']} ${entry.secondary.join(', ')}` : ''}</small>
              {open === index && <p className="xn-tavern-prose">{entry.content}</p>}
            </span>
            <span role="cell">{entry.position === 'after' ? t('角色后') : t('角色前')}</span>
            <span role="cell">{entry.order}</span>
            <span role="cell">{entry.probability ?? 100}%</span>
          </div>)}
        </div>
      </section>
    </article> : <Empty title={t('在左侧选择一本世界书。')} />}
  </div>;
}
