'use client';

import { useRouter } from 'next/navigation';

/**
 * Service-category landing. The categories themselves are static platform
 * metadata (UI taxonomy), not user data — kept inline. The per-category
 * artisan counts that used to appear (1 247, 892, …) were placeholder
 * numbers and have been removed; a real "X artisans" badge will land
 * with the per-category aggregation in a later phase.
 */

interface Category {
  slug: string;
  labelId: string;
  label: string;
  emoji: string;
  /* Tailwind-free inline gradient + tile height to match the masonry */
  bg: string;
  height: number;
  au?: string; /* fade-up animation class */
}

const CATEGORIES: Category[] = [
  { slug: 'plomb',  labelId: 't-cat-plomb',  label: 'Plomberie',         emoji: '🔧', bg: 'linear-gradient(135deg,#e8f7ff,#9adaff)', height: 148 },
  { slug: 'paint',  labelId: 't-cat-paint',  label: 'Peinture & Déco',   emoji: '🎨', bg: 'linear-gradient(135deg,#d1fae5,#6ee7b7)', height: 108 },
  { slug: 'gros',   labelId: 't-cat-gros',   label: 'Gros Œuvre',        emoji: '🏗️', bg: 'linear-gradient(135deg,#e8f7ff,#0072b0)', height: 175 },
  { slug: 'elec',   labelId: 't-cat-elec',   label: 'Électricité',       emoji: '⚡', bg: 'linear-gradient(135deg,#fef3c7,#fbbf24)', height: 132, au: 'au1' },
  { slug: 'menu',   labelId: 't-cat-menu',   label: 'Menuiserie',        emoji: '🪚', bg: 'linear-gradient(135deg,#ffedd5,#ea580c)', height: 156, au: 'au1' },
  { slug: 'macon',  labelId: 't-cat-macon',  label: 'Maçonnerie',        emoji: '🧱', bg: 'linear-gradient(135deg,#e8f7ff,#29b5f6)', height: 115, au: 'au2' },
  { slug: 'carrel', labelId: 't-cat-carrel', label: 'Carrelage',         emoji: '🏠', bg: 'linear-gradient(135deg,#ede9fe,#7c3aed)', height: 140, au: 'au2' },
  { slug: 'clim',   labelId: 't-cat-clim',   label: 'Climatisation',     emoji: '❄️', bg: 'linear-gradient(135deg,#cffafe,#0891b2)', height: 148, au: 'au3' },
  { slug: 'jard',   labelId: 't-cat-jard',   label: 'Jardinage',         emoji: '🌿', bg: 'linear-gradient(135deg,#d1fae5,#059669)', height: 122, au: 'au3' },
  { slug: 'serr',   labelId: 't-cat-serr',   label: 'Serrurerie',        emoji: '🚪', bg: 'linear-gradient(135deg,#e0f2fe,#0284c7)', height: 136, au: 'au4' },
  { slug: 'toit',   labelId: 't-cat-toit',   label: 'Toiture',           emoji: '🏚️', bg: 'linear-gradient(135deg,#fce7f3,#ec4899)', height: 150, au: 'au4' },
  { slug: 'ferr',   labelId: 't-cat-ferr',   label: 'Ferronnerie',       emoji: '🔩', bg: 'linear-gradient(135deg,#f1f5f9,#64748b)', height: 118, au: 'au5' },
];

export default function CategoriesPage() {
  const router = useRouter();

  return (
    <div className="screen on" id="s-categories">
      <div className="pg-title au" id="t-cat-title">Catégories de Services</div>
      <div className="pg-sub au" id="t-cat-sub">{CATEGORIES.length} métiers disponibles · Algérie</div>
      <div className="cat-masonry">
        {CATEGORIES.map(c => (
          <div
            key={c.slug}
            className={c.au ? `cat-item ${c.au}` : 'cat-item au'}
            onClick={() => router.push('/categories/' + c.slug)}
            role="button"
            tabIndex={0}
            onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && router.push('/categories/' + c.slug)}
          >
            <div className="cat-bg" style={{ background: c.bg, height: `${c.height}px` }}>{c.emoji}</div>
            <div className="cat-overlay"></div>
            <div className="cat-lbl">
              <div className="cat-name" id={c.labelId}>{c.label}</div>
              {/* Per-category artisan count removed — was placeholder data.
                  The real-count badge ships with the aggregation query. */}
            </div>
            <button
              className="cat-follow"
              onClick={(e) => { e.stopPropagation(); /* follow handler in Phase 4 */ }}
              id={c.slug === 'plomb' ? 't-follow-btn' : undefined}
            >
              Suivre
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
