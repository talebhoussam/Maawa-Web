'use client';

import { useEffect, useState } from 'react';
import { toast } from '@/lib/toast';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';

interface Broadcast {
  id: string;
  title: string;
  body: string;
  url?: string | null;
  pushEnabled: boolean;
  status: 'sending' | 'sent';
  recipientCount: number;
  pushSent: number;
  sentBy: string;
  createdAt?: { seconds: number } | null;
}

function fmt(s?: number): string {
  if (!s) return '—';
  return new Date(s * 1000).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function AdminBroadcastPage() {
  const [history, setHistory] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState('');
  const [body, setBody]   = useState('');
  const [url, setUrl]     = useState('');
  const [push, setPush]   = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!db) { setLoading(false); return; }
    const q = query(collection(db, 'broadcasts'), orderBy('createdAt', 'desc'), limit(20));
    const unsub = onSnapshot(q, snap => {
      setHistory(snap.docs.map(d => {
        const x = d.data() as Record<string, unknown>;
        return {
          id: d.id,
          title: String(x.title ?? ''),
          body:  String(x.body  ?? ''),
          url:   typeof x.url === 'string' ? x.url : null,
          pushEnabled:    x.pushEnabled !== false,
          status:         (x.status as Broadcast['status']) ?? 'sent',
          recipientCount: Number(x.recipientCount ?? 0),
          pushSent:       Number(x.pushSent ?? 0),
          sentBy:         String(x.sentBy ?? ''),
          createdAt:      (x.createdAt as { seconds: number } | null) ?? null,
        };
      }));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, []);

  const send = async () => {
    if (title.trim().length === 0 || body.trim().length === 0) {
      toast('⚠️ Titre et message requis');
      return;
    }
    if (!confirm(`Envoyer ce message à TOUS les utilisateurs ?\n\n"${title}"\n\nCette action ne peut pas être annulée.`)) return;
    setSending(true);
    try {
      const res = await fetch('/api/admin/broadcast/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          body:  body.trim(),
          url:   url.trim() || undefined,
          push,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast('❌ ' + (j.message ?? 'Erreur'));
      } else {
        const j = await res.json();
        toast(`✅ Envoyé à ${j.recipientCount} utilisateurs (${j.pushSent} push)`);
        setTitle(''); setBody(''); setUrl('');
      }
    } catch {
      toast('❌ Erreur réseau');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="page on" id="page-broadcast">
      <div className="page-header au">
        <div>
          <div className="page-h1">📢 Diffusion</div>
          <div className="page-sub">Envoyer une notification à tous les utilisateurs</div>
        </div>
      </div>

      {/* Compose */}
      <div className="card au1" style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: '.92rem', marginBottom: 10 }}>
          ✉️ Nouveau message
        </div>
        <label style={{ display: 'block', fontSize: '.74rem', fontWeight: 600, marginBottom: 3, color: 'var(--text2)' }}>
          Titre
        </label>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value.slice(0, 80))}
          placeholder="Ex. Nouvelle fonctionnalité disponible"
          disabled={sending}
          maxLength={80}
          style={{
            width: '100%', padding: 9, marginBottom: 10,
            border: '1.5px solid var(--border2)', borderRadius: 'var(--rx)',
            background: 'var(--surface)', color: 'var(--text)',
            fontSize: '.88rem',
          }}
        />
        <label style={{ display: 'block', fontSize: '.74rem', fontWeight: 600, marginBottom: 3, color: 'var(--text2)' }}>
          Message
        </label>
        <textarea
          value={body}
          onChange={e => setBody(e.target.value.slice(0, 500))}
          rows={4}
          maxLength={500}
          placeholder="Le corps du message. Restez concis — c'est une notification."
          disabled={sending}
          style={{
            width: '100%', padding: 9, marginBottom: 4,
            border: '1.5px solid var(--border2)', borderRadius: 'var(--rx)',
            background: 'var(--surface)', color: 'var(--text)',
            fontSize: '.86rem', fontFamily: 'inherit', resize: 'vertical',
          }}
        />
        <div style={{ fontSize: '.7rem', color: 'var(--text3)', textAlign: 'right', marginBottom: 10 }}>
          {body.length} / 500
        </div>
        <label style={{ display: 'block', fontSize: '.74rem', fontWeight: 600, marginBottom: 3, color: 'var(--text2)' }}>
          Lien d&apos;action (optionnel)
        </label>
        <input
          type="text"
          value={url}
          onChange={e => setUrl(e.target.value.slice(0, 200))}
          placeholder="Ex. /feed ou /explore"
          disabled={sending}
          style={{
            width: '100%', padding: 9, marginBottom: 10,
            border: '1.5px solid var(--border2)', borderRadius: 'var(--rx)',
            background: 'var(--surface)', color: 'var(--text)',
            fontSize: '.86rem',
          }}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={push}
            onChange={e => setPush(e.target.checked)}
            disabled={sending}
            style={{ accentColor: 'var(--b500)' }}
          />
          <span style={{ fontSize: '.84rem' }}>Aussi envoyer en notification push (web)</span>
        </label>
        <button
          className="btn-primary"
          onClick={send}
          disabled={sending || title.trim().length === 0 || body.trim().length === 0}
          style={{ width: '100%', justifyContent: 'center' }}
        >
          {sending ? 'Envoi en cours…' : '📢 Envoyer à tous'}
        </button>
      </div>

      {/* History */}
      <div className="card au2" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: 12, borderBottom: '1px solid var(--border)', fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: '.92rem' }}>
          📜 Historique des envois ({history.length})
        </div>
        {loading ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text3)' }}>…</div>
        ) : history.length === 0 ? (
          <div style={{ padding: 28, textAlign: 'center', color: 'var(--text2)' }}>
            Aucun envoi pour l&apos;instant.
          </div>
        ) : history.map(h => (
          <div key={h.id} style={{ padding: 12, borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
              <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: '.86rem', color: 'var(--text)' }}>
                {h.title}
              </span>
              <span style={{ fontSize: '.7rem', color: 'var(--text3)' }}>
                {fmt(h.createdAt?.seconds)} ·
                {h.recipientCount} destinataires
                {h.pushEnabled && <> · {h.pushSent} push</>}
                {h.status === 'sending' && ' · en cours…'}
              </span>
            </div>
            <div style={{ fontSize: '.78rem', color: 'var(--text2)', marginTop: 4, lineHeight: 1.5 }}>
              {h.body}
            </div>
            {h.url && (
              <div style={{ fontSize: '.72rem', color: 'var(--b500)', marginTop: 4, fontFamily: 'monospace' }}>
                → {h.url}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
