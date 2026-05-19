'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useMaawa } from '@/lib/store';

/**
 * Routes that belong to the artisan side of the platform.
 * In the prototype, the user explicitly toggles artisan mode via the topbar pill.
 * Since each route here is directly URL-addressable, we auto-set `mode` so the
 * `.artisan-mode` scope class (set by ScopeRoot) and the dual-sidebar (#sb-client
 * vs #sb-artisan) reflect the current page without requiring a manual toggle.
 *
 * Toggling the topbar pill still works — the user can override at any time on
 * client-mode routes, but the next navigation to an artisan route will flip
 * back. Mirrors what the prototype's `setMode()` does, applied per-route.
 */
const ARTISAN_ROUTES = [
  '/dashboard',
  '/dashboard/missions',
  '/dashboard/portfolio',
  '/artisan',
  '/apply',
];

const isArtisanRoute = (path: string) =>
  ARTISAN_ROUTES.some(r => path === r || path.startsWith(r + '/'));

export default function ArtisanModeWatcher() {
  const pathname = usePathname();
  const setMode = useMaawa(s => s.setMode);

  useEffect(() => {
    setMode(isArtisanRoute(pathname) ? 'artisan' : 'client');
  }, [pathname, setMode]);

  return null;
}
