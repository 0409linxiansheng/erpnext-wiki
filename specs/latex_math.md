# LaTeX Math in Wiki Documents

> **Superseded on 2026-10-12** by [`alexandrie_port/01-editor-math-and-containers.md`](alexandrie_port/01-editor-math-and-containers.md), the spec that was actually built (it carries the reconciliation log).
> Kept as the historical P1 note; the route and the P1-P4 item list now live in [`alexandrie_port/README.md`](alexandrie_port/README.md).


Date: 2026-10-12
Status: **Spec — not started.** This is **P1 item 1** of the Alexandrie feature-port program (see [Program context](#program-context)). The closest in-repo precedent is [specs/mermaid_diagrams.md](mermaid_diagrams.md) — a custom editor block with a fenced/source round-trip plus client-side hydration on the server-rendered public reader. Almost every structural lesson below is inherited from it.

## Goal

Let authors write LaTeX math in a wiki page — **inline** (`$E = mc^2$`) and **display** (`$$ ... $$`) — and see it rendered as typeset math **live in the editor** and on the **public** (server-rendered) reader. The source stays plain, portable Markdown: no backend schema change, no separate asset, no upload.

## Program context

The user is porting the feature set of **Alexandrie** (a Go + Nuxt wiki product) into `apps/wiki`, chosen route: **逐项移植** (port feature by feature), not a wholesale rewrite. This spec covers only the first item. Remaining items (each gets its own spec):

- **P1 — editor & authoring:** ~~LaTeX math~~ (this spec) → container variants (info/warning/danger/tip) → speech-to-text → Snippet manager → in-editor chart editing
- **P2 — search & navigation:** relevance/snippet ranking calibration → Ctrl+K cross-space actions → Kanban task board
- **P3 — permissions & org:** page-level ACL DocType → 5-level mapping (None/Read/Write/Admin/Owner) → tree inheritance
- **P4 — storage & portability:** S3 backend → media preview formats → space-level ZIP export/import

Explicitly **not** ported: single-instance multi-tenancy and a self-built offline sync engine (upstream already has a local-first route).

## Decisions

- **Markdown representation → `$...$` (inline) and `$$ ... $$` (display).** This is the de-facto standard (GitHub, Obsidian, GitLab, KaTeX auto-render, Pandoc), so content stays portable and copy-pasteable, and it round-trips in Markdown. **No backend schema change** — math lives inline in the existing `Wiki Document.content` field.
- **Rendering engine → KaTeX, not MathJax.** KaTeX renders synchronously (no async reflow / layout shift as MathJax does), is small, and its output is plain HTML+CSS+web fonts, which fits our client-side hydration model. MathJax's advantage (full TeX package support) is out of scope for v1.
- **Public reader → client-side, lazy, gated.** KaTeX is loaded **only on pages that actually contain math** (mirroring the Mermaid gate), and only after the reader HTML is server-rendered. No server-side render, no headless browser.
- **Editor → live preview.** Typing in the math source updates the rendered preview (debounced), with inline error feedback for invalid TeX.
- **Escaping / false positives → strict delimiters.** An opening `$` must be immediately followed by a non-space and the closing `$` immediately preceded by a non-space (the `dollarmath` "allow_space = false" convention), so prose like "costs $5 and $10" does not become math. `\$` is the documented escape for a literal dollar sign.
- **Security → `trust: false`.** KaTeX's `trust` option is left **off** (its default), which disables `\href`, `\htmlClass`, `\includegraphics` and friends. Math source is untrusted user content — this is the single most important security decision, see [Security](#security).

## Library choice

- **Editor: [`@tiptap/extension-mathematics`](https://tiptap.dev/docs/editor/extensions/functionality/mathematics) v3.29.x + `katex` (npm).** It is the official Tiptap 3 math extension, matched to the exact `@tiptap/*` version already pinned in this repo (3.29.2), and it already ships `InlineMath` / `BlockMath` nodes with KaTeX rendering, input rules and commands. Backed by `katex`.
- **Public reader: vendored KaTeX UMD** into `wiki/public/js/vendor/katex/` (`katex.min.js`, `katex.min.css`, `fonts/*`), loaded lazily by a new `katex-loader.js` — the **exact** arrangement `mermaid-loader.js` / `vendor/mermaid/` already uses. KaTeX's CSS **and its font files** must be vendored together (KaTeX renders with web fonts; without them formulas render as boxes).
- **Backend: [`mdit_py_plugins.dollarmath`](https://mdit-py-plugins.readthedocs.io/en/latest/#dollarmath)** — already available, since `pyproject.toml` declares `mdit-py-plugins>=0.4` and `markdown.py` already imports `footnote_plugin` / `tasklists_plugin` from the same package. It tokenizes `$...$` / `$$...$$` into `math_inline` / `math_block` tokens; we add renderer rules for those tokens.

Note the editor and public copies of KaTeX are **independent** (editor: Vite-bundled from `node_modules`; public: vendored file) — same split as `pdfjs-dist` vs `vendor/pdfjs/`, and mermaid's editor/public arrangement.

Sources: [KaTeX](https://katex.org/) · [KaTeX options / `trust`](https://katex.org/docs/options) · [Tiptap Mathematics](https://tiptap.dev/docs/editor/extensions/functionality/mathematics)

## Current Wiki State (what we build on)

- **Editor:** Tiptap v3.29.2, Vue 3, ProseMirror, `format: 'markdown'` (`@tiptap/markdown`). Custom extensions live in `frontend/src/components/tiptap-extensions/` and register in the `extensions: [...]` array of `frontend/src/components/WikiEditor.vue` (array starts ~L782; custom blocks at ~L823–829). **`mermaid-block.js` + `MermaidBlockView.vue` + `mermaid-markdown.js` are the direct template** for a new custom node with source round-trip.
- **Markdown round-trip** is per-node via `markdownTokenizer` / `parseMarkdown` / `renderMarkdown`, with `canonicalizeMarkdown` (markdown-normalize.js) and `PreserveBlankLines` normalizing stability on save.
- **Public reader is server-rendered Jinja + markdown-it-py + Alpine.js — NOT Vue.** `wiki/wiki/markdown.py` builds the `MarkdownIt("commonmark", ...)` instance (~L505), enables `table`/`strikethrough`, `.use(footnote_plugin)`, `.use(tasklists_plugin)`, and installs `renderer.rules["fence"] = fence_rstrip` (L532). `_render_codeblock_html` (L511) **already branches on `lang == "mermaid"`** (L519–520) to emit `<pre class="mermaid">` — our math renderer rules slot in beside this.
- **Public JS** lives in `wiki/public/js/` (`mermaid-loader.js`, `mermaid-renderer.js`, `pdf-viewer.js`, `code-blocks.js`, `image-viewer.js`), wired into `wiki/templates/wiki/layout.html` and cache-busted via the `get_asset_hash(path)` Jinja helper. Vendored libs: `wiki/public/js/vendor/{pdfjs,mermaid,alpinejs}/`.
- **Public CSS:** `wiki/public/css/main.css`.
- Read-mode code highlighting is client-side (`code-blocks.js` → `hljs.highlightAll()`); math containers must **not** be `<pre><code>` so hljs leaves them alone.

## Non-Goals (v1)

- **No MathJax, no TeX macro packages** (`\newcommand`, `\require`, `\usepackage`) — KaTeX's supported subset only.
- **No server-side rendering** of math (no KaTeX on the Python side, no headless browser). Client-side hydration only, exactly like Mermaid v1.
- **No visual / WYSIWYG formula editor** (MathLive-style). Source-text editing with live preview only. (Phase 2 candidate.)
- **No equation numbering, `\label`/`\ref` cross-references, or a per-page equation list.** (Phase 2 candidate.)
- **No chemistry (`mhchem`) / physics extensions** and no external CDN runtime dependency.
- **No SVG/PNG export** of a formula in v1.
- No multi-line alignment beyond what `$$ ... $$` + KaTeX's `aligned` environment already provides.

## Design

### Markdown representation

Inline math, delimited by single dollars with no adjacent whitespace:

```markdown
The mass–energy relation is $E = mc^2$ for a body at rest.
```

Display math, as its own paragraph:

```markdown
$$
\int_{-\infty}^{\infty} e^{-x^2}\,dx = \sqrt{\pi}
$$
```

- A literal dollar sign is written `\$`.
- The delimiter rules (no space inside the delimiters) are enforced by the same options on both the editor tokenizer and the `dollarmath` plugin, so editor and reader agree on what is math.
- The source is stored verbatim in the page Markdown — so page history, diffs, and GitHub one-way sync "just work" with no extra work.

### 1. Editor — math nodes

**Decision to settle in Phase 1** (see [Open Questions](#open-questions)): use `@tiptap/extension-mathematics`'s `InlineMath` / `BlockMath` nodes directly, and add the markdown round-trip on top; or hand-roll `math-inline.js` / `math-block.js` on the repo's own node pattern (`mermaid-block.js`). The recommendation is to **start with the official extension** for rendering/input rules and layer the markdown tokenizers on it, falling back to hand-rolled nodes only if its HTML shape fights the round-trip.

Whichever path:

- **Attributes:** `latex` (the TeX source; the official extension uses this name — keep it so we can reuse its commands/input rules).
- **Node view:** a small Vue view (`MathInlineView.vue` / `MathBlockView.vue`) rendering into a `<span>`/`<div>` via KaTeX, `contenteditable=false`, selection ring when `selected`. Clicking enters an inline source editor (a small popover/textarea), mirroring how other blocks handle "edit the source" affordances.
- **Rendering:** import KaTeX and call `katex.renderToString(latex, { throwOnError: false, trust: false, displayMode })`. **`throwOnError: false`** so a half-typed formula shows the raw TeX in red instead of throwing into the editor; **`trust: false`** for security.
- **Theme:** KaTeX output is theme-agnostic (CSS-driven); ensure the container inherits the editor's text color in both light and dark mode.
- **Commands:** `setInlineMath(latex)` / `setBlockMath(latex)` (from the official extension, or our `addCommands`), so the toolbar and slash command both have a single entry point.
- **Input rules:** typing a closing `$` after `$...$` converts the text into an inline math node (the official extension provides these). Verify it does not fire inside code blocks or on currency amounts.

### 2. Editor — markdown round-trip (the main risk)

`@tiptap/markdown` serializes/parses per node. We must add, for the math nodes:

- an **inline-level** `markdownTokenizer` matching `$...$` (respecting the no-adjacent-whitespace rule and the `\$` escape), and
- a **block-level** `markdownTokenizer` matching a `$$ ... $$` paragraph, plus
- `parseMarkdown(token) → { type: 'inlineMath'|'blockMath', attrs: { latex } }` and
  `renderMarkdown(node) → '$' + latex + '$'` / `'$$\n' + latex + '\n$$\n\n'`.

**Precedence is the thing to verify first:** the inline `$` tokenizer must win over emphasis/link handling for math spans, and the block `$$` tokenizer must win over the paragraph tokenizer — mirroring how `mermaid-block.js`'s tokenizer must win over the default fenced-code tokenizer. If `@tiptap/markdown` does not expose an inline token extension point cleanly, the fallback is to hand-roll the nodes (repo precedent) or to normalize `$...$` in `markdown-normalize.js`. **Do not ship without confirming a lossless save/reload round-trip.**

### 3. Editor — registration, toolbar, slash command

- **Register** the math nodes in `WikiEditor.vue`'s `extensions` array, positioned per the precedence finding above.
- **Toolbar** (`WikiToolbar.vue`): a math button (lucide `Sigma` / `Radical`) near the code-block button → inserts a block math node.
- **Slash command** (`slash-commands.js`): add
  `{ title: 'Math', icon: 'lucide-sigma', group: 'Insert', keywords: ['latex', 'formula', 'katex'], command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setBlockMath({ latex: '' }).run() }`
  following the existing `{ title, icon, group, keywords, command }` shape used by the Diagram item.

### 4. Public reader — `markdown.py` + loader/renderer + template + CSS

**Python (`wiki/wiki/markdown.py`)** — no placeholder pre-scan needed:

- `.use(dollarmath_plugin)` on the `MarkdownIt` instance (~L505), configured to match the editor's delimiter rules.
- Add `renderer.rules["math_inline"]` and `renderer.rules["math_block"]` emitting inert containers holding the **HTML-escaped** TeX source, e.g.
  ```html
  <span class="wiki-math-inline" data-math="E = mc^2"></span>
  <div class="wiki-math-block" data-math="..."></div>
  ```
  (A `data-` attribute is fine for short inline TeX; for block math prefer a `<template>` child, as the Mermaid spec discusses, to avoid attribute-encoding pitfalls with multi-line source.)
- The raw source of a formula must be recoverable exactly by the client; the container markup is **server-controlled** and only the escaped source is author-derived.

**Public JS** — two new files in `wiki/public/js/`, modeled on `mermaid-loader.js` / `mermaid-renderer.js`:

- `katex-loader.js` — shared lazy loader that injects the vendored KaTeX script (and CSS) once, on demand, exposing a promise; bridged into the editor if needed (as `mermaid-loader.js` is).
- `katex-renderer.js` — on load and on SPA navigation (same `MutationObserver` pattern as `mermaid-renderer.js`), find every `.wiki-math-inline:not(.is-ready)` / `.wiki-math-block:not(.is-ready)`. **Bail fast if there are none** so math-free pages never fetch KaTeX. Then load KaTeX once and `katex.render(source, container, { throwOnError: false, trust: false, displayMode })`. On error, render the raw TeX with an inline error style (never a blank box).

**Template (`wiki/templates/wiki/layout.html`)** — include `katex-renderer.js?v=<get_asset_hash(path)>`, mirroring the Mermaid wiring, and ensure the vendored `katex.min.css` is loaded only when math is present (or is cheap enough to always include — verify size; if so, include with a cache-busted hash).

**CSS (`wiki/public/css/main.css`)** — `.wiki-math-inline` / `.wiki-math-block` containers (centered block math, horizontal scroll on overflow), light/dark-aware, and the inline error style. Do not let over-wide display math blow out the prose column.

### 5. Public asset packaging for KaTeX

Same risk class as `pdfjs-dist` and Mermaid: the public reader is **not** built by the frontend Vite pipeline, so `katex` from `node_modules` is not available there.

- **Vendor** the prebuilt KaTeX distribution into `wiki/public/js/vendor/katex/`: `katex.min.js`, `katex.min.css`, and the whole `fonts/` directory **preserving relative paths** (the CSS references `fonts/KaTeX_*.woff2` relatively, so moving the CSS without its fonts breaks rendering).
- **Vendor as `.js`, NOT `.mjs`** — inherited lesson: production nginx serves `.mjs` as `application/octet-stream` and browsers refuse it. (KaTeX ships UMD `.js` already, so this is satisfied naturally.)
- Pin the KaTeX version in-repo, no CDN. The editor uses the npm copy; the two are independent.

## Security

Formula source is untrusted user input rendered into other readers' browsers — an XSS surface (KaTeX supports `\href`, `\htmlClass`, `\includegraphics`, `\htmlData`).

- **`trust: false`** (KaTeX's default) on **every** `katex.render` / `renderToString` call, editor and public. This disables `\href`, `\htmlClass`, `\htmlData`, `\includegraphics` and `\url`. **Do not enable `trust` in v1.**
- **`strict: false`** (or the string `"ignore"`) so unsupported commands degrade to visible red text rather than throwing and breaking the render loop.
- Source is transported **HTML-escaped**, never interpolated into executable HTML; container markup is server-controlled.
- Only the vendored KaTeX is used — no user-supplied macros (`\newcommand`) are persisted or executed globally.
- **Regression test:** a formula such as `\href{javascript:alert(1)}{x}` must render **without** producing a live `<a href="javascript:...">`.

## Acceptance Criteria

- Typing `$E = mc^2$` in the editor converts to a rendered inline formula; typing `$$ ... $$` (or `/math`) inserts a rendered display formula.
- Editing a formula's source live-updates the render (debounced); invalid TeX shows the raw source plus an inline error and never freezes the editor or blanks the block.
- The content **round-trips losslessly**: saving persists `$...$` / `$$ ... $$` as plain Markdown, reloading restores the math nodes (never a plain paragraph, never a code block, never doubled/escaped delimiters on repeated saves).
- A literal `\$` and a currency string (`pay $5 and $10`) do **not** become math, in both editor and reader.
- On the **public** page the same formula renders as typeset HTML; it renders after SPA navigation; **math-free pages never load `katex*.js`** (verify in the network panel).
- No-JS / failed import degrades to the raw TeX, never a blank box.
- Light/dark theme looks correct on both sides.
- `\href{javascript:alert(1)}{x}` does **not** produce a live link (security regression test passes).

## Open Questions

- **Inline markdown tokenizer precedence (main risk).** Does `@tiptap/markdown` let an inline-level custom tokenizer reliably claim `$...$` ahead of emphasis/link parsing? If not, do we hand-roll the nodes (repo precedent) or normalize in `markdown-normalize.js`? Resolve in Phase 1 before committing to the node implementation.
- **`@tiptap/extension-mathematics` vs hand-rolled nodes.** The extension gives rendering + input rules for free but its HTML shape and markdown support must be checked against our round-trip requirement. Decide after a spike.
- **KaTeX CSS/fonts loading strategy on the public reader.** Always-include the CSS (~23 KB) with cache-busting, or gate it behind the same "page has math" check? Confirm the CSS asset URL resolution from a vendored directory.
- **`$` delimiter strictness.** Confirm the exact `dollarmath` options (`allow_space`, `allow_digits`, `double_inline`) needed to match the editor's input rules while not breaking legitimate math (e.g. formulas starting with a digit or containing `$$`).
- **Display-math detection parity.** Ensure `$$` handling is identical between `dollarmath`, the block tokenizer, and the input rules.

## Phase 2 (future, not in this spec)

- Equation numbering and `\label`/`\ref` cross-references (probably needs a page-level equation index).
- A visual formula editor (MathLive) as an alternative to source editing.
- `mhchem` / physics / units extensions behind a per-space setting.
- Export a formula to SVG/PNG.
- Server-side KaTeX render for no-JS/SEO/first-paint, behind a flag (the rejected v1 path).
- Copy-TeX / copy-MathML affordances on rendered formulas.

## Files to touch (summary)

| File | Change |
|---|---|
| `frontend/package.json` | Add `@tiptap/extension-mathematics` and `katex` (pinned to the repo's `3.29.2` Tiptap line) |
| `frontend/src/components/tiptap-extensions/math-inline.js` | **New** — inline math node (or a thin wrapper/config over `InlineMath`) + `$...$` markdown tokenizer |
| `frontend/src/components/tiptap-extensions/math-block.js` | **New** — block math node + `$$...$$` markdown tokenizer |
| `frontend/src/components/tiptap-extensions/MathInlineView.vue` | **New** — KaTeX-rendered inline node view + source popover |
| `frontend/src/components/tiptap-extensions/MathBlockView.vue` | **New** — KaTeX-rendered block node view + inline error handling |
| `frontend/src/components/WikiEditor.vue` | Register the math nodes (ordered per the precedence finding) |
| `frontend/src/components/tiptap-extensions/WikiToolbar.vue` | Math toolbar button |
| `frontend/src/components/tiptap-extensions/slash-commands.js` | `/math` slash command |
| `wiki/wiki/markdown.py` | `.use(dollarmath_plugin)` + `math_inline` / `math_block` renderer rules emitting inert, escaped containers |
| `wiki/public/js/katex-loader.js` | **New** — shared lazy KaTeX loader (mirror `mermaid-loader.js`) |
| `wiki/public/js/katex-renderer.js` | **New** — hydrate math containers (mirror `mermaid-renderer.js`), gate on presence, no-JS fallback |
| `wiki/public/js/vendor/katex/*` | **New** — vendored `katex.min.js` + `katex.min.css` + `fonts/` (relative paths preserved) |
| `wiki/templates/wiki/layout.html` | Include cache-busted `katex-renderer.js?v=<get_asset_hash>` (+ KaTeX CSS) |
| `wiki/public/css/main.css` | `.wiki-math-inline` / `.wiki-math-block` container + error styles |
| `e2e/tests/math.spec.ts` | **New** — Playwright: insert → live render → save/reload round-trip → public render → math-free page loads no KaTeX → security (`\href{javascript:...}` produces no live link) |