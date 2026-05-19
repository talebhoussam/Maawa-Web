'use client';

import { create } from 'zustand';

export type Lang = 'fr' | 'en' | 'ar';
export type Mode = 'client' | 'artisan';

export interface UserProfile {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  role?: Mode | 'admin';
  wilaya?: string;
  trade?: string;
  phone?: string;
  maawaCoinBalance?: number;
  /* Set true by admin after artisan-application approval (NIN check). */
  verified?: boolean;
}

interface MaawaState {
  lang: Lang;
  dark: boolean;
  mode: Mode;
  sidebar: boolean;
  user: UserProfile | null;
  authLoaded: boolean;
  setLang: (l: Lang) => void;
  toggleDark: () => void;
  setMode: (m: Mode) => void;
  toggleSb: () => void;
  setUser: (u: UserProfile | null) => void;
  setAuthLoaded: (loaded: boolean) => void;
}

/**
 * State for the prototype's three runtime toggles (lang / dark / mode) plus
 * mobile sidebar visibility. Components subscribe and re-render; the
 * `<ScopeRoot>` wrapper translates this state into the wrapper-div classes
 * (`dark`, `rtl`, `rtl-admin`, `artisan-mode`) that the prototype originally
 * applied to `<body>`.
 */
export const useMaawa = create<MaawaState>((set, get) => ({
  lang: 'fr',
  dark: false,
  mode: 'client',
  sidebar: false,
  user: null,
  authLoaded: false,

  setLang: (l) => set({ lang: l }),
  toggleDark: () => set({ dark: !get().dark }),
  setMode: (m) => set({ mode: m }),
  toggleSb: () => set({ sidebar: !get().sidebar }),
  setUser: (u) => set({ user: u, mode: (u?.role === 'admin' ? 'client' : u?.role) || get().mode }),
  setAuthLoaded: (loaded) => set({ authLoaded: loaded }),
}));
