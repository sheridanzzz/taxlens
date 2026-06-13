import Link from "next/link";

type LogoProps = {
  className?: string;
  size?: "sm" | "md" | "lg";
};

const sizeMap = {
  sm: "text-[20px]",
  md: "text-[24px]",
  lg: "text-[32px]",
};

export function LedgrLogo({ className = "", size = "md" }: LogoProps) {
  return (
    <Link
      href="/"
      className={`inline-flex items-baseline font-black tracking-[-0.04em] leading-none text-foreground ${sizeMap[size]} ${className}`}
      style={{ fontFeatureSettings: '"calt" 1, "ss01" 1' }}
    >
      <span>ledgr</span>
      <span className="text-primary">.</span>
    </Link>
  );
}
