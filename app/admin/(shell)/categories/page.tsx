'use client';

import { useEffect, useState } from 'react';
import { toast } from '@/lib/toast';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';

/**
 * Admin Categories.
 *
 * Lists all service categories (active + inactive). Inline editing of
 * label translations and icon; toggle active/inactive; create new
 * categories. Soft-delete only — see API route.
 */

interface Category {
  id: string;
  labelFr: string;
  labelEn: string;
  labelAr: string;
  icon: string;
  active: boolean;
  createdAt?: { seconds: number } | null;
}

function fmt(s?: number): string {
  if (!s) return '—';
  return new Date(s * 1000).toLocaleDateString('fr-FR');
}

export default function AdminCategoriesPage() {
  const [rows, setRows] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [acting, setActing] = useState<string | null>(null);

  useEffect(() => {
    if (!db) { setLoading(false); return; }
    const q = query(collection(db, 'categories'), orderBy('labelFr'), limit(100));
    const unsub = onSnapshot(q, snap => {
      setRows(snap.docs.map(d => {
        const x = d.data() as Record<string, unknown>;
        return {
          id: d.id,
          labelFr: String(x.labelFr ?? d.id),
          labelEn: String(x.labelEn ?? x.labelFr ?? d.id),
          labelAr: String(x.labelAr ?? x.labelFr ?? d.id),
          icon:    String(x.icon ?? '🔧'),
          active:  x.active !== false,
          createdAt: (x.createdAt as { seconds: number } | null) ?? null,
        };
      }));
      setLoading(false);
    }, err => {
      console.error('categories snapshot', err);
      setError('Impossible de charger les catégories');
      setLoading(false);
    });
    return unsub;
  }, []);

  const saveCategory = async (c: Partial<Category> & { labelFr: string }, isNew: boolean) => {
    setActing(c.id ?? 'new');
    try {
      const res = await fetch('/api/admin/categories/upsert', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          id:      isNew ? undefined : c.id,
          labelFr: c.labelFr,
          labelEn: c.labelEn,
          labelAr: c.labelAr,
          icon:    c.icon,
          active:  c.active,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast('❌ ' + (j.message ?? 'Erreur'));
      } else {
        toast(isNew ? '✅ Catégorie créée' : '✅ Mise à jour');
        setShowCreate(false);
        setEditing(null);
      }
    } catch {
      toast('❌ Erreur réseau');
    } finally {
      setActing(null);
    }
  };

  const deactivate = async (c: Category) => {
    if (!confirm(`Désactiver "${c.labelFr}" ? Elle disparaîtra des listes mais les données historiques restent.`)) return;
    setActing(c.id);
    try {
      const res = await fetch('/api/admin/categories/delete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: c.id }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast('❌ ' + (j.message ?? 'Erreur'));
      } else {
        toast('Catégorie désactivée');
      }
    } catch {
      toast('❌ Erreur réseau');
    } finally {
      setActing(null);
    }
  };

  return (
    <div className="page on" id="page-categories">
      <div className="page-header au">
        <div>
          <div className="page-h1">🏷️ Catégories métier</div>
          <div className="page-sub">{rows.length} catégories · {rows.filter(r => r.active).length} actives</div>
        </div>
        <button className="btn-primary" onClick={() => setShowCreate(true)}>
          ➕ Nouvelle catégorie
        </button>
      </div>

      <div className="card au1" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)' }}>Chargement…</div>
        ) : error ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--rd)' }}>{error}</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>
            <div style={{ fontSize: '2.4rem', marginBottom: 8 }}>📭</div>
            <div style={{ fontSize: '.9rem', fontWeight: 600 }}>
              Aucune catégorie. Créez la première pour commencer.
            </div>
          </div>
        ) : rows.map(c => (
          <div key={c.id} style={{
            display: 'flex', gap: 14, alignItems: 'center', padding: 14,
            borderBottom: '1px solid var(--border)',
            opacity: c.active ? 1 : 0.55,
          }}>
            <div style={{ fontSize: '2rem', width: 44, textAlign: 'center' }}>{c.icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: '.94rem' }}>
                  {c.labelFr}
                </span>
                {!c.active && (
                  <span style={{
                    fontSize: '.66rem', fontWeight: 700, color: 'var(--rd)',
                    background: 'var(--rl)', padding: '2px 8px', borderRadius: 50,
                  }}>Inactif</span>
                )}
                <span style={{ fontSize: '.7rem', color: 'var(--text3)', fontFamily: 'monospace' }}>id: {c.id}</span>
              </div>
              <div style={{ fontSize: '.76rem', color: 'var(--text2)', marginTop: 3 }}>
                EN: {c.labelEn} · AR: {c.labelAr} · créé le {fmt(c.createdAt?.seconds)}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 110 }}>
              <button
                className="btn-outline sm"
                onClick={() => setEditing(c)}
                disabled={acting === c.id}
                style={{ justifyContent: 'center' }}
              >
                Modifier
              </button>
              {c.active ? (
                <button
                  className="btn-outline sm"
                  onClick={() => deactivate(c)}
                  disabled={acting === c.id}
                  style={{ justifyContent: 'center', borderColor: 'var(--or)', color: 'var(--or)' }}
                >
                  Désactiver
                </button>
              ) : (
                <button
                  className="btn-primary sm"
                  onClick={() => saveCategory({ ...c, active: true }, false)}
                  disabled={acting === c.id}
                  style={{ justifyContent: 'center', background: 'var(--gn)' }}
                >
                  Réactiver
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {(showCreate || editing) && (
        <CategoryEditor
          initial={editing ?? undefined}
          submitting={acting !== null}
          onCancel={() => { setShowCreate(false); setEditing(null); }}
          onSubmit={c => saveCategory(c, !editing)}
        />
      )}
    </div>
  );
}

function CategoryEditor({
  initial, submitting, onCancel, onSubmit,
}: {
  initial?: Partial<Category>;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (c: Partial<Category> & { labelFr: string }) => void;
}) {
  const [labelFr, setLabelFr] = useState(initial?.labelFr ?? '');
  const [labelEn, setLabelEn] = useState(initial?.labelEn ?? '');
  const [labelAr, setLabelAr] = useState(initial?.labelAr ?? '');
  const [icon,    setIcon]    = useState(initial?.icon ?? '🔧');
  const isNew = !initial?.id;

  return (
    <div className="modal-bg on" onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal-box" style={{ maxWidth: 460, padding: 22 }}>
        <div className="modal-header">
          <div className="modal-title">{isNew ? '➕ Nouvelle catégorie' : '✏️ Modifier'}</div>
          <button className="modal-close" onClick={onCancel} aria-label="Fermer">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
          <input
            type="text"
            value={icon}
            onChange={e => setIcon(e.target.value.slice(0, 4))}
            placeholder="🔧"
            style={{
              width: 60, fontSize: '1.5rem', textAlign: 'center',
              padding: 9, border: '1.5px solid var(--border2)', borderRadius: 'var(--rx)',
              background: 'var(--surface)', color: 'var(--text)',
            }}
          />
          <input
            type="text"
            value={labelFr}
            onChange={e => setLabelFr(e.target.value.slice(0, 80))}
            placeholder="Nom en français (ex. Plomberie)"
            disabled={submitting}
            style={{
              flex: 1, padding: 9,
              border: '1.5px solid var(--border2)', borderRadius: 'var(--rx)',
              background: 'var(--surface)', color: 'var(--text)',
              fontSize: '.88rem',
            }}
          />
        </div>
        <input
          type="text"
          value={labelEn}
          onChange={e => setLabelEn(e.target.value.slice(0, 80))}
          placeholder="English (optional — fallback to FR)"
          disabled={submitting}
          style={{
            width: '100%', padding: 9, marginBottom: 8,
            border: '1.5px solid var(--border2)', borderRadius: 'var(--rx)',
            background: 'var(--surface)', color: 'var(--text)',
            fontSize: '.88rem',
          }}
        />
        <input
          type="text"
          value={labelAr}
          onChange={e => setLabelAr(e.target.value.slice(0, 80))}
          placeholder="بالعربية (optionnel)"
          disabled={submitting}
          style={{
            width: '100%', padding: 9, marginBottom: 14,
            border: '1.5px solid var(--border2)', borderRadius: 'var(--rx)',
            background: 'var(--surface)', color: 'var(--text)',
            fontSize: '.88rem',
          }}
        />

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-outline" onClick={onCancel} disabled={submitting} style={{ flex: 1, justifyContent: 'center' }}>
            Annuler
          </button>
          <button
            className="btn-primary"
            onClick={() => onSubmit({ id: initial?.id, labelFr, labelEn, labelAr, icon })}
            disabled={submitting || labelFr.trim().length === 0}
            style={{ flex: 2, justifyContent: 'center' }}
          >
            {submitting ? '…' : isNew ? 'Créer' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}
