'use client';

import { useRouter } from 'next/navigation';

/**
 * ComingSoonPage — honest empty state for admin sections that don't
 * have backing data sources yet.
 *
 * Rather than render fake metrics or stub UI, each page using this
 * component:
 *   - States the feature name + why it's not live yet.
 *   - Points to the closest existing surface that solves part of
 *     the same problem (so the admin isn't stuck).
 *   - Lists what the operator would need to do to enable it.
 *
 * This component is deliberately not flashy — it's an admin surface,
 * not a marketing page. The point is to be informative.
 */

interface RelatedLink {
  href: string;
  label: string;
}

interface Props {
  /** Page title shown in the header (e.g. "🎯 Publicités"). */
  title: string;
  /** One-sentence reason, e.g. "L'inventaire publicitaire arrive
   *  avec la prochaine campagne de monétisation." */
  reason: string;
  /** What the operator needs to do to unblock — bullet list. */
  blockedBy?: string[];
  /** Links to existing surfaces handling a related concern. */
  related?: RelatedLink[];
}

export default function ComingSoonPage({ title, reason, blockedBy, related }: Props) {
  const router = useRouter();
  return (
    <div className="page on">
      <div className="page-header au">
        <div>
          <div className="page-h1">{title}</div>
          <div className="page-sub">Bientôt disponible — phase post-launch</div>
        </div>
      </div>

      <div className="card au1" style={{ padding: 22, maxWidth: 680 }}>
        <div style={{ fontSize: '3rem', textAlign: 'center', marginBottom: 14 }}>🚧</div>
        <div style={{ fontSize: '.92rem', color: 'var(--text)', lineHeight: 1.6, marginBottom: 14 }}>
          {reason}
        </div>

        {blockedBy && blockedBy.length > 0 && (
          <>
            <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: '.86rem', marginBottom: 6 }}>
              Pré-requis pour activer :
            </div>
            <ul style={{ marginLeft: 20, marginBottom: 16, color: 'var(--text2)', fontSize: '.84rem', lineHeight: 1.7 }}>
              {blockedBy.map((b, i) => <li key={i}>{b}</li>)}
            </ul>
          </>
        )}

        {related && related.length > 0 && (
          <>
            <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: '.86rem', marginBottom: 8 }}>
              En attendant :
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {related.map(l => (
                <button
                  key={l.href}
                  className="btn-outline sm"
                  onClick={() => router.push(l.href)}
                >
                  {l.label} →
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
