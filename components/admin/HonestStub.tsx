'use client';

import { useRouter } from 'next/navigation';

/**
 * HonestStub — placeholder body for admin pages that don't yet have
 * a backing collection or workflow. Replaces lying "feature works"
 * mockups (the original Phase-1 admin stubs had hardcoded fake rows
 * which violated operating rule #3).
 *
 * Pass:
 *   - `emoji` + `title` for the empty-state hero.
 *   - `summary` — one-sentence explanation of what this page will do.
 *   - `phase` — milestone label, e.g. "phase post-launch".
 *   - optional `relatedLinks` — workflows that solve adjacent problems
 *     RIGHT NOW so the admin isn't stuck.
 */
interface RelatedLink { href: string; label: string; emoji?: string }

interface Props {
  emoji: string;
  title: string;
  summary: string;
  phase: string;
  relatedLinks?: RelatedLink[];
}

export default function HonestStub({ emoji, title, summary, phase, relatedLinks }: Props) {
  const router = useRouter();
  return (
    <div className="page on">
      <div className="page-header au">
        <div>
          <div className="page-h1">{emoji} {title}</div>
          <div className="page-sub">{summary}</div>
        </div>
      </div>

      <div className="card au1" style={{
        padding: '48px 24px',
        textAlign: 'center',
        background: 'var(--surface)',
        border: '1px dashed var(--border)',
      }}>
        <div style={{ fontSize: '3rem', marginBottom: 12 }}>{emoji}</div>
        <div style={{
          fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: '1.05rem',
          color: 'var(--text)', marginBottom: 8,
        }}>
          Bientôt — {phase}
        </div>
        <div style={{
          fontSize: '.88rem', color: 'var(--text2)',
          maxWidth: 480, margin: '0 auto', lineHeight: 1.55,
        }}>
          {summary}
        </div>

        {relatedLinks && relatedLinks.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <div style={{ fontSize: '.74rem', color: 'var(--text3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.05em' }}>
              En attendant
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
              {relatedLinks.map(l => (
                <button
                  key={l.href}
                  className="btn-outline sm"
                  onClick={() => router.push(l.href)}
                >
                  {l.emoji ? `${l.emoji} ` : ''}{l.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
