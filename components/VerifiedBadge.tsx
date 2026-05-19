/**
 * VerifiedBadge — small blue checkmark shown next to a verified
 * artisan's name.
 *
 * Renders nothing when `verified` is falsy, so callers can drop it
 * unconditionally next to any name:
 *   <span>{user.displayName} <VerifiedBadge verified={user.verified} /></span>
 *
 * Sizes default to ~14px so it sits naturally inline with most
 * 14-16px text. Pass `size` to override.
 *
 * Accessibility: native `title` attribute + `aria-label` so screen
 * readers announce "Artisan vérifié par Maawa".
 */

interface Props {
  verified: boolean | undefined | null;
  size?: number;
  /* Optional className so callers can nudge margins to match
     their typography. */
  className?: string;
}

export default function VerifiedBadge({ verified, size = 14, className }: Props) {
  if (!verified) return null;
  return (
    <span
      title="Artisan vérifié par Maawa"
      aria-label="Artisan vérifié par Maawa"
      className={className}
      style={{
        display: 'inline-flex', verticalAlign: 'middle',
        marginLeft: 4, flexShrink: 0,
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        {/* Twelve-point starburst — distinctive enough to read
            even at 14px; same shape Twitter/Meta use. */}
        <path
          d="M12 1.5l2.4 1.8 2.95-.5 1.2 2.75 2.65 1.4-.45 3 1.8 2.45-1.8 2.45.45 3-2.65 1.4-1.2 2.75-2.95-.5L12 22.5l-2.4-1.8-2.95.5-1.2-2.75-2.65-1.4.45-3L1.45 11.6 3.25 9.15l-.45-3 2.65-1.4 1.2-2.75 2.95.5L12 1.5z"
          fill="#29B6F6"
        />
        <path
          d="M8.5 12.3l2.4 2.4 4.6-4.6"
          stroke="#fff"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
