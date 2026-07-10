import Link from "next/link";

type LogoProps = {
  className?: string;
  size?: "sm" | "md" | "lg";
};

const sizeMap = {
  sm: "text-xl",
  md: "text-2xl",
  lg: "text-4xl",
};

export function LedgrLogo({ className = "", size = "md" }: LogoProps) {
  return (
    <Link
      href="/"
      className={`inline-flex items-baseline font-serif leading-none tracking-tight text-foreground ${sizeMap[size]} ${className}`}
    >
      <span>ledgr</span>
      <span className="text-gold">.</span>
    </Link>
  );
}
