#!/usr/bin/env node
/**
 * i18n catalog validator.
 *
 * Runs in three phases:
 *
 *   1. Parity — every required key in the default locale catalog
 *      (en.json) must exist in every other locale's catalog, scoped
 *      to the coverage model declared in `i18n/coverage.json`.
 *      German is `full` (must match every key). Chinese is `partial`
 *      (must match the declared subset of namespaces). Keys outside
 *      a partial locale's scope fall through to the default locale
 *      via the deep-merge in `i18n/request.ts`, so they don't need
 *      to be present in the partial locale's catalog — but if they
 *      ARE, they must exist in en.json (no orphans).
 *
 *   2. Missing references — every translation key referenced in the
 *      source tree via a known translator binding must exist in
 *      en.json under the namespace that binding was declared with.
 *      Binding extraction works on these shapes:
 *
 *        const t = useTranslations("namespace.sub")
 *        const t = await getTranslations({namespace: "namespace"})
 *        const t = await getTranslations({locale, namespace: "namespace"})
 *
 *      Any `foo("literal")` call where `foo` isn't a known binding
 *      is ignored. That's how we avoid false positives from
 *      `logger("app")`, `toast({title: "…"})`, `cn("foo bar")`, etc.
 *
 *   3. Unused keys — any key in en.json that isn't referenced from
 *      any source file is reported as a warning. Not an error,
 *      because dynamic keys (e.g. `t(\`stage.${name}\`)`) are
 *      undetectable by static regex scan. If a whole namespace goes
 *      unused, that's still signal worth surfacing.
 *
 * Exits 1 on parity or missing-reference failures.
 * Exits 0 with warnings on unused keys.
 *
 * Hooked into `pnpm lint`, so CI catches drift on every PR.
 *
 * Design notes:
 *
 * - Flatten dot-paths instead of comparing tree shapes, because the
 *   "missing keys" failure we care about is always "specific leaf
 *   is absent", not "intermediate node has wrong shape".
 * - Binding extraction is per-file and intentionally simple: one
 *   regex pass collects declarations, a second pass collects calls
 *   that use those declared identifiers. No AST, no TypeScript
 *   compilation — this runs in ~200ms on the whole repo. The
 *   tradeoff is that uncommon shapes (destructured bindings,
 *   reassigned bindings, bindings from custom hooks) are invisible
 *   to the scanner and those keys show up in the unused warning.
 * - Dynamic keys (`t(someVar)`, `t(\`foo.${bar}\`)`) are silently
 *   ignored by the scanner. The script prints how many it skipped
 *   so you know the static analysis isn't complete.
 */

const fs = require("fs")
const path = require("path")

const REPO_ROOT = path.join(__dirname, "..")
const MESSAGES_DIR = path.join(REPO_ROOT, "messages")
const COVERAGE_PATH = path.join(REPO_ROOT, "i18n", "coverage.json")
const SOURCE_ROOTS = ["app", "components", "lib", "i18n"]
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"])

// ──────────────────────────────────────────────────────────────────
// Load coverage config
// ──────────────────────────────────────────────────────────────────

const coverage = JSON.parse(fs.readFileSync(COVERAGE_PATH, "utf8"))
const defaultLocale = coverage.defaultLocale
const locales = Object.keys(coverage.locales)

// ──────────────────────────────────────────────────────────────────
// Load and flatten catalogs
// ──────────────────────────────────────────────────────────────────

/**
 * Flatten a nested object into dot-path keys:
 *   {a: {b: "x"}, c: "y"}  →  {"a.b": "x", "c": "y"}
 *
 * Arrays are kept as leaves. Top-level keys starting with `_` are
 * treated as comments and skipped (lets us put `_comment` in
 * coverage.json and similar).
 */
function flatten(obj, prefix = "") {
  const out = {}
  for (const [key, value] of Object.entries(obj)) {
    if (key.startsWith("_")) continue
    const next = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(out, flatten(value, next))
    } else {
      out[next] = value
    }
  }
  return out
}

const flatCatalogs = {}
for (const locale of locales) {
  const filePath = path.join(MESSAGES_DIR, `${locale}.json`)
  if (!fs.existsSync(filePath)) {
    console.error(`✖ Missing catalog: messages/${locale}.json`)
    process.exit(1)
  }
  flatCatalogs[locale] = flatten(JSON.parse(fs.readFileSync(filePath, "utf8")))
}

const defaultKeys = new Set(Object.keys(flatCatalogs[defaultLocale]))

// ──────────────────────────────────────────────────────────────────
// Phase 1 — Parity check
// ──────────────────────────────────────────────────────────────────

function requiredKeysFor(localeName) {
  const spec = coverage.locales[localeName]
  if (!spec) return new Set()
  if (spec.coverage === "full") return defaultKeys
  if (spec.coverage === "partial") {
    const namespaces = spec.namespaces || []
    const required = new Set()
    for (const key of defaultKeys) {
      const topLevel = key.split(".")[0]
      if (namespaces.includes(topLevel)) required.add(key)
    }
    return required
  }
  throw new Error(`Unknown coverage type "${spec.coverage}" for locale "${localeName}"`)
}

const parityErrors = []
for (const locale of locales) {
  if (locale === defaultLocale) continue

  const required = requiredKeysFor(locale)
  const present = new Set(Object.keys(flatCatalogs[locale]))

  const missing = [...required].filter((key) => !present.has(key))
  if (missing.length > 0) {
    parityErrors.push({ locale, kind: "missing", count: missing.length, keys: missing })
  }

  const orphans = [...present].filter((key) => !defaultKeys.has(key))
  if (orphans.length > 0) {
    parityErrors.push({ locale, kind: "orphan", count: orphans.length, keys: orphans })
  }
}

// ──────────────────────────────────────────────────────────────────
// Phase 2 — Source scan
// ──────────────────────────────────────────────────────────────────

function collectSourceFiles(root) {
  const results = []
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue
      if (entry.name === "node_modules" || entry.name === ".next" || entry.name === "dist" || entry.name === "build") {
        continue
      }
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(full)
      } else if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
        results.push(full)
      }
    }
  }
  walk(root)
  return results
}

const sourceFiles = []
for (const rel of SOURCE_ROOTS) {
  const root = path.join(REPO_ROOT, rel)
  if (fs.existsSync(root)) sourceFiles.push(...collectSourceFiles(root))
}

// Match `const <ident> = useTranslations("ns")` and its server
// counterparts `getTranslations("ns")` / `getTranslations({namespace: "ns"})`.
// Binding name is captured separately from the namespace literal.
const BINDING_RES = [
  // `const t = useTranslations("namespace")`
  /\bconst\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*useTranslations\s*\(\s*["']([^"']+)["']\s*\)/g,
  // `const t = await getTranslations("namespace")`
  /\bconst\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:await\s+)?getTranslations\s*\(\s*["']([^"']+)["']\s*\)/g,
  // `const t = await getTranslations({namespace: "namespace"})`
  // (we allow any prop ordering inside the object)
  /\bconst\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:await\s+)?getTranslations\s*\(\s*\{[^}]*?namespace\s*:\s*["']([^"']+)["']/g,
]

const referencedKeys = new Set()
let dynamicCallCount = 0
const missingRefs = []

for (const file of sourceFiles) {
  const rel = path.relative(REPO_ROOT, file)
  const content = fs.readFileSync(file, "utf8")

  // bindings: Map<identifier, Set<namespace>>
  //
  // Multi-valued on purpose: a single source file can declare
  // `const t = useTranslations("X")` in one function and
  // `const t = useTranslations("Y")` in another (this happens in
  // `app/[locale]/page.tsx` where the landing page and its nested
  // `<TemplateCarousel />` both use `t`). We track every namespace
  // each identifier was bound to, and consider a call valid if the
  // key exists under AT LEAST ONE of those namespaces. This
  // over-approximates "used" keys (and thus under-reports unused
  // ones in the rare multi-binding case) but never false-alarms on
  // "missing" — which is the direction that matters.
  const bindings = new Map()
  function addBinding(ident, namespace) {
    if (!bindings.has(ident)) bindings.set(ident, new Set())
    bindings.get(ident).add(namespace)
  }
  for (const re of BINDING_RES) {
    re.lastIndex = 0
    let m
    while ((m = re.exec(content)) !== null) {
      addBinding(m[1], m[2])
    }
  }

  if (bindings.size === 0) continue

  // Count dynamic calls on known bindings, for reporting.
  for (const ident of bindings.keys()) {
    const dynRe = new RegExp(
      `\\b${ident}(?:\\.rich)?\\s*\\(\\s*\`[^\`]*\\$\\{`,
      "g",
    )
    const matches = content.match(dynRe)
    if (matches) dynamicCallCount += matches.length
  }

  // Resolve every literal call. For each binding identifier, find
  // all its calls and check the key against every namespace the
  // identifier was bound to.
  for (const [ident, namespaces] of bindings.entries()) {
    const safeIdent = ident.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const callRe = new RegExp(
      `\\b${safeIdent}(?:\\.rich)?\\s*\\(\\s*["']([^"']+)["']`,
      "g",
    )
    let m
    while ((m = callRe.exec(content)) !== null) {
      const key = m[1]
      if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)*$/.test(key)) continue

      const candidates = [...namespaces].map((ns) => `${ns}.${key}`)
      const matched = candidates.filter((full) => defaultKeys.has(full))
      if (matched.length > 0) {
        // Mark every matching candidate as used. Over-approximation
        // is fine here — see the comment on `bindings` above.
        for (const full of matched) referencedKeys.add(full)
      } else {
        missingRefs.push({
          file: rel,
          binding: ident,
          namespaces: [...namespaces],
          key,
          candidates,
        })
      }
    }
  }
}

// ──────────────────────────────────────────────────────────────────
// Phase 3 — Unused keys
// ──────────────────────────────────────────────────────────────────

// An allowlist for keys the static scanner can't see. Kept small
// and commented — every entry is a deliberate "we know this is
// used, the scanner just can't prove it" claim.
// Allowlist kept as regex patterns so we can express both
// "whole subtree" (e.g. `contactForm.topics.*`) and "keys starting
// with a shared stem" (e.g. `install.iphone.step1`, `…step2`, …).
const UNUSED_ALLOWLIST_PATTERNS = [
  // PIN variants in the recovery PDF. The current UI always uses
  // "password", but the PDF generator and the JSON catalog keep
  // PIN-shaped keys on hand so we don't have to re-translate when
  // the PIN option comes back. Not referenced today — keep anyway.
  /^recovery\.pdf\.securedWithPin$/,
  /^recovery\.pdf\.yourPin$/,
  /^recovery\.pdf\.instruction3Pin$/,
  /^recovery\.pdf\.securityNotice2Pin$/,

  // Contact form topic labels are resolved via dynamic interpolation:
  //   t(`topics.${key}`) where key comes from a const tuple.
  // The scanner can't see this binding, but the labels are exercised
  // on every contact form render.
  /^contactForm\.topics\./,

  // Install page step copy is rendered via a map over an array of
  // step identifiers with `t.rich(\`iphone.step${n}\`, ...)` /
  // `t.rich(\`desktop.step${n}\`, ...)` — dynamic interpolation again.
  /^install\.(?:iphone|desktop)\.step\d+$/,

]

const unusedKeys = [...defaultKeys].filter((key) => {
  if (referencedKeys.has(key)) return false
  return !UNUSED_ALLOWLIST_PATTERNS.some((pat) => pat.test(key))
})

// ──────────────────────────────────────────────────────────────────
// Report
// ──────────────────────────────────────────────────────────────────

let hasErrors = false

function formatKeyList(keys, limit = 20) {
  if (keys.length <= limit) return keys.map((k) => `    - ${k}`).join("\n")
  const shown = keys.slice(0, limit).map((k) => `    - ${k}`).join("\n")
  return `${shown}\n    … and ${keys.length - limit} more`
}

if (parityErrors.length > 0) {
  hasErrors = true
  console.error("\n✖ Parity errors:\n")
  for (const err of parityErrors) {
    const verb = err.kind === "missing" ? "missing from" : "orphaned in"
    console.error(`  [ERROR] ${err.count} key(s) ${verb} messages/${err.locale}.json:`)
    console.error(formatKeyList(err.keys))
    console.error("")
  }
}

if (missingRefs.length > 0) {
  hasErrors = true
  console.error("✖ Missing references (code uses keys not in default catalog):\n")
  for (const ref of missingRefs.slice(0, 20)) {
    console.error(`  - ${ref.file}`)
    console.error(`      ${ref.binding}("${ref.key}") — not found in ${ref.namespaces.join(" or ")}`)
    console.error(`      tried: ${ref.candidates.join(", ")}`)
  }
  if (missingRefs.length > 20) {
    console.error(`  … and ${missingRefs.length - 20} more`)
  }
  console.error("")
}

if (unusedKeys.length > 0) {
  console.warn(`⚠ ${unusedKeys.length} key(s) in messages/${defaultLocale}.json appear unused:`)
  console.warn(formatKeyList(unusedKeys, 30))
  console.warn("")
  console.warn("  (Keys referenced via dynamic interpolation like `t(`foo.${x}`)`")
  console.warn("  or through non-standard binding shapes can't be detected by")
  console.warn("  the static scanner and may appear here. Add to the allowlist")
  console.warn("  at the top of scripts/i18n-check.js if a warning is spurious.)")
  console.warn("")
}

if (hasErrors) {
  console.error("i18n check FAILED")
  process.exit(1)
}

const requiredCounts = locales.map((l) => `${l}=${requiredKeysFor(l).size}`)
console.log(
  `✓ i18n check passed: ${defaultKeys.size} keys in ${defaultLocale}, ` +
    `locale requirements [${requiredCounts.join(", ")}], ` +
    `${referencedKeys.size} referenced keys, ` +
    `${dynamicCallCount} dynamic calls skipped, ` +
    `${unusedKeys.length} unused warnings`,
)
