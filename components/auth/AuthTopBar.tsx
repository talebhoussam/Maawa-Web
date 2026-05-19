'use client';

import { useMaawa, type Lang } from '@/lib/store';

const LangPill = ({ id, label, lang }: { id: string; label: string; lang: Lang }) => {
  const current = useMaawa(s => s.lang);
  const setLang = useMaawa(s => s.setLang);
  return (
    <button
      className={'a-lp' + (current === lang ? ' on' : '')}
      id={id}
      onClick={() => setLang(lang)}
    >
      {label}
    </button>
  );
};

export default function AuthTopBar() {
  const dark = useMaawa(s => s.dark);
  const toggleDark = useMaawa(s => s.toggleDark);
  return (
    <div className="auth-top-bar">
      <div className="a-logo-wrap">
        <div className="a-logo-box">
          <svg width="22" height="20" viewBox="0 0 60 55" fill="none">
            <path d="M30 5L55 27L50 27L50 50L35 50L35 36L25 36L25 50L10 50L10 27L5 27Z" stroke="#29B6F6" strokeWidth="3" fill="none" strokeLinejoin="round" />
            <path d="M18 42L18 22L30 34L42 22L42 42" stroke="#29B6F6" strokeWidth="3" fill="none" strokeLinecap="round" />
            <path d="M10 50Q30 60 50 50" stroke="#29B6F6" strokeWidth="2.2" fill="none" strokeLinecap="round" />
          </svg>
        </div>
        <span className="a-logo-txt">Maawa</span>
      </div>
      <div className="a-lang-pills">
        <LangPill id="alp-en" label="🇬🇧 EN" lang="en" />
        <LangPill id="alp-fr" label="🇫🇷 FR" lang="fr" />
        <LangPill id="alp-ar" label="🇩🇿 AR" lang="ar" />
      </div>
      <button className="a-dm" id="a-dm-btn" onClick={toggleDark} title="Dark / Light">
        {dark ? '☀️' : '🌙'}
      </button>
    </div>
  );
}
