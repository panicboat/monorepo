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
    "out/**",
    "build/**",
    "next-env.d.ts",
    // protoc-gen-es output: generator emits `/* eslint-disable */` which ESLint
    // 9 flags as `Unused eslint-disable directive` since none of the rules below
    // would fire on the generated code. Easiest to exclude entirely.
    "src/stub/**",
  ]),
]);

export default eslintConfig;
