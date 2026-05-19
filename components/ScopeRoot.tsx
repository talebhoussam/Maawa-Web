'use client';

import { useMaawa } from '@/lib/store';
import { type ReactNode } from 'react';

/**
 * Wraps each shell tree in a single `<div>` that carries:
 *  - the scope class (e.g. `maawa-platform-root`) which is what the
 *    scoped CSS in app/platform.css and app/admin.css targets via native
 *    nesting (`.maawa-platform-root { ... }`);
 *  - the runtime state classes the prototype originally set on `<body>`:
 *    `dark`, `rtl` (platform), `rtl-admin` (admin), `artisan-mode`.
 *
 * Setting those on the wrapper rather than `<body>` lets us scope the two
 * prototype stylesheets without colliding, and lets server-side rendering
 * already include the right classes — no FOUC, no inline scripts.
 */
export default function ScopeRoot({
  scope,
  children,
}: {
  scope: 'maawa-platform-root' | 'maawa-admin-root' | 'maawa-auth-root';
  children: ReactNode;
}) {
  const { dark, lang, mode } = useMaawa();
  const classes: string[] = [scope];
  if (dark) classes.push('dark');
  if (lang === 'ar') {
    classes.push('rtl');
    if (scope === 'maawa-admin-root') classes.push('rtl-admin');
  }
  if (mode === 'artisan') classes.push('artisan-mode');
  return (
    <div className={classes.join(' ')} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {children}
    </div>
  );
}
