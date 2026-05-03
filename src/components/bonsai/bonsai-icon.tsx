// Tiny bonsai glyph for the entry-point button on the list page. Matches
// the Enso visual family — minimal, ink-only, scales from a button slot.

interface BonsaiIconProps {
  size?: number;
  className?: string;
}

export function BonsaiIcon({ size = 22, className }: BonsaiIconProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Pot. */}
      <path
        d="M11 26 H21 L20 30 H12 Z"
        strokeWidth={1.6}
      />
      {/* Trunk: a single calligraphic curve. */}
      <path
        d="M16 26 C 15 21, 13 18, 14 14 C 15 11, 17 9, 18 6"
        strokeWidth={1.8}
      />
      {/* Right side branch. */}
      <path d="M14 14 C 18 13, 22 12, 25 13" strokeWidth={1.4} />
      {/* Foliage cloud (one, simplified). */}
      <ellipse cx={18} cy={6} rx={5} ry={2.6} fill="currentColor" stroke="none" opacity={0.85} />
      {/* Right cloud. */}
      <ellipse cx={24.5} cy={13} rx={3.2} ry={1.8} fill="currentColor" stroke="none" opacity={0.85} />
    </svg>
  );
}
