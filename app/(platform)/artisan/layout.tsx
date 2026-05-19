'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMaawa } from '@/lib/store';

/**
 * /artisan/* layout — auth-gates the section to verified artisans only.
 *
 * Middleware already blocks anonymous access to `/artisan/*` (it's in
 * PROTECTED_PLATFORM). This client-side gate adds the role check that
 * the Edge Runtime can't do (Admin SDK not available there). A signed-in
 * client browsing here gets bounced to /feed with a toast.
 *
 * The platform's main layout wraps this segment, so we don't re-render
 * sidebars / topbar here.
 */
export default function ArtisanLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user } = useMaawa();

  useEffect(() => {
    /* Wait until the user hydrates — `user` is null during initial
       boot, which is indistinguishable from "actually a guest" here.
       We only redirect when we positively know the role isn't artisan. */
    if (user && user.role !== 'artisan') {
      router.replace('/feed');
    }
  }, [user, router]);

  return <>{children}</>;
}
