"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  return (
    <NextThemesProvider
      attribute="class"
      forcedTheme="light"
      disableTransitionOnChange
    >
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </NextThemesProvider>
  );
};
