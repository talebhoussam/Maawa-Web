'use client';

import { useEffect, useState } from 'react';
import { toast } from '@/lib/toast';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';

interface Ad {
  id: string;
  title: string;
  body: string;
  imageUrl?: string | null;
  ctaUrl?:   string | null;
  ctaLabel?: string | null;
  active: boolean;
  createdAt?: { seconds: number } | null;
}

function fmt(s?: number): string {
  if (!s) return '—';
  return new Date(s * 1000).toLocaleDateString('fr-FR');
}

export default function AdminAdsPage() {
  const [rows, setRows] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Ad | null>(null);
  const [creating, setCreating] = useState(false);
  const [acting, setActing] = useState<string | null>(null);

  useEffect(() => {
    if (!db) { setLoading(false); return; }
    const q = query(collection(db, 'ads'), orderBy('createdAt', 'desc'), limit(100));
    const unsub = onSnapshot(q, snap => {
      setRows(snap.docs.map(d => {
        const x = d.data() as Record<string, unknown>;
        return {
          id: d.id,
          title:    String(x.title ?? ''),
          body:     String(x.body  ?? ''),
          imageUrl: (x.imageUrl as string | null) ?? null,
          ctaUrl:   (x.ctaUrl   as string | null) ?? null,
          ctaLabel: (x.ctaLabel as string | null) ?? null,
          active:   x.active !== false,
          createdAt:(x.createdAt as { seconds: number } | null) ?? null,
        };
      }));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, []);

  const save = async (a: Partial<Ad>, isNew: boolean) => {
    if (!a.title || !a.body) {
      toast('⚠️ Titre et corps requis');
      return;
    }
    setActing(a.id ?? 'new');
    try {
      const res = await fetch('/api/admin/ads/upsert', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          id: isNew ? undefined : a.id,
          title: a.title, body: a.body,
          imageUrl: a.imageUrl ?? undefined,
          ctaUrl:   a.ctaUrl ?? undefined,
          ctaLabel: a.ctaLabel ?? undefined,
          active:   a.active,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast('❌ ' + (j.message ?? 'Erreur'));
      } else {
        toast(isNew ? '✅ Annonce créée' : '✅ Mise à jour');
        setCreating(false);
        setEditing(null);
      }
    } catch {
      toast('❌ Erreur réseau');
    } finally {
      setActing(null);
    }
  };

  const deactivate = async (a: Ad) => {
    if (!confirm(`Désactiver "${a.title}" ?`)) return;
    setActing(a.id);
    try {
      const res = await fetch('/api/admin/ads/delete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: a.id }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast('❌ ' + (j.message ?? 'Erreur'));
      } else {
        toast('Annonce désactivée');
      }
    } catch {
      toast('❌ Erreur réseau');
    } finally {
      setActing(null);
    }
  };

  return (
    <div className="page on" id="page-ads">
      <div className="page-header au">
        <div>
          <div className="page-h1">🎯 Publicités</div>
          <div className="page-sub">
            {rows.length} annonces · {rows.filter(r => r.active).length} actives ·
            cards promotionnelles affichées dans le feed
          </div>
        </div>
        <button className="btn-primary" onClick={() => setCreating(true)}>
          ➕ Nouvelle annonce
        </button>
      </div>

      <div className="card au1" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)' }}>Chargement…</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>
            <div style={{ fontSize: '2.4rem', marginBottom: 8 }}>📭</div>
            <div style={{ fontSize: '.9rem', color: 'var(--text2)', fontWeight: 600 }}>
              Aucune annonce. Créez la première.
            </div>
          </div>
        ) : rows.map(a => (
          <div key={a.id} style={{
            display: 'flex', gap: 14, padding: 14,
            borderBottom: '1px solid var(--border)',
            opacity: a.active ? 1 : 0.55,
          }}>
            {a.imageUrl && (
              <div style={{
                width: 80, height: 80, flexShrink: 0,
                background: `url(${a.imageUrl}) center/cover, var(--surface2)`,
                borderRadius: 'var(--rx)',
              }} />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: '.94rem', color: 'var(--text)' }}>
                  {a.title}
                </span>
                {!a.active && (
                  <span style={{
                    fontSize: '.66rem', fontWeight: 700, color: 'var(--rd)',
                    background: 'var(--rl)', padding: '2px 8px', borderRadius: 50,
                  }}>Inactive</span>
                )}
                <span style={{ fontSize: '.7rem', color: 'var(--text3)' }}>· créée {fmt(a.createdAt?.seconds)}</span>
              </div>
              <div style={{ fontSize: '.82rem', color: 'var(--text2)', marginTop: 4, lineHeight: 1.5 }}>
                {a.body}
              </div>
              {a.ctaUrl && (
                <div style={{ fontSize: '.74rem', color: 'var(--b500)', marginTop: 4 }}>
                  → {a.ctaLabel ?? 'En savoir plus'} ({a.ctaUrl})
                </div>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 110 }}>
              <button className="btn-outline sm" onClick={() => setEditing(a)} disabled={acting === a.id} style={{ justifyContent: 'center' }}>
                Modifier
              </button>
              {a.active ? (
                <button className="btn-outline sm" onClick={() => deactivate(a)} disabled={acting === a.id} style={{ justifyContent: 'center', borderColor: 'var(--or)', color: 'var(--or)' }}>
                  Désactiver
                </button>
              ) : (
                <button className="btn-primary sm" onClick={() => save({ ...a, active: true }, false)} disabled={acting === a.id} style={{ justifyContent: 'center', background: 'var(--gn)' }}>
                  Réactiver
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {(creating || editing) && (
        <AdEditor
          initial={editing ?? undefined}
          submitting={acting !== null}
          onCancel={() => { setCreating(false); setEditing(null); }}
          onSubmit={a => save(a, !editing)}
        />
      )}
    </div>
  );
}

function AdEditor({
  initial, submitting, onCancel, onSubmit,
}: {
  initial?: Ad;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (a: Partial<Ad>) => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [body, setBody]   = useState(initial?.body ?? '');
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? '');
  const [ctaUrl, setCtaUrl]     = useState(initial?.ctaUrl ?? '');
  const [ctaLabel, setCtaLabel] = useState(initial?.ctaLabel ?? '');
  const isNew = !initial?.id;

  return (
    <div className="modal-bg on" onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal-box" style={{ maxWidth: 500, padding: 22 }}>
        <div className="modal-header">
          <div className="modal-title">{isNew ? '➕ Nouvelle annonce' : '✏️ Modifier'}</div>
          <button className="modal-close" onClick={onCancel} aria-label="Fermer">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <Lbl>Titre</Lbl>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value.slice(0, 80))}
          placeholder="Ex. Devenez artisan Maawa"
          disabled={submitting}
          maxLength={80}
          style={inputStyle}
        />
        <Lbl>Corps</Lbl>
        <textarea
          value={body}
          onChange={e => setBody(e.target.value.slice(0, 300))}
          rows={3}
          maxLength={300}
          placeholder="Le texte court affiché sous le titre"
          disabled={submitting}
          style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }}
        />
        <Lbl>URL image (optionnel)</Lbl>
        <input
          type="text"
          value={imageUrl}
          onChange={e => setImageUrl(e.target.value.slice(0, 1000))}
          placeholder="https://… ou chemin Storage"
          disabled={submitting}
          style={inputStyle}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <Lbl>Texte CTA</Lbl>
            <input
              type="text"
              value={ctaLabel}
              onChange={e => setCtaLabel(e.target.value.slice(0, 40))}
              placeholder="En savoir plus"
              disabled={submitting}
              style={inputStyle}
            />
          </div>
          <div style={{ flex: 2 }}>
            <Lbl>URL CTA</Lbl>
            <input
              type="text"
              value={ctaUrl}
              onChange={e => setCtaUrl(e.target.value.slice(0, 200))}
              placeholder="Ex. /apply"
              disabled={submitting}
              style={inputStyle}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button className="btn-outline" onClick={onCancel} disabled={submitting} style={{ flex: 1, justifyContent: 'center' }}>
            Annuler
          </button>
          <button
            className="btn-primary"
            onClick={() => onSubmit({ id: initial?.id, title, body, imageUrl, ctaUrl, ctaLabel })}
            disabled={submitting || title.trim().length === 0 || body.trim().length === 0}
            style={{ flex: 2, justifyContent: 'center' }}
          >
            {submitting ? '…' : isNew ? 'Créer' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%', padding: 9, marginBottom: 10,
  border: '1.5px solid var(--border2)', borderRadius: 'var(--rx)',
  background: 'var(--surface)', color: 'var(--text)',
  fontSize: '.86rem',
} as const;

function Lbl({ children }: { children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', fontSize: '.74rem', fontWeight: 600, marginBottom: 3, color: 'var(--text2)' }}>
      {children}
    </label>
  );
}
