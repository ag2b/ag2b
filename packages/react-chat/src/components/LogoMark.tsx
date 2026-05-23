type LogoMarkProps = {
  size?: number;
  blink?: boolean;
  className?: string;
};

export const LogoMark = ({ size = 22, blink = true, className }: LogoMarkProps) => (
  <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden>
    <path
      d="M 18 22 L 30 32 L 18 42"
      fill="none"
      stroke="currentColor"
      strokeWidth={6}
      strokeLinejoin="round"
      strokeLinecap="round"
    />
    <rect x={38} y={36} width={15} height={8} rx={2} ry={2} style={{ fill: 'var(--ag2b-accent)' }}>
      {blink ? (
        <animate
          attributeName="opacity"
          values="1;1;0;0"
          keyTimes="0;0.55;0.6;1"
          dur="1.1s"
          repeatCount="indefinite"
        />
      ) : null}
    </rect>
  </svg>
);
