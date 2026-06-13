export const TaxLensLogo = ({ size = 32, className = "" }: { size?: number; className?: string }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path d="M32 4L58 18V46L32 60L6 46V18L32 4Z" fill="#163300" />
      <path d="M32 14L48 23V41L32 50L16 41V23L32 14Z" stroke="#9FE870" strokeWidth="1.5" fill="none" />
      <path d="M32 24L40 29V39L32 44L24 39V29L32 24Z" fill="#9FE870" />
    </svg>
  );
};

export const TaxLensWordmark = ({ className = "" }: { className?: string }) => {
  return (
    <svg
      viewBox="0 0 220 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ height: 32, width: "auto" }}
      aria-label="TaxLens"
      role="img"
    >
      <path d="M32 4L58 18V46L32 60L6 46V18L32 4Z" fill="#163300" />
      <path d="M32 14L48 23V41L32 50L16 41V23L32 14Z" stroke="#9FE870" strokeWidth="1.5" fill="none" />
      <path d="M32 24L40 29V39L32 44L24 39V29L32 24Z" fill="#9FE870" />
      <text
        x="72"
        y="38"
        fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        fontSize="26"
        fontWeight="500"
        letterSpacing="-0.5"
        fill="currentColor"
      >
        TaxLens
      </text>
    </svg>
  );
};

export const TaxLensLogoDark = ({ size = 32, className = "" }: { size?: number; className?: string }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path d="M32 4L58 18V46L32 60L6 46V18L32 4Z" fill="#9FE870" opacity="0.15" />
      <path d="M32 14L48 23V41L32 50L16 41V23L32 14Z" stroke="#9FE870" strokeWidth="1.5" fill="none" />
      <path d="M32 24L40 29V39L32 44L24 39V29L32 24Z" fill="#9FE870" />
    </svg>
  );
};
