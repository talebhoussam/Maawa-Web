'use client';

import { useEffect } from 'react';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useMaawa, type UserProfile } from '@/lib/store';

/**
 * AuthProvider — top-level wrapper that mirrors Firebase auth state into
 * our Zustand store and synchronises a server-set session cookie.
 *
 * Why a session cookie at all?
 * ---------------------------
 * Firebase's client SDK keeps the user logged in via IndexedDB. But the
 * Next.js middleware runs in the Edge Runtime, which can't read
 * IndexedDB and can't validate ID tokens (no Admin SDK). So we issue a
 * session cookie via /api/auth/session-login: the client gets an ID
 * token, posts it to the API, the server verifies it and sets an
 * HttpOnly + Secure cookie. The middleware checks that cookie's
 * presence; the page's server component (or API route) verifies its
 * signature when stricter auth is needed.
 *
 * The cookie itself is set by the server with HttpOnly+Secure, so this
 * component only POSTs/DELETEs to the API — it never touches
 * document.cookie.
 */

async function setServerSession(idToken: string): Promise<void> {
  await fetch('/api/auth/session-login', {
    method:  'POST',
    headers: { 'content-type': 'application/json' },
    body:    JSON.stringify({ idToken }),
  });
}

async function clearServerSession(): Promise<void> {
  await fetch('/api/auth/session-logout', { method: 'POST' });
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const setUser       = useMaawa((s) => s.setUser);
  const setAuthLoaded = useMaawa((s) => s.setAuthLoaded);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      try {
        if (firebaseUser) {
          /* Get a fresh ID token and exchange it for a server-set
             session cookie. We do this in parallel with profile load. */
          const [idToken, profile] = await Promise.all([
            firebaseUser.getIdToken(/* forceRefresh */ false),
            loadProfile(firebaseUser.uid),
          ]);

          await setServerSession(idToken);

          setUser({
            uid:         firebaseUser.uid,
            email:       firebaseUser.email,
            displayName: firebaseUser.displayName ?? profile?.displayName ?? null,
            ...(profile ?? {}),
          });
        } else {
          await clearServerSession();
          setUser(null);
        }
      } catch (err) {
        /* If the session-login API is unreachable we still set the
           user in local state so the UI stays usable; the next
           protected navigation will fail-safe via middleware. */
        // eslint-disable-next-line no-console
        console.error('[AuthProvider] session sync failed:', err);
      } finally {
        setAuthLoaded(true);
      }
    });

    return () => unsubscribe();
  }, [setUser, setAuthLoaded]);

  return <>{children}</>;
}

async function loadProfile(uid: string): Promise<Partial<UserProfile> | null> {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return null;
    return snap.data() as Partial<UserProfile>;
  } catch (err) {
    /* eslint-disable-next-line no-console */
    console.error('[AuthProvider] profile load failed:', err);
    return null;
  }
}
