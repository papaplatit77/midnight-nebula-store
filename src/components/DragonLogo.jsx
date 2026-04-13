export default function DragonLogo({ size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="pg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#b300ff" />
          <stop offset="100%" stopColor="#7c00d4" />
        </linearGradient>
        <linearGradient id="pg2" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#d966ff" />
          <stop offset="100%" stopColor="#b300ff" />
        </linearGradient>
        <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="2" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {/* Neon W shape */}
      <path
        d="M6 10 L12 36 L24 18 L36 36 L42 10"
        stroke="url(#pg2)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        filter="url(#glow)"
      />
      <path
        d="M6 10 L12 36 L24 18 L36 36 L42 10"
        stroke="url(#pg)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Glow dots at tips */}
      <circle cx="6" cy="10" r="2" fill="#d966ff" filter="url(#glow)" />
      <circle cx="42" cy="10" r="2" fill="#d966ff" filter="url(#glow)" />
      <circle cx="24" cy="18" r="2" fill="#b300ff" filter="url(#glow)" />
    </svg>
  );
}
