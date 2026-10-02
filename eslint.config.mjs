import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".check/**",
    ".playwright-cli/**",
    "output/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "public/pdf.worker.min.mjs",
    // the Expo app lints and type-checks on its own
    "mobile/**",
  ]),
]);

export default eslintConfig;
