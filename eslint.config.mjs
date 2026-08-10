// eslint.config.mjs
import tsparser from "@typescript-eslint/parser";
import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";

export default defineConfig([
  {
    ignores: ["main.js", "node_modules/**", "dist/**", "*.js", "scripts/**", ".ref/**"]
  },
  // The obsidianmd recommended rules need type info, so scope the rule-bearing
  // configs to TypeScript sources. Objects that only register the plugin must be
  // left unscoped, otherwise rules applied to other file types cannot resolve the
  // plugin and ESLint fails to start.
  ...obsidianmd.configs.recommended.map((config) =>
    config.rules ? { ...config, files: config.files ?? ["**/*.ts"] } : config,
  ),
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: { 
        project: "./tsconfig.json",
        sourceType: "module"
      },
      globals: {
        ...globals.browser,
        DomElementInfo: "readonly",
        SvgElementInfo: "readonly",
        activeDocument: "readonly",
        activeWindow: "readonly",
        ajax: "readonly",
        ajaxPromise: "readonly",
        createDiv: "readonly",
        createEl: "readonly",
        createFragment: "readonly",
        createSpan: "readonly",
        createSvg: "readonly",
        fish: "readonly",
        fishAll: "readonly",
        isBoolean: "readonly",
        nextFrame: "readonly",
        ready: "readonly",
        sleep: "readonly"
      }
    },
    // Custom rule overrides
    rules: {
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-empty-function": "off",
      "no-prototype-builtins": "off",
      "@typescript-eslint/no-misused-promises": ["error",{"checksVoidReturn":{"attributes":false,"properties":false,"returns":false,"variables":false}}],
      // Disable sample code rules for template repository
      // These are intentional placeholder names and sample code that users should customize
      "obsidianmd/sample-names": "off",
      "obsidianmd/no-sample-code": "off",
      // Console rules: Match Obsidian bot requirements (only warn/error/debug allowed)
      "no-console": ["error", { "allow": ["warn", "error", "debug"] }],
      // Require await in async functions (matches Obsidian bot)
      "@typescript-eslint/require-await": "error",
      // The community scorecard reports the no-unsafe-* family when it analyses
      // this repo, so keep them enabled here to catch any genuine `any` leaks
      // locally before a release rather than after one.
      "@typescript-eslint/no-unsafe-member-access": "warn",
      "@typescript-eslint/no-unsafe-call": "warn",
      "@typescript-eslint/no-unsafe-assignment": "warn",
      "@typescript-eslint/no-unsafe-argument": "warn",
      "@typescript-eslint/no-unsafe-return": "warn",
      // Allow domain-specific acronyms and HTML heading levels in UI strings.
      // Ignore text inside double quotes (these are quoted button/control names
      // referenced inside descriptions, which keep their own casing).
      "obsidianmd/ui/sentence-case": ["error", {
        acronyms: ["SEO", "MDX", "H1", "H2", "H3", "H4", "H5", "H6", "URL", "CSV"],
        ignoreRegex: ['"[^"]+"'],
      }],
    },
  },
  {
    files: ["**/*.mjs"],
    languageOptions: {
      globals: {
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
        __filename: "readonly"
      }
    },
    // Build tooling (esbuild config, version bump) runs in Node, not inside the
    // plugin sandbox, so the mobile-compatibility and console restrictions that
    // apply to plugin source are not relevant here. The community scorecard
    // scans plugin source only and does not flag these files either.
    rules: {
      "obsidianmd/no-nodejs-modules": "off",
      "obsidianmd/rule-custom-message": "off",
      "no-console": "off"
    }
  },
]);
