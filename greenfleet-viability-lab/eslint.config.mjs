import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "e2e/out/**"]),
  {
    // The browser checks are plain Node scripts (CommonJS), not application code.
    files: ["e2e/**/*.cjs"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
]);
