/**
 * Writing a character: a new one, or an edit of one in the library. Grouped the way a card is read
 * (who they are, the definition, how the story opens, the rules sent with it, their own world book);
 * every long field shows its size, and nothing is saved until the person presses Save.
 */
import { useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2, X } from 'lucide-react';
import { createCharacter, failed, updateCharacter, type Character, type CharacterDraft } from './api';
import { useTr } from './i18n';
import { EntryEditor, entryProblems, fromDrafts, toDrafts, type DraftEntry } from './EntryEditor';
import { Count, PicturePicker, TagInput, type ViewProps } from './shared';

type Form = Omit<CharacterDraft, 'book' | 'alternateGreetings' | 'firstMessage'> & { greetings: string[]; book: DraftEntry[] };
const blank: Character = {
  id: '', name: '', description: '', personality: '', scenario: '', firstMessage: '', alternateGreetings: [], exampleMessages: '', systemPrompt: '',
  postHistoryInstructions: '', creator: '', creatorNotes: '', tags: [], spec: 'chara_card_v2', book: [],
};
const formOf = (character: Character): Form => ({
  name: character.name, description: character.description, personality: character.personality, scenario: character.scenario,
  greetings: [character.firstMessage, ...character.alternateGreetings].filter((text, index) => index === 0 || text.trim()),
  exampleMessages: character.exampleMessages, systemPrompt: character.systemPrompt, postHistoryInstructions: character.postHistoryInstructions,
  creator: character.creator, creatorNotes: character.creatorNotes, tags: character.tags, avatar: character.avatar ?? null, favorite: character.favorite, book: toDrafts(character.book),
});
const draftOf = (form: Form): Partial<CharacterDraft> => {
  const [first = '', ...rest] = form.greetings;
  const { greetings: _greetings, book, ...fields } = form;
  return { ...fields, name: form.name.trim(), firstMessage: first, alternateGreetings: rest.filter(text => text.trim()), book: fromDrafts(book) };
};
const same = (a: Form, b: Form): boolean => JSON.stringify(draftOf(a)) === JSON.stringify(draftOf(b));

export function CharacterEditor({ character, busy, run, setLibrary, explain, notify, onDone }: Pick<ViewProps, 'busy' | 'run' | 'setLibrary' | 'explain' | 'notify'> & {
  /** null: a new character. */
  character: Character | null;
  onDone(savedId: string | null): void;
}) {
  const { t, tf } = useTr();
  const [initial] = useState<Form>(() => formOf(character ?? blank));
  const [form, setForm] = useState<Form>(initial);
  const [leaving, setLeaving] = useState(false);
  const [bookOpen, setBookOpen] = useState(form.book.length > 0);
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm(current => ({ ...current, [key]: value }));
  const dirty = !same(form, initial);
  const problems = [
    ...(form.name.trim() ? [] : [t('名称不能为空')]),
    ...(form.description.trim() || form.personality.trim() || form.greetings.some(text => text.trim()) ? [] : [t('描述、性格和开场白至少写一项')]),
    ...entryProblems(form.book, t).map(problem => `${t('内嵌世界书')} · ${problem}`),
  ];
  const save = () => run(async () => {
    if (problems.length) return;
    const draft = draftOf(form);
    const result = character ? await updateCharacter(character.id, draft) : await createCharacter(draft);
    if (failed(result)) { explain(result); return; }
    setLibrary(result); notify(character ? t('已保存') : tf('已创建角色 {0}', [form.name.trim()]));
    onDone(result.itemId ?? character?.id ?? null);
  });
  const greeting = (index: number, text: string) => set('greetings', form.greetings.map((item, at) => at === index ? text : item));
  const moveGreeting = (index: number, by: number) => {
    const list = [...form.greetings], target = index + by;
    if (target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target]!, list[index]!]; set('greetings', list);
  };
  const field = (key: 'description' | 'personality' | 'scenario' | 'exampleMessages' | 'systemPrompt' | 'postHistoryInstructions', label: string, hint: string, rows: number) =>
    <label className="xn-tavern-field"><span>{t(label)}<small>{t(hint)}</small></span>
      <textarea rows={rows} value={form[key]} maxLength={65536} disabled={busy} onChange={event => set(key, event.currentTarget.value)} />
      <Count text={form[key]} max={65536} /></label>;

  return <article className="xn-tavern-detail xn-tavern-form xn-tavern-editor" aria-label={character ? t('编辑角色') : t('新建角色')}>
    <header className="xn-tavern-editor__head">
      <h3>{character ? tf('编辑 {0}', [character.name]) : t('新建角色')}</h3>
      {dirty && <span className="xn-tavern-pill xn-tavern-pill--accent">{t('未保存')}</span>}
      <button type="button" className="xn-tavern-icon" aria-label={t('关闭编辑')} title={t('关闭编辑')} onClick={() => dirty ? setLeaving(true) : onDone(null)}><X size={16} aria-hidden="true" /></button>
    </header>
    {leaving && <div className="xn-tavern-unsaved" role="alert"><span>{t('还有没保存的修改。')}</span>
      <button type="button" className="xn-tavern-button" onClick={() => setLeaving(false)}>{t('继续编辑')}</button>
      <button type="button" className="xn-tavern-button xn-tavern-button--danger" onClick={() => onDone(null)}>{t('放弃修改')}</button></div>}

    <section className="xn-tavern-card">
      <h4>{t('基本信息')}</h4>
      <div className="xn-tavern-editor__identity">
        <PicturePicker value={form.avatar} name={form.name} disabled={busy} size={104} onChange={avatar => set('avatar', avatar)} />
        <div className="xn-tavern-editor__identity-fields">
          <label className="xn-tavern-field"><span>{t('名称')}<small>{t('必填，即 {{char}}')}</small></span>
            <input type="text" value={form.name} maxLength={120} disabled={busy} onChange={event => set('name', event.currentTarget.value)} /></label>
          <label className="xn-tavern-field"><span>{t('作者')}</span>
            <input type="text" value={form.creator} maxLength={120} disabled={busy} onChange={event => set('creator', event.currentTarget.value)} /></label>
          <div className="xn-tavern-field"><span>{t('标签')}</span>
            <TagInput label={t('标签')} value={form.tags} max={24} disabled={busy} placeholder={t('回车或逗号添加，例如「校园」「纯爱」')} onChange={tags => set('tags', tags)} /></div>
        </div>
      </div>
      <label className="xn-tavern-field"><span>{t('作者备注')}<small>{t('写给玩家看，不发给模型')}</small></span>
        <textarea rows={3} value={form.creatorNotes} maxLength={4000} disabled={busy} onChange={event => set('creatorNotes', event.currentTarget.value)} /></label>
    </section>

    <section className="xn-tavern-card">
      <h4>{t('设定')}</h4>
      {field('description', '描述', '外貌、身份、经历、说话方式；每轮都发给模型', 8)}
      {field('personality', '性格', '可选：一段性格摘要', 3)}
      {field('scenario', '场景', '可选：故事发生的时间、地点和处境', 3)}
    </section>

    <section className="xn-tavern-card">
      <header><h4>{t('开场白')}</h4><span className="xn-tavern-muted">{t('第一条是默认开场；其余作为备选，开始对话时可以挑')}</span></header>
      <ol className="xn-tavern-greetings">{form.greetings.map((text, index) => <li key={index}>
        <div className="xn-tavern-greetings__head">
          <strong>{index === 0 ? t('默认开场白') : tf('备选 {0}', [index])}</strong>
          <button type="button" className="xn-tavern-icon" aria-label={t('上移')} disabled={busy || index === 0} onClick={() => moveGreeting(index, -1)}><ArrowUp size={14} aria-hidden="true" /></button>
          <button type="button" className="xn-tavern-icon" aria-label={t('下移')} disabled={busy || index === form.greetings.length - 1} onClick={() => moveGreeting(index, 1)}><ArrowDown size={14} aria-hidden="true" /></button>
          <button type="button" className="xn-tavern-icon" aria-label={t('删除开场白')} disabled={busy || form.greetings.length === 1} onClick={() => set('greetings', form.greetings.filter((_, at) => at !== index))}><Trash2 size={14} aria-hidden="true" /></button>
        </div>
        <textarea rows={index === 0 ? 7 : 5} value={text} maxLength={65536} disabled={busy} aria-label={index === 0 ? t('默认开场白') : tf('备选 {0}', [index])}
          placeholder={t('先交代场景，再让角色说一句话或给出线索，留一个能接住的话头。"引号"是对白，*星号*是动作。')} onChange={event => greeting(index, event.currentTarget.value)} />
        <Count text={text} />
      </li>)}</ol>
      <div><button type="button" className="xn-tavern-button" disabled={busy || form.greetings.length >= 32} onClick={() => set('greetings', [...form.greetings, ''])}><Plus size={14} aria-hidden="true" />{t('添加备选开场白')}</button></div>
    </section>

    <section className="xn-tavern-card">
      <h4>{t('示例对话')}</h4>
      {field('exampleMessages', '示例对话', '用 <START> 分段，每行以 {{char}}: 或 {{user}}: 开头；教模型怎么说话', 6)}
    </section>

    <details className="xn-tavern-card xn-tavern-definition">
      <summary>{t('高级：卡片自带的指令')}</summary>
      {field('systemPrompt', '卡片系统提示', '预设允许时替换主提示；写 {{original}} 可保留原主提示', 4)}
      {field('postHistoryInstructions', '后置指令', '放在最新一条消息之后；预设允许时替换预设的后置指令', 3)}
    </details>

    <details className="xn-tavern-card xn-tavern-definition" open={bookOpen} onToggle={event => setBookOpen(event.currentTarget.open)}>
      <summary>{tf('内嵌世界书 · {0} 条', [form.book.length])}</summary>
      <p className="xn-tavern-muted">{t('随角色卡一起导出；预设里打开「使用角色卡内嵌世界书」时生效。')}</p>
      {bookOpen && <EntryEditor entries={form.book} disabled={busy} onChange={book => set('book', book)} />}
    </details>

    <footer className="xn-tavern-form__footer">
      {problems.length > 0 && <ul className="xn-tavern-problems" aria-label={t('保存前要处理')}>{problems.slice(0, 4).map(problem => <li key={problem}>{problem}</li>)}{problems.length > 4 && <li>{tf('还有 {0} 处', [problems.length - 4])}</li>}</ul>}
      <button type="button" className="xn-tavern-button" disabled={busy} onClick={() => dirty ? setLeaving(true) : onDone(null)}>{t('取消')}</button>
      <button type="button" className="xn-tavern-button xn-tavern-button--primary" disabled={busy || !dirty || problems.length > 0} onClick={() => void save()}>{character ? t('保存') : t('创建角色')}</button>
    </footer>
  </article>;
}
