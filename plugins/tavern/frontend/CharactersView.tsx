/**
 * Characters: the library on the left; on the right the selected character, its greetings, how to start a
 * chat (persona, preset, world books, first line), its playthroughs, its full definition and a preview of
 * the prompt a request would carry.
 */
import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Eye, MessageSquarePlus, Search, Trash2, UserRound } from 'lucide-react';
import { useLocale } from '@xueness/host';
import { brief, failed, loadCharacter, preview, remove, startPlaythrough, type Character, type CharacterRow, type Preview } from './api';
import { age, useTr } from './i18n';
import { Avatar, Empty, type ViewProps } from './shared';

export type StartProps = {
  onStart(text: string): void;
  onStartSession?(text: string, ref: { plugin: 'tavern'; id: string }): Promise<boolean>;
  onOpenSession?(id: string): void;
  onOpenPanel?(): void;
};

export function CharactersView(props: ViewProps & StartProps) {
  const { library, busy } = props;
  const { t, tf } = useTr();
  const locale = useLocale();
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(props.focus ?? library.characters[0]?.id ?? null);
  const characters = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return library.characters.filter(item => words.every(word => `${item.name}\n${item.creator}\n${item.tags.join(' ')}`.toLowerCase().includes(word)))
      .sort((a, b) => b.playthroughs - a.playthroughs || a.name.localeCompare(b.name));
  }, [library.characters, query]);
  const selected = library.characters.find(item => item.id === selectedId) ?? null;
  useEffect(() => { if (!selected && library.characters[0]) setSelectedId(library.characters[0].id); }, [selected, library.characters]);

  if (!library.characters.length) return <Empty icon={<UserRound size={20} />} title={t('还没有角色')} hint={t('导入 SillyTavern 兼容的角色卡（JSON 或 PNG）。PNG 里的设定在浏览器中读取，只上传设定和一张小头像。')} />;
  return <div className="xn-tavern-split">
    <aside className="xn-tavern-list" aria-label={t('角色')}>
      <label className="xn-tavern-search"><Search size={14} aria-hidden="true" /><input type="search" value={query} placeholder={t('搜索角色')} aria-label={t('搜索角色')} onChange={event => setQuery(event.currentTarget.value)} /></label>
      <ul>{characters.map(item => <li key={item.id}>
        <button type="button" className="xn-tavern-row" aria-current={item.id === selectedId || undefined} onClick={() => setSelectedId(item.id)}>
          <Avatar src={item.avatar} name={item.name} size={36} />
          <span className="xn-tavern-row__text"><strong>{item.name}</strong><small>{[item.creator, ...item.tags.slice(0, 2)].filter(Boolean).join(' · ') || item.spec.replace('chara_card_', '').toUpperCase()}</small></span>
          {item.playthroughs > 0 && <span className="xn-tavern-badge" title={tf('{0} 个存档', [item.playthroughs])}>{item.playthroughs}</span>}
        </button>
      </li>)}</ul>
    </aside>
    {selected ? <CharacterDetail key={selected.id} row={selected} {...props} locale={locale} />
      : <Empty title={t('在左侧选择一个角色。')} />}
    {busy && <span className="xn-tavern-sr" role="status">{t('正在读取…')}</span>}
  </div>;
}

function CharacterDetail({ row, library, busy, run, setLibrary, explain, notify, onStart, onStartSession, onOpenSession, onOpenPanel, locale }: ViewProps & StartProps & { row: CharacterRow; locale: 'zh' | 'en' }) {
  const { t, tf } = useTr();
  const [character, setCharacter] = useState<Character | null>(null);
  const [greeting, setGreeting] = useState(0);
  const [presetId, setPresetId] = useState(library.settings.activePresetId);
  const [personaId, setPersonaId] = useState<string | null>(library.settings.activePersonaId);
  const [books, setBooks] = useState<string[]>([]);
  const [firstLine, setFirstLine] = useState('');
  const [shown, setShown] = useState<Preview | null>(null);
  const [sample, setSample] = useState('');
  useEffect(() => {
    let alive = true;
    void loadCharacter(row.id).then(result => { if (alive && !failed(result)) setCharacter(result.item); }).catch(() => undefined);
    return () => { alive = false; };
  }, [row.id]);
  const greetings = row.greetings, total = Math.max(1, greetings.length);
  const fullGreetings = character ? [character.firstMessage, ...character.alternateGreetings].filter(text => text.trim()) : greetings;
  const global = library.settings.globalWorldbooks;
  const playthroughs = library.playthroughs.filter(item => item.characterId === row.id);
  const name = (id: string | null) => library.personas.find(item => item.id === id)?.name;
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
  const drop = () => run(async () => { const result = await remove('characters', row.id); if (failed(result)) explain(result); else setLibrary(result); });
  const forget = (id: string) => run(async () => { const result = await remove('playthroughs', id); if (failed(result)) explain(result); else setLibrary(result); });

  return <article className="xn-tavern-detail">
    <header className="xn-tavern-hero">
      <Avatar src={row.avatar} name={row.name} size={88} />
      <div className="xn-tavern-hero__text">
        <h3>{row.name}</h3>
        <p>{[row.creator, row.spec.replace('chara_card_', '').toUpperCase(), row.bookEntries ? tf('内嵌世界信息 {0} 条', [row.bookEntries]) : ''].filter(Boolean).join(' · ')}</p>
        {row.tags.length > 0 && <div className="xn-tavern-chips">{row.tags.slice(0, 8).map(tag => <span key={tag} className="xn-tavern-chip">{tag}</span>)}</div>}
      </div>
      <button type="button" className="xn-tavern-icon" disabled={busy} aria-label={t('移除')} title={t('移除')} onClick={() => void drop()}><Trash2 size={15} aria-hidden="true" /></button>
    </header>

    {fullGreetings.length > 0 && <section className="xn-tavern-card xn-tavern-greeting">
      <header>
        <h4>{fullGreetings.length > 1 ? tf('开场白 {0}/{1}', [greeting + 1, total]) : t('开场白')}</h4>
        {fullGreetings.length > 1 && <div className="xn-tavern-stepper">
          <button type="button" className="xn-tavern-icon" aria-label="‹" disabled={greeting === 0} onClick={() => setGreeting(value => Math.max(0, value - 1))}><ChevronLeft size={15} aria-hidden="true" /></button>
          <button type="button" className="xn-tavern-icon" aria-label="›" disabled={greeting >= fullGreetings.length - 1} onClick={() => setGreeting(value => Math.min(fullGreetings.length - 1, value + 1))}><ChevronRight size={15} aria-hidden="true" /></button>
        </div>}
      </header>
      <p className="xn-tavern-prose">{(fullGreetings[greeting] ?? '').replace(/\{\{char\}\}|<BOT>/gi, row.name).replace(/\{\{user\}\}|<USER>/gi, name(personaId) ?? 'User')}</p>
    </section>}

    <section className="xn-tavern-card xn-tavern-start">
      <h4>{t('开始新对话')}</h4>
      <div className="xn-tavern-start__grid">
        <label className="xn-tavern-field"><span>{t('人设')}</span>
          <select value={personaId ?? ''} onChange={event => setPersonaId(event.currentTarget.value || null)}>
            <option value="">{t('无人设')}</option>{library.personas.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select></label>
        <label className="xn-tavern-field"><span>{t('预设')}</span>
          <select value={presetId} onChange={event => setPresetId(event.currentTarget.value)}>
            {library.presets.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select></label>
      </div>
      {library.worldbooks.length > 0 && <div className="xn-tavern-field"><span>{t('世界书')}</span><div className="xn-tavern-chips">
        {library.worldbooks.map(book => global.includes(book.id)
          ? <span key={book.id} className="xn-tavern-chip xn-tavern-chip--on" title={t('对所有角色扮演对话启用')}>{book.name}<small>{t('全局')}</small></span>
          : <button key={book.id} type="button" className="xn-tavern-chip xn-tavern-chip--toggle" aria-pressed={books.includes(book.id)}
            onClick={() => setBooks(current => current.includes(book.id) ? current.filter(item => item !== book.id) : [...current, book.id])}>{book.name}</button>)}
      </div></div>}
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
      <h4>{t('存档')}</h4>
      <ul className="xn-tavern-plays">{playthroughs.map(item => <li key={item.id}>
        <span className="xn-tavern-row__text"><strong>{item.title}</strong>
          <small>{[name(item.personaId), library.presets.find(preset => preset.id === item.presetId)?.name, tf('最后使用 {0}', [age(item.lastUsedAt, locale)])].filter(Boolean).join(' · ')}</small></span>
        <button type="button" className="xn-tavern-button" disabled={!item.sessionId || !onOpenSession} onClick={() => item.sessionId && onOpenSession?.(item.sessionId)}>{item.sessionId ? t('打开') : t('尚未开始')}</button>
        <button type="button" className="xn-tavern-icon" disabled={busy} aria-label={t('删除')} title={t('删除')} onClick={() => void forget(item.id)}><Trash2 size={14} aria-hidden="true" /></button>
      </li>)}</ul>
    </section>}

    {character && <details className="xn-tavern-card xn-tavern-definition">
      <summary>{t('设定')}</summary>
      {([['描述', character.description], ['性格', character.personality], ['场景', character.scenario], ['示例对话', character.exampleMessages],
        ['卡片系统提示', character.systemPrompt], ['后置指令', character.postHistoryInstructions], ['作者备注', character.creatorNotes]] as const)
        .filter(([, text]) => text.trim()).map(([label, text]) => <section key={label}><h5>{t(label)}</h5><p className="xn-tavern-prose">{text}</p></section>)}
    </details>}
  </article>;
}

function PreviewCard({ preview: shown, sample, setSample, busy, onRefresh, onClose }: { preview: Preview; sample: string; setSample(value: string): void; busy: boolean; onRefresh(): void; onClose(): void }) {
  const { t, tf } = useTr();
  const reason = { constant: t('常驻条目'), key: t('关键词命中'), recursion: t('递归命中') };
  return <section className="xn-tavern-card xn-tavern-preview" aria-label={t('预览提示词')}>
    <header><h4>{t('预览提示词')}</h4><span className="xn-tavern-muted">{tf('系统提示 {0} 字', [shown.systemChars])}</span>
      <button type="button" className="xn-tavern-button xn-tavern-button--quiet" onClick={onClose}>{t('关闭')}</button></header>
    <div className="xn-tavern-preview__sample">
      <input type="text" value={sample} placeholder={t('示例输入（用于触发关键词）')} onChange={event => setSample(event.currentTarget.value)} />
      <button type="button" className="xn-tavern-button" disabled={busy} onClick={onRefresh}>{t('刷新预览')}</button>
    </div>
    <h5>{t('激活的世界书条目')}</h5>
    {shown.activated.length ? <ul className="xn-tavern-activated">{shown.activated.map((item, index) => <li key={index}>
      <strong>{item.name}</strong><small>{[item.source, reason[item.reason], item.key && `“${item.key}”`, item.position === 'after' ? t('角色后') : t('角色前')].filter(Boolean).join(' · ')}</small>
    </li>)}</ul> : <p className="xn-tavern-muted">{t('没有激活的条目')}</p>}
    {shown.droppedEntries > 0 && <p className="xn-tavern-muted">{tf('超出预算未写入 {0} 条', [shown.droppedEntries])}</p>}
    {shown.sections.map(section => <section key={section.id} className="xn-tavern-preview__section">
      <h5>{section.title || t('主提示')}</h5><pre>{section.text}</pre></section>)}
    {shown.authorNote && <section className="xn-tavern-preview__section"><h5>{t('作者注释')} · {t('深度')} {shown.authorNote.depth}</h5><pre>{shown.authorNote.text}</pre></section>}
    {shown.postHistory && <section className="xn-tavern-preview__section"><h5>{t('后置指令')}</h5><pre>{shown.postHistory}</pre></section>}
  </section>;
}
