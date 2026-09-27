import Link from "next/link";

type LogoProps = {
  className?: string;
  size?: "sm" | "md" | "lg";
  href?: string;
  /** butter sticker with a tangerine shadow, for plum backgrounds */
  onDark?: boolean;
};

const sizeMap = {
  sm: "text-lg",
  md: "text-2xl",
  lg: "text-[28px]",
};

// Logo 09 "Sticker": the wordmark on a tilted pill with a hard offset shadow.
export function LedgrLogo({
  className = "",
  size = "md",
  href = "/",
  onDark = false,
}: LogoProps) {
  return (
    <Link
      href={href}
      aria-label="Ledgr home"
      className={`inline-block -rotate-[4deg] rounded-full px-[0.36em] pb-[0.14em] pt-[0.06em] font-sans font-black leading-none tracking-[-0.05em] text-plum ${
        onDark
          ? "bg-butter shadow-[0.07em_0.07em_0_var(--color-gold)]"
          : "bg-gold shadow-[0.07em_0.07em_0_var(--color-plum)]"
      } ${sizeMap[size]} ${className}`}
    >
      ledgr
    </Link>
  );
}
