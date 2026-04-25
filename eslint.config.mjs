import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  globalIgnores([
    "*.config.mjs",
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "next-env.d.ts"
  ]),
  ...nextVitals,
  ...nextTypescript,
  {
    files: ["**/*.cjs"],
    rules: {
      "@typescript-eslint/no-require-imports": "off"
    }
  }
]);
