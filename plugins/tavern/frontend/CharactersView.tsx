/**
 * Characters: a gallery of portrait cards (or a compact list beside the detail), then one character's page:
 * its card, greetings, how to start a chat (persona, preset, world books, first line), its playthroughs and
 * their settings, its full definition, a preview of the prompt a request would carry, and the editor.
 */
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Download, Eye, LayoutGrid, List, MessageSquarePlus, Pencil, Play, Plus, Search, Settings2, Star, Trash2, UserRound } from 'lucide-react';
import { useLocale } from '@xueness/host';
import { brief, cardJson, cardPng, failed, loadCharacter, preview, remove, saveFile, startPlaythrough, updateCharacter, updatePlaythrough, type Character, type CharacterRow, type Library, type Playthrough, type Preview } from './api';
import { age, useTr } from './i18n';
import { CharacterEditor } from './CharacterEditor';
import { Avatar, ConfirmButton, Count, Cover, Empty, Prose, estimateTokens, fillNames, remembered, type ViewProps } from './shared';

export type StartProps = {
  onStart(text: string): void;
  onStartSession?(text: string, ref: { plugin: 'tavern'; id: string }): Promise<boolean>;
  onOpenSession?(id: string): void;
  onOpenPanel?(): void;
};
type Sort = 'played' | 'name' | 'imported' | 'edited';
type Layout = 'grid' | 'list';
const SORTS: { id: Sort; label: string }[] = [{ id: 'played', label: '最近游玩' }, { id: 'edited', label: '最近编辑' }, { id: 'imported', label: '导入时间' }, { id: 'name', label: '名称' }];

/** The persona a chat with this character starts with: one bound to it, else the active one. */
const personaFor = (library: Library, characterId: string): string | null =>
  library.personas.find(item => item.characterIds?.includes(characterId))?.id ?? library.settings.activePersonaId;

export function CharactersView(props: ViewProps & StartProps) {
  const { library, busy, run, setLibrary, explain } = props;
  const { t, tf } = useTr();
  const locale = useLocale();
  const [storedLayout, storeLayout] = remembered<Layout>('layout', 'grid', ['grid', 'list']);
  const [storedSort, storeSort] = remembered<Sort>('sort', 'played', ['played', 'name', 'imported', 'edited']);
  const [layout, setLayout] = useState<Layout>(storedLayout);
  const [sort, setSort] = useState<Sort>(storedSort);
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(props.focus ?? (storedLayout === 'list' ? library.characters[0]?.id ?? null : null));
  const [editing, setEditing] = useState<'new' | string | null>(null);
  const tags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of library.characters) for (const name of item.tags) counts.set(name, (counts.get(name) ?? 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 40);
  }, [library.characters]);
  const characters = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    const time = (value?: string | null) => value ? Date.parse(value) || 0 : 0;
    const order = (a: CharacterRow, b: CharacterRow): number =>
      sort === 'name' ? a.name.localeCompare(b.name)
        : sort === 'imported' ? time(b.importedAt) - time(a.importedAt)
        : sort === 'edited' ? time(b.updatedAt ?? b.importedAt) - time(a.updatedAt ?? a.importedAt)
        : time(b.lastPlayedAt) - time(a.lastPlayedAt) || b.playthroughs - a.playthroughs || a.name.localeCompare(b.name);
    return library.characters
      .filter(item => !tag || item.tags.includes(tag))
      .filter(item => words.every(word => `${item.name}\n${item.creator}\n${item.tags.join(' ')}\n${item.description}`.toLowerCase().includes(word)))
      .sort((a, b) => Number(!!b.favorite) - Number(!!a.favorite) || order(a, b));
  }, [library.characters, query, tag, sort]);
  const selected = library.characters.find(item => item.id === selectedId) ?? null;
  useEffect(() => { if (selectedId && !selected) setSelectedId(layout === 'list' ? library.characters[0]?.id ?? null : null); }, [selected, selectedId, layout, library.characters]);
  const changeLayout = (value: Layout) => { setLayout(value); storeLayout(value); if (value === 'list' && !selectedId) setSelectedId(characters[0]?.id ?? null); };
  const favorite = (row: CharacterRow) => run(async () => {
    const result = await updateCharacter(row.id, { favorite: !row.favorite });
    if (failed(result)) explain(result); else setLibrary(result);
  });

  if (editing === 'new') return <CharacterEditor character={null} {...props} onDone={id => { setEditing(null); if (id) setSelectedId(id); }} />;
  if (!library.characters.length) return <Empty icon={<UserRound size={20} />} title={t('还没有角色')} hint={t('导入 SillyTavern 兼容的角色卡（JSON 或 PNG），或者自己写一张。PNG 里的设定在浏览器中读取，只上传设定和一张小头像。')}>
    <button type="button" className="xn-tavern-button xn-tavern-button--primary" onClick={() => setEditing('new')}><Plus size={14} aria-hidden="true" />{t('新建角色')}</button>
  </Empty>;

  const toolbar = <div className="xn-tavern-toolbar">
    <label className="xn-tavern-search xn-tavern-toolbar__grow"><Search size={14} aria-hidden="true" /><input type="search" value={query} placeholder={t('搜索名字、作者、标签或描述')} aria-label={t('搜索角色')} onChange={event => setQuery(event.currentTarget.value)} /></label>
    {tags.length > 0 && <select className="xn-tavern-toolbar__select" value={tag} aria-label={t('按标签筛选')} onChange={event => setTag(event.currentTarget.value)}>
      <option value="">{t('全部标签')}</option>{tags.map(([name, count]) => <option key={name} value={name}>{`${name} (${count})`}</option>)}
    </select>}
    <select className="xn-tavern-toolbar__select" value={sort} aria-label={t('排序')} onChange={event => { const value = event.currentTarget.value as Sort; setSort(value); storeSort(value); }}>
      {SORTS.map(item => <option key={item.id} value={item.id}>{t(item.label)}</option>)}
    </select>
    <span className="xn-tavern-seg xn-tavern-seg--icons" role="radiogroup" aria-label={t('显示方式')}>
      <button type="button" role="radio" aria-checked={layout === 'grid'} aria-label={t('卡片')} title={t('卡片')} onClick={() => changeLayout('grid')}><LayoutGrid size={15} aria-hidden="true" /></button>
      <button type="button" role="radio" aria-checked={layout === 'list'} aria-label={t('列表')} title={t('列表')} onClick={() => changeLayout('list')}><List size={15} aria-hidden="true" /></button>
    </span>
    <button type="button" className="xn-tavern-button xn-tavern-button--primary" disabled={busy} onClick={() => setEditing('new')}><Plus size={14} aria-hidden="true" />{t('新建角色')}</button>
  </div>;
  const detail = selected && (editing === selected.id
    ? <EditExisting key={`edit-${selected.id}`} row={selected} {...props} onDone={() => setEditing(null)} />
    : <CharacterDetail key={selected.id} row={selected} {...props} locale={locale} onEdit={() => setEditing(selected.id)} onFavorite={() => void favorite(selected)}
      onBack={layout === 'grid' ? () => setSelectedId(null) : undefined} />);

  if (layout === 'grid' && selected) return detail;
  if (layout === 'grid') return <div className="xn-tavern-library">
    {toolbar}
    {!characters.length ? <Empty title={t('没有符合条件的角色。')} /> : <ul className="xn-tavern-gallery">{characters.map(item => <li key={item.id}>
      <article className="xn-tavern-tile">
        <button type="button" className="xn-tavern-tile__open" onClick={() => setSelectedId(item.id)} aria-label={item.name}>
          <Cover src={item.avatar} name={item.name} />
          {item.playthroughs > 0 && <span className="xn-tavern-tile__plays" title={tf('{0} 个存档', [item.playthroughs])}><Play size={11} aria-hidden="true" />{item.playthroughs}</span>}
        </button>
        <button type="button" className="xn-tavern-tile__star" aria-pressed={!!item.favorite} aria-label={item.favorite ? t('取消收藏') : t('收藏')} title={item.favorite ? t('取消收藏') : t('收藏')} disabled={busy} onClick={() => void favorite(item)}>
          <Star size={14} aria-hidden="true" fill={item.favorite ? 'currentColor' : 'none'} /></button>
        <div className="xn-tavern-tile__body">
          <strong>{item.name}</strong>
          <small>{item.lastPlayedAt ? tf('{0}玩过', [age(item.lastPlayedAt, locale)]) : item.creator || t('还没开始')}</small>
          {item.tags.length > 0 && <span className="xn-tavern-tile__tags">{item.tags.slice(0, 3).map(name => <span key={name}>{name}</span>)}</span>}
        </div>
      </article>
    </li>)}</ul>}
  </div>;

  return <div className="xn-tavern-library">
    {toolbar}
    <div className="xn-tavern-split">
      <aside className="xn-tavern-list" aria-label={t('角色')}>
        <ul>{characters.map(item => <li key={item.id}>
          <button type="button" className="xn-tavern-row" aria-current={item.id === selectedId || undefined} onClick={() => { setSelectedId(item.id); setEditing(null); }}>
            <Avatar src={item.avatar} name={item.name} size={36} />
            <span className="xn-tavern-row__text"><strong>{item.favorite && <Star size={11} aria-label={t('收藏')} fill="currentColor" className="xn-tavern-star" />}{item.name}</strong>
              <small>{[item.creator, ...item.tags.slice(0, 2)].filter(Boolean).join(' · ') || item.spec.replace('chara_card_', '').toUpperCase()}</small></span>
            {item.playthroughs > 0 && <span className="xn-tavern-badge" title={tf('{0} 个存档', [item.playthroughs])}>{item.playthroughs}</span>}
          </button>
        </li>)}</ul>
      </aside>
      {detail ?? <Empty title={t('在左侧选择一个角色。')} />}
    </div>
  </div>;
}

function EditExisting({ row, onDone, ...props }: ViewProps & { row: CharacterRow; onDone(): void }) {
  const { t } = useTr();
  const [character, setCharacter] = useState<Character | null>(null);
  useEffect(() => { let alive = true; void loadCharacter(row.id).then(result => { if (alive && !failed(result)) setCharacter(result.item); }).catch(() => undefined); return () => { alive = false; }; }, [row.id]);
  return character ? <CharacterEditor character={character} {...props} onDone={onDone} /> : <Empty title={t('正在读取…')} />;
}

function CharacterDetail({ row, library, busy, run, setLibrary, explain, notify, onStart, onStartSession, onOpenSession, onOpenPanel, locale, onEdit, onFavorite, onBack }: ViewProps & StartProps & {
  row: CharacterRow; locale: 'zh' | 'en'; onEdit(): void; onFavorite(): void; onBack?: () => void;
}) {
  const { t, tf } = useTr();
  const [character, setCharacter] = useState<Character | null>(null);
  const [greeting, setGreeting] = useState(0);
  const [presetId, setPresetId] = useState(library.settings.activePresetId);
  const [personaId, setPersonaId] = useState<string | null>(personaFor(library, row.id));
  const [books, setBooks] = useState<string[]>([]);
  const [firstLine, setFirstLine] = useState('');
  const [shown, setShown] = useState<Preview | null>(null);
  const [sample, setSample] = useState('');
  const [exporting, setExporting] = useState(false);
  useEffect(() => {
    let alive = true;
    void loadCharacter(row.id).then(result => { if (alive && !failed(result)) setCharacter(result.item); }).catch(() => undefined);
    return () => { alive = false; };
  }, [row.id, row.updatedAt]);
  const fullGreetings = character ? [character.firstMessage, ...character.alternateGreetings].filter(text => text.trim()) : row.greetings;
  const global = library.settings.globalWorldbooks;
  const playthroughs = library.playthroughs.filter(item => item.characterId === row.id);
  const latest = playthroughs.find(item => item.sessionId);
  const name = (id: string | null) => library.personas.find(item => item.id === id)?.name;
  const userName = name(personaId) ?? 'User';
  const request = { characterId: row.id, greeting, presetId, personaId, worldbooks: books };

  const start = () => run(async () => {
    const result = await startPlaythrough(request);
    if (failed(result)) { explain(result); return; }
    setLibrary(result);
    let started = false;
    try { started = await onStartSession!(firstLine.trim() || t('（故事开始）'), { plugin: 'tavern', id: result.playthrough!.id }); }
    finally {
      // A refused chat (no model, for one) is explained by the workbench; it leaves no empty playthrough behind.
      if (!started) { const cleaned = await remove('playthroughs', result.playthrough!.id).catch(() => null); if (cleaned && !failed(cleaned)) setLibrary(cleaned); }
    }
    if (started) notify(tf('已开始与 {0} 的对话。', [row.name]));
  });
  const legacyStart = () => run(async () => {
    const result = await brief({ characterId: row.id, greeting, worldbooks: books, userName: name(personaId) ?? '' });
    if (failed(result)) explain(result); else onStart(result.text);
  });
  const showPreview = () => run(async () => {
    const result = await preview({ ...request, sample });
    if (failed(result)) explain(result); else setShown(result);
  });
  const drop = () => run(async () => { const result = await remove('characters', row.id); if (failed(result)) explain(result); else { setLibrary(result); onBack?.(); } });
  const exportAs = (kind: 'json' | 'png') => run(async () => {
    if (!character) return;
    setExporting(false);
    if (kind === 'json') saveFile(`${character.name}.json`, cardJson(character));
    else saveFile(`${character.name}.png`, await cardPng(character));
  });
  const definition = character ? ([['描述', character.description], ['性格', character.personality], ['场景', character.scenario], ['示例对话', character.exampleMessages],
    ['卡片系统提示', character.systemPrompt], ['后置指令', character.postHistoryInstructions]] as const).filter(([, text]) => text.trim()) : [];
  const definitionTokens = definition.reduce((sum, [, text]) => sum + estimateTokens(text), 0);

  return <article className="xn-tavern-detail">
    {onBack && <button type="button" className="xn-tavern-button xn-tavern-button--quiet xn-tavern-back" onClick={onBack}><ArrowLeft size={14} aria-hidden="true" />{t('角色库')}</button>}
    <header className="xn-tavern-profile">
      <Cover src={row.avatar} name={row.name} className="xn-tavern-profile__cover" />
      <div className="xn-tavern-profile__text">
        <h3>{row.name}</h3>
        <p>{[row.creator && tf('作者 {0}', [row.creator]), row.spec.replace('chara_card_', '').toUpperCase(), row.bookEntries ? tf('内嵌世界信息 {0} 条', [row.bookEntries]) : '', character && tf('设定约 {0} tokens', [definitionTokens.toLocaleString()])].filter(Boolean).join(' · ')}</p>
        {row.tags.length > 0 && <div className="xn-tavern-chips">{row.tags.slice(0, 12).map(tag => <span key={tag} className="xn-tavern-chip">{tag}</span>)}</div>}
        {character?.creatorNotes.trim() && <p className="xn-tavern-profile__notes">{character.creatorNotes}</p>}
        <div className="xn-tavern-profile__actions">
          {onStartSession && <button type="button" className="xn-tavern-button xn-tavern-button--primary" onClick={() => {
            const card = document.getElementById('xn-tavern-start');
            card?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
            card?.querySelector<HTMLElement>('textarea')?.focus({ preventScroll: true });
          }}><MessageSquarePlus size={14} aria-hidden="true" />{t('开始新对话')}</button>}
          {latest && onOpenSession && <button type="button" className="xn-tavern-button" onClick={() => onOpenSession(latest.sessionId!)}><Play size={14} aria-hidden="true" />{t('继续上次')}</button>}
          <button type="button" className="xn-tavern-button" disabled={busy} onClick={onEdit}><Pencil size={14} aria-hidden="true" />{t('编辑')}</button>
          <button type="button" className="xn-tavern-button" aria-pressed={!!row.favorite} disabled={busy} onClick={onFavorite}><Star size={14} aria-hidden="true" fill={row.favorite ? 'currentColor' : 'none'} />{row.favorite ? t('已收藏') : t('收藏')}</button>
          <span className="xn-tavern-menu">
            <button type="button" className="xn-tavern-button" aria-expanded={exporting} disabled={!character} onClick={() => setExporting(value => !value)}><Download size={14} aria-hidden="true" />{t('导出')}</button>
            {exporting && <span className="xn-tavern-menu__list" role="menu">
              <button type="button" role="menuitem" onClick={() => void exportAs('png')}>{t('PNG 角色卡')}<small>{t('SillyTavern 等可直接导入')}</small></button>
              <button type="button" role="menuitem" onClick={() => void exportAs('json')}>{t('JSON 角色卡')}<small>chara_card_v2</small></button>
            </span>}
          </span>
          <ConfirmButton label={t('删除角色')} confirm={t('确认删除')} quiet icon={<Trash2 size={15} aria-hidden="true" />} disabled={busy} onConfirm={() => void drop()} />
        </div>
      </div>
    </header>

    {fullGreetings.length > 0 && <section className="xn-tavern-card xn-tavern-greeting">
      <header>
        <h4>{fullGreetings.length > 1 ? tf('开场白 {0}/{1}', [greeting + 1, fullGreetings.length]) : t('开场白')}</h4>
        {fullGreetings.length > 1 && <div className="xn-tavern-stepper">
          <button type="button" className="xn-tavern-icon" aria-label={t('上一个开场白')} disabled={greeting === 0} onClick={() => setGreeting(value => Math.max(0, value - 1))}><ChevronLeft size={15} aria-hidden="true" /></button>
          <button type="button" className="xn-tavern-icon" aria-label={t('下一个开场白')} disabled={greeting >= fullGreetings.length - 1} onClick={() => setGreeting(value => Math.min(fullGreetings.length - 1, value + 1))}><ChevronRight size={15} aria-hidden="true" /></button>
        </div>}
      </header>
      <div className="xn-tavern-bubble">
        <Avatar src={row.avatar} name={row.name} size={32} />
        <div><strong className="xn-tavern-bubble__name">{row.name}</strong><Prose text={fillNames(fullGreetings[greeting] ?? '', row.name, userName)} /></div>
      </div>
    </section>}

    <section className="xn-tavern-card xn-tavern-start" id="xn-tavern-start">
      <h4>{t('开始新对话')}</h4>
      <div className="xn-tavern-start__grid">
        <label className="xn-tavern-field"><span>{t('人设')}</span>
          <select value={personaId ?? ''} onChange={event => setPersonaId(event.currentTarget.value || null)}>
            <option value="">{t('无人设')}</option>{library.personas.map(item => <option key={item.id} value={item.id}>{item.name}{item.characterIds?.includes(row.id) ? ` · ${t('绑定此角色')}` : ''}</option>)}
          </select></label>
        <label className="xn-tavern-field"><span>{t('预设')}</span>
          <select value={presetId} onChange={event => setPresetId(event.currentTarget.value)}>
            {library.presets.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select></label>
      </div>
      {library.worldbooks.length > 0 && <BookChips library={library} chosen={books} onChange={setBooks} />}
      {onStartSession ? <>
        <label className="xn-tavern-field"><span>{t('你的第一句话')}</span>
          <textarea rows={2} value={firstLine} maxLength={4000} placeholder={t('留空则以「（故事开始）」开场')} onChange={event => setFirstLine(event.currentTarget.value)} /></label>
        <footer>
          <button type="button" className="xn-tavern-button" disabled={busy} onClick={() => void showPreview()}><Eye size={14} aria-hidden="true" />{t('预览提示词')}</button>
          <button type="button" className="xn-tavern-button xn-tavern-button--primary" disabled={busy} onClick={() => void start()}><MessageSquarePlus size={14} aria-hidden="true" />{t('开始对话')}</button>
        </footer>
      </> : <footer>
        <span className="xn-tavern-muted">{t('在酒馆面板中开始对话')}</span>
        <button type="button" className="xn-tavern-button" disabled={busy} onClick={() => void legacyStart()}>{t('放进输入框')}</button>
        {onOpenPanel && <button type="button" className="xn-tavern-button xn-tavern-button--primary" onClick={onOpenPanel}>{t('打开酒馆面板')}</button>}
      </footer>}
    </section>

    {shown && <PreviewCard preview={shown} sample={sample} setSample={setSample} busy={busy} onRefresh={() => void showPreview()} onClose={() => setShown(null)} />}

    {playthroughs.length > 0 && <section className="xn-tavern-card">
      <h4>{tf('存档 · {0}', [playthroughs.length])}</h4>
      <ul className="xn-tavern-plays">{playthroughs.map(item => <PlaythroughRow key={item.id} item={item} library={library} greetings={fullGreetings} locale={locale} busy={busy} run={run} setLibrary={setLibrary} explain={explain} onOpenSession={onOpenSession} />)}</ul>
    </section>}

    {character && definition.length > 0 && <details className="xn-tavern-card xn-tavern-definition">
      <summary>{tf('设定 · 约 {0} tokens', [definitionTokens.toLocaleString()])}</summary>
      {definition.map(([label, text]) => <section key={label}><h5>{t(label)}<Count text={text} /></h5><Prose text={fillNames(text, row.name, userName)} /></section>)}
    </details>}
  </article>;
}

function BookChips({ library, chosen, onChange }: { library: Library; chosen: string[]; onChange(value: string[]): void }) {
  const { t } = useTr();
  const global = library.settings.globalWorldbooks;
  return <div className="xn-tavern-field"><span>{t('世界书')}</span><div className="xn-tavern-chips">
    {library.worldbooks.map(book => global.includes(book.id)
      ? <span key={book.id} className="xn-tavern-chip xn-tavern-chip--on" title={t('对所有角色扮演对话启用')}>{book.name}<small>{t('全局')}</small></span>
      : <button key={book.id} type="button" className="xn-tavern-chip xn-tavern-chip--toggle" aria-pressed={chosen.includes(book.id)}
        onClick={() => onChange(chosen.includes(book.id) ? chosen.filter(item => item !== book.id) : [...chosen, book.id])}>{book.name}</button>)}
  </div></div>;
}

/** One playthrough: open it, rename it, or change what its next requests are built from. */
function PlaythroughRow({ item, library, greetings, locale, busy, run, setLibrary, explain, onOpenSession }: Pick<ViewProps, 'busy' | 'run' | 'setLibrary' | 'explain'> & { item: Playthrough; library: Library; greetings: string[]; locale: 'zh' | 'en'; onOpenSession?(id: string): void }) {
  const { t, tf } = useTr();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ title: item.title, presetId: item.presetId, personaId: item.personaId, worldbooks: item.worldbooks, greeting: item.greeting });
  const name = (id: string | null) => library.personas.find(persona => persona.id === id)?.name;
  const save = () => run(async () => {
    const result = await updatePlaythrough(item.id, { ...draft, title: draft.title.trim() || item.title });
    if (failed(result)) explain(result); else { setLibrary(result); setOpen(false); }
  });
  const forget = () => run(async () => { const result = await remove('playthroughs', item.id); if (failed(result)) explain(result); else setLibrary(result); });
  return <li className="xn-tavern-play" data-open={open || undefined}>
    <div className="xn-tavern-play__row">
      <span className="xn-tavern-row__text"><strong>{item.title}</strong>
        <small>{[name(item.personaId), library.presets.find(preset => preset.id === item.presetId)?.name, item.worldbooks.length ? tf('世界书 {0} 本', [item.worldbooks.length]) : '', tf('最后使用 {0}', [age(item.lastUsedAt, locale)])].filter(Boolean).join(' · ')}</small></span>
      <button type="button" className="xn-tavern-icon" aria-expanded={open} aria-label={t('存档设置')} title={t('存档设置')} onClick={() => setOpen(value => !value)}><Settings2 size={15} aria-hidden="true" /></button>
      <button type="button" className="xn-tavern-button" disabled={!item.sessionId || !onOpenSession} onClick={() => item.sessionId && onOpenSession?.(item.sessionId)}>{item.sessionId ? t('打开') : t('尚未开始')}</button>
      <ConfirmButton label={t('删除存档')} confirm={t('确认删除')} quiet icon={<Trash2 size={14} aria-hidden="true" />} disabled={busy} onConfirm={() => void forget()} />
    </div>
    {open && <div className="xn-tavern-play__settings">
      <p className="xn-tavern-muted">{t('改动从这个对话的下一轮开始生效；已经写下的消息不变。删除存档只是让酒馆忘掉它，对话本身还在。')}</p>
      <div className="xn-tavern-start__grid">
        <label className="xn-tavern-field"><span>{t('存档名')}</span><input type="text" value={draft.title} maxLength={80} onChange={event => { const title = event.currentTarget.value; setDraft(current => ({ ...current, title })); }} /></label>
        <label className="xn-tavern-field"><span>{t('人设')}</span>
          <select value={draft.personaId ?? ''} onChange={event => { const personaId = event.currentTarget.value || null; setDraft(current => ({ ...current, personaId })); }}>
            <option value="">{t('无人设')}</option>{library.personas.map(persona => <option key={persona.id} value={persona.id}>{persona.name}</option>)}
          </select></label>
        <label className="xn-tavern-field"><span>{t('预设')}</span>
          <select value={draft.presetId} onChange={event => { const presetId = event.currentTarget.value; setDraft(current => ({ ...current, presetId })); }}>
            {library.presets.map(preset => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
          </select></label>
        {greetings.length > 1 && <label className="xn-tavern-field"><span>{t('开场白')}</span>
          <select value={Math.min(draft.greeting, greetings.length - 1)} onChange={event => { const greeting = Number(event.currentTarget.value); setDraft(current => ({ ...current, greeting })); }}>
            {greetings.map((text, index) => <option key={index} value={index}>{`${index + 1}. ${text.replace(/\s+/g, ' ').slice(0, 28)}`}</option>)}
          </select></label>}
      </div>
      {library.worldbooks.length > 0 && <BookChips library={library} chosen={draft.worldbooks} onChange={worldbooks => setDraft(current => ({ ...current, worldbooks }))} />}
      <footer><button type="button" className="xn-tavern-button" onClick={() => setOpen(false)}>{t('取消')}</button>
        <button type="button" className="xn-tavern-button xn-tavern-button--primary" disabled={busy} onClick={() => void save()}>{t('保存')}</button></footer>
    </div>}
  </li>;
}

function PreviewCard({ preview: shown, sample, setSample, busy, onRefresh, onClose }: { preview: Preview; sample: string; setSample(value: string): void; busy: boolean; onRefresh(): void; onClose(): void }) {
  const { t, tf } = useTr();
  const reason = { constant: t('常驻条目'), key: t('关键词命中'), recursion: t('递归命中') };
  const parts = [...shown.sections.map(section => ({ id: section.id, title: section.title || t('主提示'), text: section.text })),
    ...(shown.authorNote ? [{ id: 'note', title: `${t('作者注释')} · ${t('深度')} ${shown.authorNote.depth}`, text: shown.authorNote.text }] : []),
    ...(shown.postHistory ? [{ id: 'post', title: t('后置指令'), text: shown.postHistory }] : [])];
  const total = Math.max(1, parts.reduce((sum, part) => sum + part.text.length, 0));
  return <section className="xn-tavern-card xn-tavern-preview" aria-label={t('预览提示词')}>
    <header><h4>{t('预览提示词')}</h4><span className="xn-tavern-muted">{tf('系统提示 {0} 字 · 约 {1} tokens', [shown.systemChars.toLocaleString(), estimateTokens(shown.system).toLocaleString()])}</span>
      <button type="button" className="xn-tavern-button xn-tavern-button--quiet" onClick={onClose}>{t('关闭')}</button></header>
    <div className="xn-tavern-preview__sample">
      <input type="text" value={sample} placeholder={t('示例输入（用于触发关键词）')} aria-label={t('示例输入（用于触发关键词）')} onChange={event => setSample(event.currentTarget.value)} />
      <button type="button" className="xn-tavern-button" disabled={busy} onClick={onRefresh}>{t('刷新预览')}</button>
    </div>
    <ul className="xn-tavern-budget" aria-label={t('各段占比')}>{parts.map(part => <li key={part.id}>
      <span>{part.title}</span><span className="xn-tavern-budget__bar"><span style={{ width: `${Math.max(1, Math.round(part.text.length / total * 100))}%` }} /></span>
      <small>{tf('{0} 字', [part.text.length.toLocaleString()])}</small>
    </li>)}</ul>
    <h5>{tf('激活的世界书条目 · {0}', [shown.activated.length])}</h5>
    {shown.activated.length ? <ul className="xn-tavern-activated">{shown.activated.map((item, index) => <li key={index}>
      <details><summary><strong>{item.name}</strong><small>{[item.source, reason[item.reason], item.key && `“${item.key}”`, item.position === 'after' ? t('角色后') : t('角色前')].filter(Boolean).join(' · ')}</small></summary>
        {item.content && <p className="xn-tavern-prose">{item.content}</p>}</details>
    </li>)}</ul> : <p className="xn-tavern-muted">{t('没有激活的条目')}</p>}
    {shown.droppedEntries > 0 && <p className="xn-tavern-muted">{tf('超出预算未写入 {0} 条', [shown.droppedEntries])}</p>}
    {parts.map(part => <details key={part.id} className="xn-tavern-preview__section"><summary>{part.title}<small>{tf('{0} 字', [part.text.length.toLocaleString()])}</small></summary><pre>{part.text}</pre></details>)}
  </section>;
}
