'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { onIdTokenChanged } from 'firebase/auth';
import { useMaawa } from '@/lib/store';

/**
 * AdminAuthGuard — gates admin-only pages on the client.
 *
 * Source of truth = the Firebase Auth ID token's `admin` custom claim.
 * The claim is set by /api/admin/users/promote (or scripts/bootstrap-admin)
 * and travels with every request automatically.
 *
 * IMPORTANT: this is the LAST line of defence, not the first. The
 * middleware blocks unauthenticated users at the edge, the API routes
 * verify `admin` on every privileged call (server-side, can't be
 * bypassed), and Firestore Rules restrict admin-only documents. This
 * guard exists so the UI doesn't even attempt to render when the user
 * lacks the role — better UX, no leaked component code.
 */

export default function AdminAuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { authLoaded } = useMaawa();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    /* Subscribe to ID token changes — the custom claim updates here
       whenever the token refreshes, so a freshly-promoted user sees
       admin UI without a hard reload. */
    const unsub = onIdTokenChanged(auth, async (u) => {
      if (!u) {
        setIsAdmin(false);
        return;
      }
      const tok = await u.getIdTokenResult();
      setIsAdmin(tok.claims.admin === true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authLoaded || isAdmin === null) return;
    if (!auth.currentUser) {
      router.replace('/admin/login');
      return;
    }
    if (!isAdmin) {
      router.replace('/admin/denied');
    }
  }, [authLoaded, isAdmin, router]);

  if (!authLoaded || isAdmin === null) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: '#0a0a12',
        color: 'rgba(255,255,255,.5)', fontSize: '.9rem',
      }}>
        Vérification des droits admin…
      </div>
    );
  }

  if (!isAdmin) return null;

  return <>{children}</>;
}
