/**
 * SponsoredBadge — "Sponsorisé" label rendered under an author name,
 * matching Meta's pattern. Renders nothing when `sponsored` is false.
 *
 * Admin-only flag (see /api/admin/content/sponsor); the badge itself
 * is just presentational.
 */

interface Props {
  sponsored: boolean | undefined | null;
  /* Optional override label for languages other than FR. */
  label?: string;
}

export default function SponsoredBadge({ sponsored, label = 'Sponsorisé' }: Props) {
  if (!sponsored) return null;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: '.62rem',
        fontWeight: 600,
        color: 'var(--text3)',
        marginTop: 1,
      }}
    >
      {/* Small "i" glyph mirrors Meta's promoted-post indicator
          without copying their proprietary icon. */}
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <circle cx="12" cy="16" r="0.5" fill="currentColor" />
      </svg>
      {label}
    </span>
  );
}
