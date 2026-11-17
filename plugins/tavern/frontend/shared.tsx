/** Small pieces the Tavern views share. */
import type { ReactNode } from 'react';
import type { Library } from './api';

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

/** A picture, or the first letter on a colour taken from the name. */
export function Avatar({ src, name, size = 40 }: { src?: string | null; name: string; size?: number }) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
  const style = { width: size, height: size, fontSize: Math.round(size * 0.42), ['--xn-tavern-hue' as string]: String(hash % 360) };
  return src ? <img className="xn-tavern-avatar" src={src} alt="" style={style} draggable={false} />
    : <span className="xn-tavern-avatar xn-tavern-avatar--letter" style={style} aria-hidden="true">{Array.from(name.trim())[0]?.toUpperCase() ?? '?'}</span>;
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
