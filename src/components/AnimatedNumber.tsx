"use client";

import { useEffect, useRef } from "react";
import { motion, useMotionValue, useTransform, animate, useReducedMotion } from "motion/react";

type AnimatedNumberProps = {
  value: number;
  format?: "currency" | "number";
  className?: string;
};

export const AnimatedNumber = ({
  value,
  format = "currency",
  className = "",
}: AnimatedNumberProps) => {
  const prefersReduced = useReducedMotion();
  const mv = useMotionValue(0);
  const prevValue = useRef(0);

  const display = useTransform(mv, (v) =>
    format === "currency"
      ? `$${Math.abs(Math.round(v)).toLocaleString()}`
      : Math.round(v).toLocaleString()
  );

  useEffect(() => {
    if (prefersReduced) {
      mv.set(value);
      return;
    }

    const controls = animate(mv, value, {
      duration: 1.2,
      ease: [0.25, 0.46, 0.45, 0.94],
    });
    prevValue.current = value;
    return controls.stop;
  }, [value, mv, prefersReduced]);

  return <motion.span className={className}>{display}</motion.span>;
};
