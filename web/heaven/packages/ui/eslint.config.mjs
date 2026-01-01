import tseslint from "typescript-eslint";

export default tseslint.config(
  ...tseslint.configs.recommended,
  {
    ignores: ["dist/**", "node_modules/**"],
  },
  {
    rules: {
      "no-console": "warn",
      "@typescript-eslint/no-unused-vars": "warn",
    },
  }
);
