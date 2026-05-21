export function LogoMark({
  size = 22,
  blink = true,
  className,
}: {
  size?: number;
  blink?: boolean;
  className?: string;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden>
      <path
        d="M 18 22 L 30 32 L 18 42"
        fill="none"
        stroke="currentColor"
        strokeWidth={6}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <rect x={38} y={36} width={15} height={8} rx={2} ry={2} className="fill-fd-primary">
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
}

export function Logo() {
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark size={22} />
      <span
        style={{
          fontWeight: 600,
          fontSize: '12px',
          lineHeight: 1,
        }}
      >
        AG
        <span className="text-fd-primary">2</span>B
      </span>
    </span>
  );
}
