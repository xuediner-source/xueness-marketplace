/** Personas: who the person is in the story. The active one is the default; one bound to a character is that character's default. */
import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Star, Trash2, UserRound } from 'lucide-react';
import { failed, remove, savePersona, saveSettings, type Persona } from './api';
import { useTr } from './i18n';
import { Avatar, ConfirmButton, Count, Empty, PicturePicker, type ViewProps } from './shared';

type Draft = Pick<Persona, 'name' | 'description'> & { avatar: string | null; characterIds: string[] };
const draftOf = (persona: Persona | null): Draft => ({ name: persona?.name ?? '', description: persona?.description ?? '', avatar: persona?.avatar ?? null, characterIds: persona?.characterIds ?? [] });

export function PersonasView({ library, busy, run, setLibrary, explain, notify }: ViewProps) {
  const { t, tf } = useTr();
  const [selectedId, setSelectedId] = useState<string | null>(library.settings.activePersonaId ?? library.personas[0]?.id ?? null);
  const selected = library.personas.find(item => item.id === selectedId) ?? null;
  const [draft, setDraft] = useState<Draft>(draftOf(selected));
  const [query, setQuery] = useState('');
  useEffect(() => { setDraft(draftOf(selected)); }, [selected]);
  const active = library.settings.activePersonaId;
  const dirty = JSON.stringify(draft) !== JSON.stringify(draftOf(selected));
  const characters = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return library.characters.filter(item => draft.characterIds.includes(item.id) || words.every(word => item.name.toLowerCase().includes(word)));
  }, [library.characters, query, draft.characterIds]);
  // A character can have one bound persona; binding it here takes it from another.
  const boundElsewhere = (characterId: string) => library.personas.find(item => item.id !== selectedId && item.characterIds?.includes(characterId));

  const create = () => run(async () => {
    const result = await savePersona({ name: t('新人设'), description: '' });
    if (failed(result)) explain(result); else { setLibrary(result); if (result.itemId) setSelectedId(result.itemId); }
  });
  const save = () => run(async () => {
    if (!selected) return;
    const result = await savePersona({ id: selected.id, name: draft.name, description: draft.description, ...(draft.avatar ? { avatar: draft.avatar } : {}), characterIds: draft.characterIds });
    if (failed(result)) { explain(result); return; }
    let latest = result;
    for (const other of result.personas) {
      if (other.id === selected.id || !other.characterIds?.some(id => draft.characterIds.includes(id))) continue;
      const moved = await savePersona({ ...other, characterIds: other.characterIds.filter(id => !draft.characterIds.includes(id)) });
      if (!failed(moved)) latest = moved;
    }
    setLibrary(latest); notify(t('已保存'));
  });
  const activate = (id: string | null) => run(async () => { const result = await saveSettings({ activePersonaId: id }); if (failed(result)) explain(result); else setLibrary(result); });
  const drop = (id: string) => run(async () => {
    const result = await remove('personas', id);
    if (failed(result)) { explain(result); return; }
    if (active === id) { const cleared = await saveSettings({ activePersonaId: null }); if (!failed(cleared)) { setLibrary(cleared); setSelectedId(null); return; } }
    setLibrary(result); setSelectedId(null);
  });

  if (!library.personas.length) return <Empty icon={<UserRound size={20} />} title={t('人设')} hint={t('还没有人设。人设是你在故事里的身份，会写进每轮请求。')}>
    <button type="button" className="xn-tavern-button xn-tavern-button--primary" disabled={busy} onClick={() => void create()}><Plus size={14} aria-hidden="true" />{t('新建人设')}</button>
  </Empty>;
  return <div className="xn-tavern-split">
    <aside className="xn-tavern-list" aria-label={t('人设')}>
      <div className="xn-tavern-list__actions"><button type="button" className="xn-tavern-button" disabled={busy} onClick={() => void create()}><Plus size={14} aria-hidden="true" />{t('新建人设')}</button></div>
      <ul>{library.personas.map(item => <li key={item.id}>
        <button type="button" className="xn-tavern-row" aria-current={item.id === selectedId || undefined} onClick={() => setSelectedId(item.id)}>
          <Avatar src={item.avatar} name={item.name} size={32} />
          <span className="xn-tavern-row__text"><strong>{item.name}</strong><small>{item.characterIds?.length ? tf('绑定 {0} 个角色', [item.characterIds.length]) : item.description.slice(0, 40)}</small></span>
          {item.id === active && <span className="xn-tavern-badge">{t('默认')}</span>}
        </button>
      </li>)}</ul>
    </aside>
    {selected ? <article className="xn-tavern-detail xn-tavern-form">
      <header className="xn-tavern-hero xn-tavern-hero--compact">
        <div className="xn-tavern-hero__text"><label className="xn-tavern-field"><span>{t('名称')}<small>{t('即 {{user}}')}</small></span>
          <input type="text" value={draft.name} maxLength={60} onChange={event => { const name = event.currentTarget.value; setDraft(current => ({ ...current, name })); }} /></label></div>
        <div className="xn-tavern-hero__actions">
          {selected.id !== active ? <button type="button" className="xn-tavern-button" disabled={busy} onClick={() => void activate(selected.id)}><Star size={14} aria-hidden="true" />{t('设为默认')}</button>
            : <button type="button" className="xn-tavern-button" disabled={busy} onClick={() => void activate(null)}>{t('取消默认')}</button>}
          <ConfirmButton label={t('删除人设')} confirm={t('确认删除')} quiet icon={<Trash2 size={15} aria-hidden="true" />} disabled={busy} onConfirm={() => void drop(selected.id)} />
        </div>
      </header>
      <section className="xn-tavern-card">
        <h4>{t('头像')}</h4>
        <PicturePicker value={draft.avatar} name={draft.name} disabled={busy} size={72} onChange={avatar => setDraft(current => ({ ...current, avatar }))} />
      </section>
      <section className="xn-tavern-card">
        <h4>{t('人设描述')}</h4>
        <textarea rows={8} aria-label={t('人设描述')} value={draft.description} maxLength={8000} placeholder={t('你在故事里是谁：年龄、外貌、身份、和角色的关系。会写进每轮请求。')} onChange={event => { const description = event.currentTarget.value; setDraft(current => ({ ...current, description })); }} />
        <Count text={draft.description} max={8000} />
      </section>
      {library.characters.length > 0 && <section className="xn-tavern-card">
        <header><h4>{t('绑定角色')}</h4><span className="xn-tavern-muted">{t('和这些角色开始对话时默认用这个人设')}</span></header>
        {library.characters.length > 12 && <label className="xn-tavern-search"><Search size={14} aria-hidden="true" /><input type="search" value={query} placeholder={t('搜索角色')} aria-label={t('搜索角色')} onChange={event => setQuery(event.currentTarget.value)} /></label>}
        <div className="xn-tavern-chips">{characters.map(item => {
          const on = draft.characterIds.includes(item.id), other = !on ? boundElsewhere(item.id) : undefined;
          return <button key={item.id} type="button" className="xn-tavern-chip xn-tavern-chip--toggle xn-tavern-chip--avatar" aria-pressed={on} title={other ? tf('现在绑定的是 {0}', [other.name]) : undefined}
            onClick={() => setDraft(current => ({ ...current, characterIds: on ? current.characterIds.filter(id => id !== item.id) : [...current.characterIds, item.id] }))}>
            <Avatar src={item.avatar} name={item.name} size={20} />{item.name}{other && <small>{other.name}</small>}</button>;
        })}</div>
      </section>}
      <footer className="xn-tavern-form__footer">
        <button type="button" className="xn-tavern-button" disabled={busy || !dirty} onClick={() => setDraft(draftOf(selected))}>{t('放弃修改')}</button>
        <button type="button" className="xn-tavern-button xn-tavern-button--primary" disabled={busy || !draft.name.trim() || !dirty} onClick={() => void save()}>{t('保存')}</button>
      </footer>
    </article> : <Empty icon={<UserRound size={20} />} title={t('在左侧选择一个人设。')} />}
  </div>;
}
