import type { Variants, Transition, TargetAndTransition } from "motion/react";

export const fadeInUp = {
  initial: { opacity: 0, y: 20 } as TargetAndTransition,
  animate: { opacity: 1, y: 0 } as TargetAndTransition,
  transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] } as Transition,
};

export const staggerContainer: Variants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.08 } },
};

export const staggerItem: Variants = {
  initial: { opacity: 0, y: 16 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: "easeOut" },
  },
};

export const scaleOnHover = {
  whileHover: { scale: 1.03, transition: { duration: 0.2 } },
  whileTap: { scale: 0.97 },
};

export const cardHover = {
  whileHover: {
    y: -2,
    boxShadow: "0 8px 30px rgba(14,15,12,0.08)",
    transition: { duration: 0.2 },
  },
};

export const slideInRight = {
  initial: { x: "100%" as const },
  animate: { x: 0 },
  exit: { x: "100%" as const },
  transition: { type: "spring" as const, damping: 25, stiffness: 200 },
};

export const countUp = {
  initial: { opacity: 0, scale: 0.8 },
  animate: { opacity: 1, scale: 1 },
  transition: { type: "spring" as const, stiffness: 200, damping: 20 },
};
