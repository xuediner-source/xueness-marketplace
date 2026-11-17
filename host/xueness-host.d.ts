/**
 * What the Xueness workbench lends a downloaded plugin's interface at runtime.
 *
 * A plugin bundle never carries its own React, translations or API client:
 * `react` and `react/jsx-runtime` are the workbench's own copies, and
 * `@xueness/host` is the object below (host interface version 1). The build
 * maps these imports to globals the workbench sets before it loads a plugin.
 */
declare module "@xueness/host" {
  import type { ReactNode, JSX } from "react";

  export type Locale = "zh" | "en";
  /** Translate a Chinese source string for the current interface language. */
  export function t(text: string, context?: string): string;
  /** Translate, then fill `{0}`, `{1}`, … with `values`. */
  export function tf(text: string, values: unknown[]): string;
  /** The current interface language; re-renders when it changes. */
  export function useLocale(): Locale;

  /** Same-origin JSON API calls with the workbench's session and CSRF handling. */
  export function get<T>(path: string, signal?: AbortSignal): Promise<T>;
  export function post<T>(path: string, body: object, signal?: AbortSignal): Promise<T>;
  export function del<T>(path: string, signal?: AbortSignal): Promise<T>;

  /** The workbench's empty/error state block. */
  export function EmptyState(props: {
    title: string; hint?: string; icon?: ReactNode; action?: ReactNode;
    tone?: "neutral" | "error"; compact?: boolean;
  }): JSX.Element;
}
