/** Personas: who the person is in the story. The active one is the default when a chat starts. */
import { useEffect, useState } from 'react';
import { Plus, Star, Trash2, UserRound } from 'lucide-react';
import { failed, remove, savePersona, saveSettings, type Persona } from './api';
import { useTr } from './i18n';
import { Avatar, Empty, type ViewProps } from './shared';

export function PersonasView({ library, busy, run, setLibrary, explain, notify }: ViewProps) {
  const { t } = useTr();
  const [selectedId, setSelectedId] = useState<string | null>(library.settings.activePersonaId ?? library.personas[0]?.id ?? null);
  const selected = library.personas.find(item => item.id === selectedId) ?? null;
  const [draft, setDraft] = useState<Pick<Persona, 'name' | 'description'>>({ name: selected?.name ?? '', description: selected?.description ?? '' });
  useEffect(() => { setDraft({ name: selected?.name ?? '', description: selected?.description ?? '' }); }, [selected]);
  const active = library.settings.activePersonaId;

  const create = () => run(async () => {
    const result = await savePersona({ name: t('新人设'), description: '' });
    if (failed(result)) explain(result); else { setLibrary(result); if (result.itemId) setSelectedId(result.itemId); }
  });
  const save = () => run(async () => {
    if (!selected) return;
    const result = await savePersona({ id: selected.id, ...draft });
    if (failed(result)) explain(result); else { setLibrary(result); notify(t('已保存')); }
  });
  const activate = (id: string | null) => run(async () => { const result = await saveSettings({ activePersonaId: id }); if (failed(result)) explain(result); else setLibrary(result); });
  const drop = (id: string) => run(async () => {
    const result = await remove('personas', id);
    if (failed(result)) { explain(result); return; }
    if (active === id) { const cleared = await saveSettings({ activePersonaId: null }); if (!failed(cleared)) { setLibrary(cleared); return; } }
    setLibrary(result); setSelectedId(null);
  });

  return <div className="xn-tavern-split">
    <aside className="xn-tavern-list" aria-label={t('人设')}>
      <div className="xn-tavern-list__actions"><button type="button" className="xn-tavern-button" disabled={busy} onClick={() => void create()}><Plus size={14} aria-hidden="true" />{t('新建')}</button></div>
      <ul>{library.personas.map(item => <li key={item.id}>
        <button type="button" className="xn-tavern-row" aria-current={item.id === selectedId || undefined} onClick={() => setSelectedId(item.id)}>
          <Avatar name={item.name} size={32} />
          <span className="xn-tavern-row__text"><strong>{item.name}</strong><small>{item.description.slice(0, 40)}</small></span>
          {item.id === active && <span className="xn-tavern-badge">{t('当前')}</span>}
        </button>
      </li>)}</ul>
    </aside>
    {selected ? <article className="xn-tavern-detail xn-tavern-form">
      <header className="xn-tavern-hero xn-tavern-hero--compact">
        <Avatar name={draft.name || '?'} size={56} />
        <div className="xn-tavern-hero__text"><label className="xn-tavern-field"><span>{t('名称')}</span>
          <input type="text" value={draft.name} maxLength={60} onChange={event => { const name = event.currentTarget.value; setDraft(current => ({ ...current, name })); }} /></label></div>
        <div className="xn-tavern-hero__actions">
          {selected.id !== active ? <button type="button" className="xn-tavern-button" disabled={busy} onClick={() => void activate(selected.id)}><Star size={14} aria-hidden="true" />{t('设为当前')}</button>
            : <button type="button" className="xn-tavern-button" disabled={busy} onClick={() => void activate(null)}>{t('无人设')}</button>}
          <button type="button" className="xn-tavern-icon" disabled={busy} aria-label={t('删除')} title={t('删除')} onClick={() => void drop(selected.id)}><Trash2 size={15} aria-hidden="true" /></button>
        </div>
      </header>
      <section className="xn-tavern-card">
        <h4>{t('人设描述')}</h4>
        <textarea rows={8} aria-label={t('人设描述')} value={draft.description} maxLength={8000} onChange={event => { const description = event.currentTarget.value; setDraft(current => ({ ...current, description })); }} />
        <small className="xn-tavern-muted">{'{{user}} = ' + (draft.name || 'User')}</small>
      </section>
      <footer className="xn-tavern-form__footer">
        <button type="button" className="xn-tavern-button xn-tavern-button--primary" disabled={busy || !draft.name.trim() || (draft.name === selected.name && draft.description === selected.description)} onClick={() => void save()}>{t('保存')}</button>
      </footer>
    </article> : <Empty icon={<UserRound size={20} />} title={t('人设')} hint={t('还没有人设。人设是你在故事里的身份，会写进每轮请求。')} />}
  </div>;
}
