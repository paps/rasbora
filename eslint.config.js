import eslintReact from "@eslint-react/eslint-plugin";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import reactRefreshPlugin from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: ["dist", "*.js"],
  },
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  // Replaces eslint-plugin-react, which crashes on ESLint 10 and has not
  // shipped since 2025-04. Provides the component/JSX rules TypeScript cannot
  // check, most importantly no-missing-key.
  eslintReact.configs["recommended-typescript"],
  reactHooksPlugin.configs.flat["recommended-latest"],
  {
    // Hooks are owned by eslint-plugin-react-hooks (maintained by the React
    // team, and the source of the React Compiler rules). Turn off the
    // @eslint-react equivalents so these are not reported twice.
    rules: {
      "@eslint-react/error-boundaries": "off",
      "@eslint-react/exhaustive-deps": "off",
      "@eslint-react/purity": "off",
      "@eslint-react/rules-of-hooks": "off",
      "@eslint-react/set-state-in-effect": "off",
      "@eslint-react/set-state-in-render": "off",
      "@eslint-react/static-components": "off",
      "@eslint-react/unsupported-syntax": "off",
      "@eslint-react/use-memo": "off",
    },
  },
  // No preset enables react-refresh/only-export-components, so this line is
  // what switches it on. The "vite" variant allows constant exports, which
  // Vite's fast refresh handles fine.
  reactRefreshPlugin.configs.vite,
  {
    languageOptions: {
      parserOptions: {
        // Required to make typescript-eslint read the nearest tsconfig.json in
        // order for the type-aware rules to work.
        projectService: true,
      },
    },
  },
];
