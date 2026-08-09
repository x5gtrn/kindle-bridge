// @ts-check
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";
import obsidianmd from "eslint-plugin-obsidianmd";

export default tseslint.config(
  {
    ignores: ["main.js", "node_modules/**", "coverage/**", "dist/**"],
  },
  tseslint.configs.recommendedTypeChecked,
  ...obsidianmd.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-non-null-assertion": "error",
      "obsidianmd/ui/sentence-case": [
        "warn",
        {
          brands: [
            "Kindle Bridge",
            "Kindle",
            "Amazon",
            "Obsidian",
            "Daily Note",
            "Daily Notes",
            "Markdown",
          ],
          // Literal default values/format tokens shown as placeholders, not
          // prose - moment.js format tokens and the default output folder
          // name are case-sensitive/meaningful and must not be sentence-cased.
          ignoreRegex: ["^YYYY-MM-DD$", "^Highlight and Note/Books$"],
        },
      ],
    },
  },
  {
    // These files' setTimeout/clearTimeout calls gate promises around
    // external child-process/CDP events (browser launch, sign-in
    // timeout, generic sleep helpers) - none are attached to any DOM
    // element or window-scoped UI state, so Obsidian's popout-window
    // guidance doesn't apply to them. Switching to window.setTimeout
    // would also break their unit tests, which run under Vitest's
    // "node" environment (see vitest.config.mts), where `window` is
    // not defined.
    files: [
      "src/amazon/AmazonAuthService.ts",
      "src/amazon/KindleReaderClient.ts",
      "src/amazon/cdp/CdpBrowser.ts",
      "src/utils/retry.ts",
      "src/utils/retry.spec.ts",
      "src/utils/timeout.ts",
    ],
    rules: {
      "obsidianmd/prefer-window-timers": "off",
    },
  },
  eslintConfigPrettier,
);
