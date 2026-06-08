export default function NebulaLogo({ size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="nlg1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#44d4ff" />
          <stop offset="100%" stopColor="#0044cc" />
        </linearGradient>
        <linearGradient id="nlg2" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#00aaff" />
          <stop offset="100%" stopColor="#0066ff" />
        </linearGradient>
        <filter id="nglow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.5" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {/* Planet body */}
      <circle cx="24" cy="24" r="9" fill="url(#nlg2)" filter="url(#nglow)" opacity="0.9" />
      {/* Ring */}
      <ellipse cx="24" cy="24" rx="20" ry="7"
        stroke="url(#nlg1)" strokeWidth="2.2" fill="none"
        filter="url(#nglow)" />
      {/* Stars */}
      <circle cx="7"  cy="9"  r="1.4" fill="#44d4ff" filter="url(#nglow)" />
      <circle cx="41" cy="7"  r="1"   fill="#00aaff" filter="url(#nglow)" />
      <circle cx="43" cy="38" r="1.4" fill="#44d4ff" filter="url(#nglow)" />
      <circle cx="5"  cy="39" r="1"   fill="#00aaff" filter="url(#nglow)" />
      <circle cx="39" cy="16" r="0.8" fill="#44d4ff" filter="url(#nglow)" />
    </svg>
  );
}
