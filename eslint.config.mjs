import tsParser from "@typescript-eslint/parser"
import tsPlugin from "@typescript-eslint/eslint-plugin"
import reactPlugin from "eslint-plugin-react"
import reactHooksPlugin from "eslint-plugin-react-hooks"

// Files intentionally kept English-only.
//   - `app/[locale]/docs/**` - developer API docs (endpoints, cURL examples).
//   - `app/[locale]/terms/**`, `app/[locale]/privacy/**` - legal boilerplate.
//   - `components/profile/templates/**` - public profile templates rendering
//     user-generated content and tiny hardcoded labels.
const ENGLISH_ONLY_FILES = [
  "**/docs/**",
  "**/terms/**",
  "**/privacy/**",
  "**/blog/**",
  "components/entry-flow-shell.tsx",
  "components/profile/templates/**",
  "components/profile/profile-content.tsx",
  "components/profile/profile-info-carousel.tsx",
  "components/profile/profile-send-cta.tsx",
  "components/profile/hero-cta.tsx",
  "components/profile/address-bottom-sheet.tsx",
  "components/public-chain-card.tsx",
  "components/public-chain-card-list.tsx",
  // shadcn primitives copied verbatim from the registry. The only
  // hardcoded strings in here are sr-only labels like "Close" in
  // dialog.tsx. Adding i18n context to low-level UI primitives
  // (which render in admin pages, marketing pages, and English-only
  // surfaces too) creates cascading import dependencies with no
  // corresponding UX win - screen readers localize ARIA
  // announcements on the client side, so a single English sr-only
  // label is acceptable.
  "components/ui/**",
  // Staging-only password gate. Never reaches end users in
  // production - it guards preview deploys and admin-only
  // builds. Internal-only text, English is fine.
  "**/protection/**",
  // Server-rendered OG images for profile pages. Satori templates
  // that produce PNGs for Twitter / LinkedIn / Slack previews.
  // Social crawlers don't send Accept-Language and we only have
  // one image per handle, so it's English by design.
  "**/opengraph-image.tsx",
  // Root-level 404: renders OUTSIDE any locale segment (`app/[locale]/`
  // isn't in the ancestor chain), so the `useTranslations()` context
  // isn't available. Pre-locale English is the only option here.
  "app/not-found.tsx",
]

export default [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "scripts/**",
      "public/**",
      "*.config.*",
    ],
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      react: { version: "detect" },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      "react": reactPlugin,
      "react-hooks": reactHooksPlugin,
    },
    rules: {
      // No console.log in production code (warn allows console.error/warn)
      "no-console": ["warn", { allow: ["warn", "error"] }],

      // Unused variables (ignore _prefixed and React)
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_|^React$" },
      ],

      // React hooks rules
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // No explicit any (warn, not error - too many to fix at once)
      "@typescript-eslint/no-explicit-any": "warn",

      // ─── Hardcoded JSX strings → translation miss detector ────
      //
      // Every human-readable text that ships to users must come from
      // the i18n catalog, not a hardcoded JSX literal. This rule
      // catches the class of bug that slipped through the v1.2.1
      // sweep (the `RecoveryCard` box the user screenshotted -
      // hardcoded English inside a JSX `<span>` that nothing ever
      // translated).
      //
      // Allowlist philosophy:
      //
      //   - Brand names and handle prefixes ("nimimo", "@") - not
      //     localized, not translated, and identical in every locale.
      //   - Typographic decorations (·, -, ≈, +, -, :, …, ↓, (, ), /)
      //     - punctuation and symbols that are the same in every
      //     language we support.
      //   - Short numeric patterns ("0", single characters) - dates,
      //     counters, raw state values that come through JSX as text.
      //
      // Anything else - including "OK", "Yes", "No" - MUST go through
      // `t()`, because even short words have locale-specific forms
      // and must participate in the parity check.
      //
      // `noStrings: true` also flags `{"literal"}` JSX expressions,
      // not just bare text children, so `<p>{"Hello"}</p>` is
      // caught the same as `<p>Hello</p>`.
      //
      // `ignoreProps: true` exempts prop values like
      // `className="flex"` and `data-slot="foo"` - those are CSS,
      // not user-visible text. User-visible prop values (`title=`,
      // `aria-label=`, `placeholder=`, `alt=`) are handled case-by-
      // case: we already wire most of them through `t()`, and for
      // the few that are genuinely static (e.g. `alt="nimimo logo"`)
      // we can disable the rule inline with a comment.
      "react/jsx-no-literals": ["error", {
        noStrings: true,
        ignoreProps: true,
        noAttributeStrings: false,
        allowedStrings: [
          " ",
          ".",
          ",",
          ":",
          ";",
          "·",
          "-",
          "+",
          "≈",
          "…",
          "↓",
          "?",
          "~",
          "⚠",
          "©",
          "@",
          "(",
          ")",
          "/",
          "%",
          "0",
          "1",
          "2",
          "3",
          "nimimo",
          "nimimo.",
          "$",
          "BTC",
          "ETH",
          "SOL",
          "Bitcoin",
          "Ethereum",
          "Solana",
          // "PRO" is a brand/marketing label on premium templates.
          // Kept English deliberately: it's the same token everywhere
          // (iOS, Adobe, Spotify) and translating it ("PROFI"?) hurts
          // recognition more than it helps.
          "PRO",
        ],
      }],
    },
  },
  {
    // English-only files: disable the jsx-no-literals rule.
    // See the comment next to ENGLISH_ONLY_FILES above for the
    // rationale behind each entry.
    files: ENGLISH_ONLY_FILES,
    rules: {
      "react/jsx-no-literals": "off",
    },
  },
]
