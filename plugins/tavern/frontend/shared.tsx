/** Small pieces the Tavern views share. */
import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { avatarFromImage, type Library } from './api';
import { useTr } from './i18n';

export type ViewProps = {
  library: Library; busy: boolean;
  /** The item to select first, such as the one just imported. */
  focus?: string | null;
  setLibrary(library: Library): void;
  /** Run a change with the busy state, error display and a final library. */
  run(task: () => Promise<void>): Promise<void>;
  notify(text: string): void;
  explain(cause: unknown): void;
};

const hueOf = (name: string): number => { let hash = 0; for (const char of name) hash = (hash * 31 + char.codePointAt(0)!) >>> 0; return hash % 360; };
const initial = (name: string): string => Array.from(name.trim())[0]?.toUpperCase() ?? '?';

/** A picture, or the first letter on a colour taken from the name. */
export function Avatar({ src, name, size = 40 }: { src?: string | null; name: string; size?: number }) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.42), ['--xn-tavern-hue' as string]: String(hueOf(name)) };
  return src ? <img className="xn-tavern-avatar" src={src} alt="" style={style} draggable={false} />
    : <span className="xn-tavern-avatar xn-tavern-avatar--letter" style={style} aria-hidden="true">{initial(name)}</span>;
}

/** A portrait frame (3:4) filled by the picture, or by the initial on the name's colour. */
export function Cover({ src, name, className }: { src?: string | null; name: string; className?: string }) {
  return <span className={`xn-tavern-cover ${className ?? ''}`} style={{ ['--xn-tavern-hue' as string]: String(hueOf(name)) }} aria-hidden="true">
    {src ? <img src={src} alt="" draggable={false} /> : <span className="xn-tavern-cover__letter">{initial(name)}</span>}
  </span>;
}

/** A labelled switch row. */
export function Toggle({ checked, disabled, onChange, children, hint }: { checked: boolean; disabled?: boolean; onChange(value: boolean): void; children: ReactNode; hint?: string }) {
  return <label className="xn-tavern-toggle">
    <input type="checkbox" checked={checked} disabled={disabled} onChange={event => onChange(event.currentTarget.checked)} />
    <span><span>{children}</span>{hint && <small>{hint}</small>}</span>
  </label>;
}

/** A labelled number field kept within its range. */
export function NumberField({ label, value, min, max, step = 1, disabled, onChange }: { label: string; value: number; min: number; max: number; step?: number; disabled?: boolean; onChange(value: number): void }) {
  return <label className="xn-tavern-field xn-tavern-field--number"><span>{label}</span>
    <input type="number" value={value} min={min} max={max} step={step} disabled={disabled}
      onChange={event => { const number = Number(event.currentTarget.value); if (Number.isFinite(number)) onChange(Math.max(min, Math.min(max, number))); }} />
  </label>;
}

export function Empty({ icon, title, hint, children }: { icon?: ReactNode; title: string; hint?: string; children?: ReactNode }) {
  return <div className="xn-tavern-empty">{icon && <span className="xn-tavern-empty__icon" aria-hidden="true">{icon}</span>}<p className="xn-tavern-empty__title">{title}</p>{hint && <p className="xn-tavern-empty__hint">{hint}</p>}{children}</div>;
}

const CJK = /[぀-ヿ㐀-䶿一-鿿豈-﫿가-힯]/g;
/** A rough token count: about one token per CJK character and per four other characters. */
export function estimateTokens(text: string): number {
  const cjk = text.match(CJK)?.length ?? 0;
  return Math.round(cjk + (text.length - cjk) / 4);
}

/** "1,234 字 · 约 800 tokens" under a field. */
export function Count({ text, max }: { text: string; max?: number }) {
  const { tf } = useTr();
  const over = max !== undefined && text.length > max;
  return <small className="xn-tavern-count" data-over={over || undefined}>{tf('{0} 字 · 约 {1} tokens', [text.length.toLocaleString(), estimateTokens(text).toLocaleString()])}</small>;
}

/**
 * Roleplay text with its two conventions shown: quoted speech in strong type and *actions* in italics.
 * Nothing is interpreted as HTML; line breaks are kept by the container's `white-space`.
 */
export function Prose({ text, className }: { text: string; className?: string }) {
  const parts = text.split(/(\*[^*\n]+\*|“[^”]*”|"[^"\n]*"|「[^」]*」|『[^』]*』)/g);
  return <p className={`xn-tavern-prose ${className ?? ''}`}>{parts.map((part, index) => index % 2 === 0 ? part
    : part.startsWith('*') ? <em key={index} className="xn-tavern-act">{part.slice(1, -1)}</em>
    : <span key={index} className="xn-tavern-say">{part}</span>)}</p>;
}

/** Fill {{char}} and {{user}} (and the old <BOT> <USER>) for display. */
export const fillNames = (text: string, char: string, user: string): string => text.replace(/\{\{char\}\}|<BOT>/gi, char).replace(/\{\{user\}\}|<USER>/gi, user);

/** Tags or keys typed one by one: Enter or a comma adds, Backspace on an empty field removes the last. */
export function TagInput({ value, onChange, placeholder, disabled, label, max = 32 }: { value: string[]; onChange(value: string[]): void; placeholder?: string; disabled?: boolean; label: string; max?: number }) {
  const { t } = useTr();
  const [draft, setDraft] = useState('');
  const add = (raw: string) => {
    const items = raw.split(/[,，\n]/).map(item => item.trim()).filter(Boolean);
    if (!items.length) return;
    onChange([...new Set([...value, ...items])].slice(0, max)); setDraft('');
  };
  const onKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if ((event.key === 'Enter' || event.key === ',' || event.key === '，') && !event.nativeEvent.isComposing) { event.preventDefault(); add(draft); }
    else if (event.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1));
  };
  return <div className="xn-tavern-taginput" data-disabled={disabled || undefined}>
    {value.map(item => <span key={item} className="xn-tavern-taginput__tag">{item}
      {!disabled && <button type="button" aria-label={`${t('移除')} ${item}`} onClick={() => onChange(value.filter(other => other !== item))}><X size={11} aria-hidden="true" /></button>}</span>)}
    <input type="text" value={draft} aria-label={label} placeholder={value.length ? '' : placeholder} disabled={disabled || value.length >= max}
      onChange={event => setDraft(event.currentTarget.value)} onKeyDown={onKey} onBlur={() => add(draft)} />
  </div>;
}

/** A picture chooser: shows the current picture and sets a small data URL from any image file. */
export function PicturePicker({ value, name, onChange, disabled, size = 96 }: { value?: string | null; name: string; onChange(value: string | null): void; disabled?: boolean; size?: number }) {
  const { t } = useTr();
  const input = useRef<HTMLInputElement>(null);
  const [failed, setFailed] = useState(false);
  return <div className="xn-tavern-picture">
    <Avatar src={value} name={name || '?'} size={size} />
    <div className="xn-tavern-picture__actions">
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={async event => {
        const file = event.currentTarget.files?.[0]; event.currentTarget.value = '';
        if (!file) return;
        const picture = await avatarFromImage(file);
        setFailed(!picture); if (picture) onChange(picture);
      }} />
      <button type="button" className="xn-tavern-button" disabled={disabled} onClick={() => input.current?.click()}><ImagePlus size={14} aria-hidden="true" />{value ? t('更换图片') : t('上传图片')}</button>
      {value && <button type="button" className="xn-tavern-button xn-tavern-button--quiet" disabled={disabled} onClick={() => onChange(null)}>{t('移除图片')}</button>}
      {failed && <small className="xn-tavern-count" data-over>{t('这张图片读不出来，换一张试试。')}</small>}
    </div>
  </div>;
}

/** A destructive button that asks once, in place: the first click turns it into "确认删除 / 取消". */
export function ConfirmButton({ label, confirm, onConfirm, disabled, icon, quiet }: { label: string; confirm: string; onConfirm(): void; disabled?: boolean; icon?: ReactNode; quiet?: boolean }) {
  const { t } = useTr();
  const [asking, setAsking] = useState(false);
  if (asking) return <span className="xn-tavern-confirm" role="group" aria-label={confirm}>
    <button type="button" className="xn-tavern-button xn-tavern-button--danger" disabled={disabled} onClick={() => { setAsking(false); onConfirm(); }}>{confirm}</button>
    <button type="button" className="xn-tavern-button xn-tavern-button--quiet" onClick={() => setAsking(false)}>{t('取消')}</button>
  </span>;
  return icon && quiet ? <button type="button" className="xn-tavern-icon" disabled={disabled} aria-label={label} title={label} onClick={() => setAsking(true)}>{icon}</button>
    : <button type="button" className="xn-tavern-button" disabled={disabled} onClick={() => setAsking(true)}>{icon}{label}</button>;
}

/** Read and write one per-viewer preference; storage may be unavailable. */
export function remembered<T extends string>(key: string, fallback: T, allowed: readonly T[]): [T, (value: T) => void] {
  let value = fallback;
  try { const stored = localStorage.getItem(`xn-tavern:${key}`) as T | null; if (stored && allowed.includes(stored)) value = stored; } catch { /* storage is optional */ }
  return [value, (next: T) => { try { localStorage.setItem(`xn-tavern:${key}`, next); } catch { /* storage is optional */ } }];
}
