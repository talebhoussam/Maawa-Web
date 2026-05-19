'use client';

import { useMaawa } from './store';
import { PLATFORM_TRANSLATIONS } from './i18n-platform';
import { ADMIN_TRANSLATIONS } from './i18n-admin';

/**
 * React-friendly i18n lookup.
 *
 * The existing prototype i18n applier walks the DOM by element id and
 * sets `innerHTML` — fine for the prototype-faithful pages but awkward
 * for new React components built post-port. This hook gives us a
 * `t('key', { foo: 'bar' })` API that reads from the same translation
 * tables, supports `{placeholder}` interpolation, and falls back to
 * French then to the key itself if a translation is missing.
 *
 * @example
 *   const t = useT();
 *   <h2>{t('rch_modal_title')}</h2>
 *   <p>{t('rch_inst_ccp', { dzd: '5000', number: '...', ref: 'abc' })}</p>
 *
 * Pass `scope: 'admin'` from admin pages to read from the admin table.
 */
export function useT(scope: 'platform' | 'admin' = 'platform'): (key: string, vars?: Record<string, string | number>) => string {
  const lang = useMaawa(s => s.lang);
  const table = scope === 'admin' ? ADMIN_TRANSLATIONS : PLATFORM_TRANSLATIONS;

  return (key: string, vars?: Record<string, string | number>) => {
    const dict = (table as Record<string, Record<string, string>>)[lang]
      ?? (table as Record<string, Record<string, string>>).fr;
    const raw = dict[key] ?? (table as Record<string, Record<string, string>>).fr?.[key] ?? key;
    if (!vars) return raw;
    return raw.replace(/\{(\w+)\}/g, (_, name: string) => {
      const v = vars[name];
      return v === undefined ? `{${name}}` : String(v);
    });
  };
}
