'use client';

import { useEffect, useState } from 'react';
import { toast } from '@/lib/toast';
import { db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

/**
 * Admin Platform Settings.
 *
 * Reads platform_settings/global live so an admin can see another
 * admin's changes propagate without a refresh. Writes through
 * /api/admin/settings/update which audits each change.
 *
 * Each field has an env-var fallback hint shown in placeholder so the
 * operator knows the platform won't break if the doc is missing.
 */

interface Settings {
  mcRateDZD?: number;
  commissionPct?: number;
  supportPhone?: string;
  ccpNumber?: string;
  baridimobNumber?: string;
  officeAddress?: string;
  bannerMessage?: string | null;
  maintenanceMode?: boolean;
  updatedAt?: { seconds: number } | null;
  updatedBy?: string;
}

function fmt(s?: number): string {
  if (!s) return '—';
  return new Date(s * 1000).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function AdminSettingsPage() {
  const [server, setServer] = useState<Settings | null>(null);
  const [draft, setDraft]   = useState<Settings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!db) { setLoading(false); return; }
    const unsub = onSnapshot(doc(db, 'platform_settings', 'global'), snap => {
      const data = snap.exists() ? snap.data() as Settings : {};
      setServer(data);
      setDraft(data);
      setLoading(false);
    }, err => {
      console.error('settings snapshot', err);
      setLoading(false);
    });
    return unsub;
  }, []);

  /* Build the diff — only fields the admin actually touched. */
  const diff = (): Partial<Settings> => {
    if (!server) return {};
    const out: Record<string, unknown> = {};
    const keys: (keyof Settings)[] = [
      'mcRateDZD', 'commissionPct', 'supportPhone',
      'ccpNumber', 'baridimobNumber', 'officeAddress',
      'bannerMessage', 'maintenanceMode',
    ];
    for (const k of keys) {
      const a = (draft as Settings)[k] ?? null;
      const b = (server as Settings)[k] ?? null;
      if (a !== b) out[k] = (draft as Settings)[k];
    }
    return out;
  };

  const dirty = Object.keys(diff()).length > 0;

  const save = async () => {
    const payload = diff();
    if (Object.keys(payload).length === 0) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/settings/update', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast('❌ ' + (j.message ?? 'Erreur'));
      } else {
        toast('✅ Paramètres enregistrés');
      }
    } catch {
      toast('❌ Erreur réseau');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page on" id="page-settings">
      <div className="page-header au">
        <div>
          <div className="page-h1">⚙️ Paramètres plateforme</div>
          <div className="page-sub">
            Configuration opérationnelle modifiable sans redéploiement
            {server?.updatedAt && (
              <> · dernière modification {fmt(server.updatedAt.seconds)}</>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)' }}>Chargement…</div>
      ) : (
        <>
          {/* Maintenance banner */}
          <div className="card au1" style={{ padding: 14, marginBottom: 14 }}>
            <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: '.92rem', marginBottom: 10 }}>
              🚨 État de la plateforme
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={!!draft.maintenanceMode}
                onChange={e => setDraft(d => ({ ...d, maintenanceMode: e.target.checked }))}
                style={{ accentColor: 'var(--rd)', width: 18, height: 18 }}
              />
              <span style={{ fontSize: '.86rem', color: 'var(--text)' }}>
                Mode maintenance — bloque les nouvelles inscriptions et missions
              </span>
            </label>
            <Field
              label="Message de bannière (affiché en haut de l'app)"
              value={draft.bannerMessage ?? ''}
              onChange={v => setDraft(d => ({ ...d, bannerMessage: v || null }))}
              placeholder="Ex. Maintenance prévue dimanche 02h-04h"
              maxLength={500}
            />
          </div>

          {/* Money */}
          <div className="card au2" style={{ padding: 14, marginBottom: 14 }}>
            <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: '.92rem', marginBottom: 10 }}>
              💰 Monétisation
            </div>
            <NumField
              label="Taux MaawaCoin → DZD"
              value={draft.mcRateDZD}
              onChange={v => setDraft(d => ({ ...d, mcRateDZD: v }))}
              placeholder="Fallback env: NEXT_PUBLIC_MC_RATE_DZD (50)"
              min={1} max={10_000}
            />
            <NumField
              label="Commission plateforme (%)"
              value={draft.commissionPct}
              onChange={v => setDraft(d => ({ ...d, commissionPct: v }))}
              placeholder="0–50 — affecté aux finances artisan"
              min={0} max={50} step={0.5}
            />
          </div>

          {/* Contact */}
          <div className="card au3" style={{ padding: 14, marginBottom: 14 }}>
            <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: '.92rem', marginBottom: 10 }}>
              📞 Coordonnées
            </div>
            <Field
              label="Téléphone support"
              value={draft.supportPhone ?? ''}
              onChange={v => setDraft(d => ({ ...d, supportPhone: v }))}
              placeholder="Format +213XXXXXXXXX"
            />
            <Field
              label="Numéro CCP"
              value={draft.ccpNumber ?? ''}
              onChange={v => setDraft(d => ({ ...d, ccpNumber: v }))}
              placeholder="Ex. 1234567890 clé 12"
            />
            <Field
              label="Numéro Baridimob"
              value={draft.baridimobNumber ?? ''}
              onChange={v => setDraft(d => ({ ...d, baridimobNumber: v }))}
              placeholder="+213 6X XX XX XX XX"
            />
            <Field
              label="Adresse bureau (retrait en espèces)"
              value={draft.officeAddress ?? ''}
              onChange={v => setDraft(d => ({ ...d, officeAddress: v }))}
              placeholder="Ex. 12 rue Didouche Mourad, Alger"
              maxLength={300}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button
              className="btn-outline"
              onClick={() => setDraft(server ?? {})}
              disabled={!dirty || saving}
            >
              Annuler
            </button>
            <button
              className="btn-primary"
              onClick={save}
              disabled={!dirty || saving}
            >
              {saving ? 'Enregistrement…' : `Enregistrer${dirty ? ` (${Object.keys(diff()).length})` : ''}`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ---------- helpers ---------- */

function Field({ label, value, onChange, placeholder, maxLength = 200 }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; maxLength?: number;
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ display: 'block', fontSize: '.74rem', fontWeight: 600, marginBottom: 3, color: 'var(--text2)' }}>
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value.slice(0, maxLength))}
        placeholder={placeholder}
        style={{
          width: '100%', padding: 8,
          border: '1.5px solid var(--border2)', borderRadius: 'var(--rx)',
          background: 'var(--surface)', color: 'var(--text)',
          fontSize: '.86rem',
        }}
      />
    </div>
  );
}

function NumField({ label, value, onChange, placeholder, min, max, step = 1 }: {
  label: string; value: number | undefined; onChange: (v: number | undefined) => void;
  placeholder?: string; min?: number; max?: number; step?: number;
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ display: 'block', fontSize: '.74rem', fontWeight: 600, marginBottom: 3, color: 'var(--text2)' }}>
        {label}
      </label>
      <input
        type="number"
        value={value ?? ''}
        onChange={e => {
          const v = e.target.value;
          if (v === '') { onChange(undefined); return; }
          const n = Number(v);
          if (!Number.isNaN(n)) onChange(n);
        }}
        placeholder={placeholder}
        min={min} max={max} step={step}
        style={{
          width: '100%', padding: 8,
          border: '1.5px solid var(--border2)', borderRadius: 'var(--rx)',
          background: 'var(--surface)', color: 'var(--text)',
          fontSize: '.86rem',
        }}
      />
    </div>
  );
}
