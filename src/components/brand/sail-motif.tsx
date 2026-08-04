/**
 * Gold line-drawing of the stadium's twin sail-prow masts — the form that
 * alludes to the Khmer sampeah gesture. Decorative only.
 */
export function SailMotif({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="200"
      height="170"
      viewBox="0 0 200 170"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M112 160C82 100 72 56 72 22c28 12 42 46 43 96M112 160c30-60 40-104 40-138-28 12-42 46-43 96"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
