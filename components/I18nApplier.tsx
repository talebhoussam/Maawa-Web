'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useMaawa } from '@/lib/store';
import { toast } from '@/lib/toast';
import {
  PLATFORM_TRANSLATIONS,
  PLATFORM_ID_MAP,
  PLATFORM_PH_MAP,
  PLATFORM_CAT_LABELS,
  PLATFORM_LANG_TOAST,
  PLATFORM_TITLES,
} from '@/lib/i18n-platform';
import {
  ADMIN_TRANSLATIONS,
  ADMIN_ID_MAP,
  ADMIN_PAGE_TITLE_MAP,
  ADMIN_LANG_TOAST,
} from '@/lib/i18n-admin';

type Scope = 'platform' | 'admin';

/**
 * Mounts a `useEffect([lang])` that mirrors the prototype's `applyLang()`/`setLang()`.
 *
 * For each `scope`:
 *  1. Sets `<html lang>` and `<html dir>` (`rtl` for ar) and `document.title`.
 *  2. Walks the explicit id-map and sets `el.innerHTML = T[lang][key]` (innerHTML because
 *     some values contain markup like `<em>`, `<strong>`).
 *  3. Walks `[data-i18n]` elements as a fallback for keys baked into JSX.
 *     - INPUT/TEXTAREA → set `placeholder`
 *     - OPTION → set `textContent`
 *     - everything else → set `innerHTML`
 *  4. Walks `[data-i18n-ph]` elements and sets `placeholder`.
 *  5. Walks `[data-i18n-html]` elements and sets `innerHTML` (admin-only marker).
 *  6. Platform: applies the special category-results sort/filter labels by id.
 *  7. Admin: updates the topbar `#page-title` based on the currently-visible `.page.on`.
 *  8. Toasts the language-switch message (skipped on first run; matches prototype's
 *     `_langInitDone` gate).
 *
 * The applier is idempotent — running it again with the same lang produces the same DOM.
 * The first run is treated as initial render (no toast).
 */
export default function I18nApplier({ scope }: { scope: Scope }) {
  const lang = useMaawa(s => s.lang);
  const pathname = usePathname();

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const isAr = lang === 'ar';
    document.documentElement.lang = lang;
    document.documentElement.dir = isAr ? 'rtl' : 'ltr';
    if (isAr) {
      document.body.classList.add('rtl');
    } else {
      document.body.classList.remove('rtl');
    }

    // Document title — only platform sets a public title. Admin keeps "Maawa Admin".
    if (scope === 'platform') {
      document.title = PLATFORM_TITLES[lang] || PLATFORM_TITLES.fr;
    }

    const TABLE = scope === 'platform' ? PLATFORM_TRANSLATIONS : ADMIN_TRANSLATIONS;
    const t = ((TABLE as Record<string, Record<string, string>>)[lang]
      || (TABLE as Record<string, Record<string, string>>).fr) as Record<string, string>;
    const idMap = scope === 'platform' ? PLATFORM_ID_MAP : ADMIN_ID_MAP;
    const phMap = scope === 'platform' ? PLATFORM_PH_MAP : null;

    // 1. Explicit id-map
    Object.entries(idMap).forEach(([id, key]) => {
      if (!key) return;
      const el = document.getElementById(id);
      if (el && t[key] !== undefined) {
        el.innerHTML = t[key];
      }
    });

    // 2. [data-i18n] fallback
    document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (!key || t[key] === undefined) return;
      const tag = el.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') {
        (el as HTMLInputElement | HTMLTextAreaElement).placeholder = t[key];
      } else if (tag === 'OPTION') {
        el.textContent = t[key];
      } else {
        el.innerHTML = t[key];
      }
    });

    // 3. [data-i18n-ph] explicit placeholder bindings
    document.querySelectorAll<HTMLElement>('[data-i18n-ph]').forEach((el) => {
      const key = el.getAttribute('data-i18n-ph');
      if (!key || t[key] === undefined) return;
      if ('placeholder' in el) {
        (el as HTMLInputElement | HTMLTextAreaElement).placeholder = t[key];
      }
    });

    // 4. Platform placeholder map (id → key for placeholders)
    if (phMap) {
      Object.entries(phMap).forEach(([id, key]) => {
        const el = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null;
        if (el && t[key] !== undefined) el.placeholder = t[key];
      });
    }

    // 5. [data-i18n-html] admin-only marker (innerHTML)
    document.querySelectorAll<HTMLElement>('[data-i18n-html]').forEach((el) => {
      const key = el.getAttribute('data-i18n-html');
      if (key && t[key] !== undefined) el.innerHTML = t[key];
    });

    // 6. Platform-only category-results sort/filter labels
    if (scope === 'platform') {
      Object.entries(PLATFORM_CAT_LABELS).forEach(([id, langs]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = langs[lang] || langs.fr;
      });
    }

    // 7. Admin-only: update topbar `#page-title` based on currently-active `.page.on`
    if (scope === 'admin') {
      const activeEl = document.querySelector<HTMLElement>('.page.on');
      const pageId = activeEl?.id?.replace(/^page-/, '') || 'dashboard';
      const titleKey = ADMIN_PAGE_TITLE_MAP[pageId];
      const tb = document.getElementById('page-title');
      if (tb && titleKey && t[titleKey] !== undefined) {
        tb.textContent = t[titleKey];
      }
    }

    // 8. Toast — skip first run on this scope to match prototype's `_langInitDone` gate
    const flagKey = scope === 'platform' ? '__mw_i18n_init_pl' : '__mw_i18n_init_ad';
    const w = window as unknown as Record<string, boolean>;
    if (w[flagKey]) {
      const msgs = scope === 'platform' ? PLATFORM_LANG_TOAST : ADMIN_LANG_TOAST;
      toast(msgs[lang] || msgs.fr);
    } else {
      w[flagKey] = true;
    }
  }, [lang, scope, pathname]);

  return null;
}
