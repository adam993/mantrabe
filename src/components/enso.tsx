// Enso — a brushed zen circle, drawn with a deliberate gap so it reads as
// hand-stroked rather than computer-perfect. Used as the logo + empty state.

interface EnsoProps {
  size?: number;
  className?: string;
  strong?: boolean;
}

export function Enso({ size = 28, className, strong = false }: EnsoProps) {
  if (strong) {
    return (
      <svg
        viewBox="0 0 100 100"
        className={className}
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        <circle
          cx="50"
          cy="50"
          r="38"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray="230 28"
          strokeDashoffset="-6"
          transform="rotate(-22 50 50)"
          opacity="0.85"
        />
      </svg>
    );
  }
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      style={{ width: size, height: size, flexShrink: 0 }}
      aria-hidden="true"
    >
      <circle
        cx="16"
        cy="16"
        r="12"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeDasharray="75 8"
        strokeDashoffset="-2"
        transform="rotate(-22 16 16)"
        opacity="0.92"
      />
    </svg>
  );
}
