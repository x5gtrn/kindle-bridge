// @ts-check
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";
import obsidianmd from "eslint-plugin-obsidianmd";

export default tseslint.config(
  {
    ignores: ["main.js", "node_modules/**", "coverage/**", "dist/**", "src/tests/setup.ts"],
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
  eslintConfigPrettier,
);
