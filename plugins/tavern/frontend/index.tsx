/**
 * The Tavern panel: roleplay with SillyTavern-compatible character cards, world books, presets and personas.
 * A PNG card carries its definition in a text chunk; it is read here, in the browser, and only that JSON and a
 * small avatar are sent. Starting a chat creates a playthrough and a session tagged with it; from then on every
 * request of that session is rebuilt by the server from the preset, the character, the persona and the books.
 */
import { useEffect, useRef, useState, type RefObject } from 'react';
import { BookOpen, FileJson, TriangleAlert, Upload, UserRound, X } from 'lucide-react';
import { avatarFromPng, cardJsonFromPng, failed, importBook, importCharacter, importPreset, loadLibrary, type Library } from './api';
import { useTr } from './i18n';
import { CharactersView, type StartProps } from './CharactersView';
import { WorldbooksView } from './WorldbooksView';
import { PresetsView } from './PresetsView';
import { PersonasView } from './PersonasView';
import type { ViewProps } from './shared';
import './tavern.css';

export { cardJsonFromPng } from './api';

type Tab = 'characters' | 'worldbooks' | 'presets' | 'personas';
const TABS: { id: Tab; label: string }[] = [
  { id: 'characters', label: '角色' }, { id: 'worldbooks', label: '世界书' }, { id: 'presets', label: '预设' }, { id: 'personas', label: '人设' },
];
const ERRORS: Record<string, string> = {
  invalid_json: '文件不是有效的 JSON。', invalid_card: '这不是可用的角色卡：需要名称，以及描述、性格或开场白之一。', invalid_book: '这个世界书里没有可用的条目。',
  invalid: '这个文件不是可用的预设。', too_large: '文件内容超过大小上限。', library_full: '资料库已满，请先移除一些条目。', not_found: '没有找到这个条目，请刷新后重试。',
  no_card_in_png: '这张 PNG 里没有角色卡数据。', builtin: '内置预设不能直接修改，复制后编辑。',
};

async function readCard(file: File): Promise<{ card: string; avatar?: string }> {
  if (file.type !== 'image/png' && !/\.png$/i.test(file.name)) return { card: await file.text() };
  const card = cardJsonFromPng(new Uint8Array(await file.arrayBuffer()));
  if (card === null) throw Object.assign(new Error('no card'), { code: 'no_card_in_png' });
  return { card, avatar: await avatarFromPng(file) };
}

export function TavernPanel(props: StartProps) {
  const { t, tf } = useTr();
  const [library, setLibrary] = useState<Library | null>(null);
  const [tab, setTab] = useState<Tab>('characters');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(true);
  const [generation, setGeneration] = useState(0);
  const [focus, setFocus] = useState<string | null>(null);
  const cardInput = useRef<HTMLInputElement>(null);
  const bookInput = useRef<HTMLInputElement>(null);
  const presetInput = useRef<HTMLInputElement>(null);
  const alive = useRef(true);

  const explain = (cause: unknown) => {
    const code = failed(cause) ? cause.error.code : (cause as { code?: string } | null)?.code ?? '';
    setError(ERRORS[code] ? t(ERRORS[code]!) : failed(cause) ? cause.error.message : cause instanceof Error ? cause.message : String(cause));
  };
  const run = async (task: () => Promise<void>) => {
    setBusy(true); setError(''); setNotice('');
    try { await task(); } catch (cause) { if (alive.current) explain(cause); } finally { if (alive.current) setBusy(false); }
  };
  useEffect(() => {
    alive.current = true;
    void run(async () => { const result = await loadLibrary(); if (alive.current) setLibrary(result); });
    return () => { alive.current = false; };
  }, []);

  const importFiles = (kind: 'characters' | 'worldbooks' | 'presets', files: File[]) => run(async () => {
    let added = 0, last: string | null = null;
    const ignored = new Set<string>();
    for (const file of files) {
      const result = kind === 'characters' ? await readCard(file).then(({ card, avatar }) => importCharacter(card, file.name, avatar))
        : kind === 'worldbooks' ? await importBook(await file.text(), file.name)
        : await importPreset(await file.text(), file.name.replace(/\.json$/i, ''));
      if (failed(result)) { explain(result); break; }
      added += 1; setLibrary(result); last = result.itemId ?? last;
      for (const item of result.ignored ?? []) ignored.add(item);
    }
    if (!added) return;
    setTab(kind); setFocus(last); setGeneration(value => value + 1);
    const done = kind === 'characters' ? tf('已导入 {0} 张角色卡', [added]) : kind === 'worldbooks' ? tf('已导入 {0} 本世界书', [added]) : tf('已导入 {0} 个预设', [added]);
    setNotice(ignored.size ? `${done} · ${tf('未导入：{0}', [[...ignored].slice(0, 6).join(', ')])}` : done);
  });
  const picker = (ref: RefObject<HTMLInputElement | null>, kind: 'characters' | 'worldbooks' | 'presets', accept: string) =>
    <input ref={ref} type="file" accept={accept} multiple hidden onChange={event => { const files = Array.from(event.currentTarget.files ?? []); event.currentTarget.value = ''; if (files.length) void importFiles(kind, files); }} />;

  const view: ViewProps | null = library && { library, busy, focus, setLibrary, run, explain, notify: setNotice };
  const counts: Record<Tab, number> = { characters: library?.characters.length ?? 0, worldbooks: library?.worldbooks.length ?? 0, presets: library?.presets.length ?? 0, personas: library?.personas.length ?? 0 };

  // Without a way to start a chat of its own this is the Settings entry, which has its own title.
  const embedded = !props.onStartSession;
  return <section className={embedded ? 'xn-tavern xn-tavern--embedded' : 'xn-tavern'} data-testid="tavern-panel" aria-busy={busy}>
    {picker(cardInput, 'characters', '.json,.png,application/json,image/png')}
    {picker(bookInput, 'worldbooks', '.json,application/json')}
    {picker(presetInput, 'presets', '.json,application/json')}
    <header className="xn-tavern-head">
      {!embedded && <div className="xn-tavern-head__text">
        <h2>{t('酒馆')}</h2>
        <p>{t('角色扮演：角色卡、世界书、预设与人设。对话以角色扮演模式进行：每轮请求按预设重新组织角色、人设与世界书，工具关闭。')}</p>
      </div>}
      <div className="xn-tavern-head__actions">
        <button type="button" className="xn-tavern-button xn-tavern-button--primary" disabled={busy} onClick={() => cardInput.current?.click()}><Upload size={14} aria-hidden="true" />{t('导入角色卡')}</button>
        <button type="button" className="xn-tavern-button" disabled={busy} onClick={() => bookInput.current?.click()}><BookOpen size={14} aria-hidden="true" />{t('导入世界书')}</button>
        <button type="button" className="xn-tavern-button" disabled={busy} onClick={() => presetInput.current?.click()}><FileJson size={14} aria-hidden="true" />{t('导入 SillyTavern 预设')}</button>
      </div>
    </header>

    <nav className="xn-tavern-tabs" role="tablist" aria-label={t('酒馆')}>
      {TABS.map(item => <button key={item.id} type="button" role="tab" id={`xn-tavern-tab-${item.id}`} aria-selected={tab === item.id} aria-controls="xn-tavern-tabpanel"
        className="xn-tavern-tab" onClick={() => { setTab(item.id); setFocus(null); }}>
        {t(item.label)}<span className="xn-tavern-tab__count">{counts[item.id]}</span>
      </button>)}
    </nav>

    {error && <p className="xn-tavern-alert" role="alert"><TriangleAlert size={15} aria-hidden="true" /><span>{error}</span>
      <button type="button" className="xn-tavern-icon" aria-label={t('关闭')} onClick={() => setError('')}><X size={14} aria-hidden="true" /></button></p>}
    {notice && <p className="xn-tavern-notice" role="status">{notice}</p>}

    <div className="xn-tavern-body" role="tabpanel" id="xn-tavern-tabpanel" aria-labelledby={`xn-tavern-tab-${tab}`}>
      {!view ? <div className="xn-tavern-empty"><span className="xn-tavern-empty__icon" aria-hidden="true"><UserRound size={20} /></span><p className="xn-tavern-empty__title">{busy ? t('正在读取…') : error}</p></div>
        : tab === 'characters' ? <CharactersView key={generation} {...view} {...props} />
        : tab === 'worldbooks' ? <WorldbooksView key={generation} {...view} />
        : tab === 'presets' ? <PresetsView key={generation} {...view} />
        : <PersonasView key={generation} {...view} />}
    </div>
  </section>;
}
