"use client";

import { useId, type CSSProperties } from "react";
import styles from "./savings-jar.module.css";

const GLASS = "M18 22h64a8 8 0 0 1 8 8v74a12 12 0 0 1-12 12H22a12 12 0 0 1-12-12V30a8 8 0 0 1 8-8z";
// Each pair of curves repeats every 80 units, so the loop has no visible seam.
const WAVE = "M-80 0q20-6 40 0t40 0t40 0t40 0t40 0t40 0v120H-80z";

export const SavingsJar = ({ fill }: { fill: number }) => {
  const clipId = useId();
  // Keep the existing fill level tied to financial-year progress.
  const top = 114 - Math.round(56 * Math.min(1, Math.max(0.15, fill)));
  const bubbles = { "--rise": `${Math.min(-8, top - 108)}px` } as CSSProperties;

  return (
    <svg width="96" height="116" viewBox="0 0 100 120" aria-hidden="true" className="hidden shrink-0 sm:block">
      <defs>
        <clipPath id={clipId}>
          <rect x="12" y="24" width="76" height="90" rx="10" />
        </clipPath>
      </defs>
      <rect x="26" y="4" width="48" height="12" rx="4" fill="var(--color-gold)" />
      <path d={GLASS} fill="rgb(255 255 255 / 0.12)" />
      <g clipPath={`url(#${clipId})`}>
        <g transform={`translate(0 ${top - 2})`} opacity="0.4">
          <path d={WAVE} fill="var(--color-butter)" className={`${styles.wave} ${styles.backWave}`} />
        </g>
        <g transform={`translate(0 ${top})`}>
          <path d={WAVE} fill="var(--color-butter)" className={styles.wave} />
        </g>
        <g style={bubbles} fill="none" stroke="#fff4c7" strokeWidth="1.2">
          <circle cx="23" cy="109" r="1.8" className={styles.bubble} />
          <circle cx="49" cy="108" r="2.2" className={`${styles.bubble} ${styles.bubbleMiddle}`} />
          <circle cx="75" cy="110" r="1.5" className={`${styles.bubble} ${styles.bubbleLast}`} />
        </g>
        <g className={styles.coin}>
          <g className={styles.coinFace}>
            <circle cx="34" cy="100" r="6" fill="#f2b63c" />
            <path d="M31 98a3.5 3.5 0 0 1 3-1.5" fill="none" stroke="#ffe69b" strokeWidth="1.3" strokeLinecap="round" />
          </g>
        </g>
        <g className={`${styles.coin} ${styles.coinLast}`}>
          <g className={`${styles.coinFace} ${styles.coinFaceLast}`}>
            <circle cx="60" cy="94" r="6" fill="#f2b63c" />
            <path d="M57 92a3.5 3.5 0 0 1 3-1.5" fill="none" stroke="#ffe69b" strokeWidth="1.3" strokeLinecap="round" />
          </g>
        </g>
      </g>
      <path d={GLASS} fill="none" stroke="#fff" strokeWidth="3" />
    </svg>
  );
};
