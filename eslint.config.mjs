import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: ["node_modules/**", "coverage/**", "logs/**"],
  },
  js.configs.recommended,
  // typescript-eslint's recommended configs carry no `files` restriction on
  // their own, so they'd otherwise apply to every file, including the
  // CommonJS .js sources that make up the whole server today. Scope them to
  // .ts/.tsx so they're inert now and ready once TypeScript files land.
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ["**/*.ts", "**/*.tsx"],
  })),
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
];
