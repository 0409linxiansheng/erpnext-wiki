# LaTeX maths in the editor (Alexandrie port, spec 01)

## Problem

Alexandrie's editor renders LaTeX natively — inline `$…$` and block `$$…$$`. This
editor has none: `$x^2$` is literal text in the editor, and the published page
prints it as literal text too. Technical and academic spaces — the whole reason
the feature is on the list — cannot be written here.

The other three items this spec's index entry listed are already built, so they
are verification, not work:

| Alexandrie capability | State | Evidence |
|---|---|---|
| Interactive checkboxes (task lists) | **built** | `TaskList`/`TaskItem` registered in `WikiEditor.vue:810` and `WikiContentViewer.vue:67`; toolbar entry `WikiToolbar.vue:54-58`; slash command `slash-commands.js:78`; server plugin `markdown.py:22,508` (`tasklists_plugin`) |
| Custom containers | **built** | `specs/callout_container_node.md`, all five phases landed; server side `markdown.py:83-103` |
| Frames / embeds | **built** | `pdf-block.js`, `video-block.js`, `iframe-block.js` + `PdfBlockView.vue`, `VideoBlockView.vue`, `IframeBlockView.vue` |

So the deliverable is maths, plus a "no drift" check on the three above (they must
render on all four surfaces — editor, `markdown.py`, public CSS, print — which
this spec re-verifies rather than rebuilds).

## Wire format

- Inline `$…$`, block `$$…$$`. This is the KaTeX/LaTeX convention, it is what
  Alexandrie uses, and it is what `mdit_py_plugins.dollarmath` implements — the
  wire format costs nothing if it matches the server plugin.
- The persisted form stays Markdown, like every other node: nothing in
  `frontend/src` calls `editor.getJSON()` (ground rule from
  `callout_container_node.md`), and the same holds here.
- **Delimiter strictness is the one real decision.** A bare `$` is currency far
  more often than it is maths (`It costs $5 and $6`). `dollarmath` takes
  `allow_space`/`allow_digits` flags for exactly this; the values get pinned in
  Phase 0 after reading the plugin's signature rather than assumed here. The
  same flags must be mirrored in the frontend input rules, or the editor and the
  published page will disagree about what is maths.
- A `$` inside a fenced code block or a code span is never maths. This is a
  regression test case, not a nicety — the code-block fence is tokenised before
  the maths rule runs on the server, and the editor must not apply its input
  rule inside a `codeBlock` either.

## Solution

### 1. Editor node

Candidate, to be settled in Phase 0 by evidence: the official Tiptap 3
`@tiptap/extension-mathematics` (KaTeX-based `inlineMath`/`blockMath` nodes). It
is not currently in `frontend/package.json`, so Phase 0 checks it against
3.29.2 and against the `@tiptap/markdown` serializers. If its own input rules and
popovers fight frappe-ui, the fallback is a hand-rolled pair —
`math-inline.js` / `math-block.js` plus `math-markdown.js` — built exactly the
way `callout-block.js` + `callout-markdown.js` are, with `NodeViewWrapper` +
`NodeViewContent`. Record the choice in the reconciliation log; do not leave it
implicit.

Registration must go into **both** extension lists — `WikiEditor.vue:782` and
`WikiContentViewer.vue:53`. Registering only the editor is the same class of
drift the callout work hit in its Phase 1.

New npm dependencies: `katex` (and the Tiptap extension if the candidate wins).

Authoring interaction: KaTeX output is not editable, so the node view needs an
entry point — click the rendered formula to edit its TeX source. Reuse an
existing pattern (`LinkPopup.vue` is the closest: a small anchored popover over
the editor) rather than inventing a new one. Exact UX is a Phase 4 detail.

### 2. Markdown round-trip

`math-markdown.js` mirrors `mermaid-markdown.js`: tokenize `$…$` and `$$…$$` into
the node types, and serialize them back. If the Tiptap extension ships markdown
serializers, verify them rather than writing a second set — but a byte-identical
fixed point is the acceptance test either way, and per the callout spec's own
warning, **a fixed point proves nothing about fidelity**: assert the parsed node
types explicitly in the unit harness.

### 3. Server rendering

`_build_markdown()` (`markdown.py:502-508`, currently `footnote_plugin` +
`tasklists_plugin`) gains `.use(dollarmath_plugin, …)`. `mdit-py-plugins` is
already a dependency in `pyproject.toml`, and `mdit_py_plugins.dollarmath`
imports cleanly in the bench env — **no new Python package**.

Override the plugin's renderer rule to emit our own markup:
`<span class="math math-inline">…</span>` / `<div class="math math-block">…</div>`
holding the **escaped raw TeX**. Python does not render maths. This is the
mermaid shape verbatim: `markdown.py:519-520` emits `<pre class="mermaid">` and
`mermaid-renderer.js` hydrates it in the browser.

### 4. Reader hydration

- Vendor KaTeX at `wiki/public/js/vendor/katex/` (`katex.min.js`, `katex.min.css`,
  `fonts/`), following the mermaid / pdfjs / alpinejs precedent in that directory.
- `wiki/public/js/katex-renderer.js` mirrors `mermaid-renderer.js`: walk
  `.math-inline` / `.math-block`, `katex.render` each.
- Load both in `templates/wiki/layout.html` beside the mermaid tags at
  `layout.html:144-145`.
- The SPA needs the same hydration for the published-page view, so
  `wiki/www/wiki_app.py:60` (which already injects the `mermaid_loader` asset
  hash) also injects a `katex_loader` hash, and the SPA lazy-loads the vendored
  copy. The editor's node view uses the npm copy — two copies of KaTeX is
  unfortunate but consistent with how mermaid is already handled.

### 5. Public CSS

`.math-block` needs centring and horizontal overflow for long formulas, in
`wiki/public/css/main.css` (the file the callout restyle touched) and in
`frontend/src/wiki-editor-content.css` for editor parity. KaTeX's own stylesheet
must be loaded in both bundles; its font URLs are the fiddliest part of this
spec — the vendored CSS's relative font paths have to resolve under
`/assets/wiki/js/vendor/katex/`.

### 6. Print — needs sign-off

`print_format/standard_wiki_document` renders through wkhtmltopdf, which runs no
JavaScript, so client-side KaTeX never fires there.

| Option | Result in print | Cost |
|---|---|---|
| (a) leave raw TeX | visibly wrong | none |
| (b) pre-render TeX→MathML in Python, inline the MathML | wkhtmltopdf's WebKit predates MathML Core — probably still wrong, needs a visual check | low |
| (c) render each formula to SVG once, cache, reference it | correct | needs a renderer (node + KaTeX, or a headless browser) on the server |

Recommendation: ship the editor and public reader first (Phases 1–5), take (a)
across the print surface in the same branch, and decide (b) vs (c) as a
follow-up with a real PDF in hand. Print was the one unverified surface in the
callout work for the same reason.

## Files touched

| Area | File | Change |
|---|---|---|
| Node (new) | `frontend/src/components/tiptap-extensions/math-*.js` | inline + block node, node view, input rules |
| Markdown (new) | `frontend/src/components/tiptap-extensions/math-markdown.js` (+ `.test.js`) | tokenize / serialize |
| Registry | `frontend/src/components/tiptap-extensions/index.js` | export |
| Editor | `frontend/src/components/WikiEditor.vue:782` | register |
| Viewer | `frontend/src/components/WikiContentViewer.vue:53` | register |
| Toolbar | `frontend/src/components/tiptap-extensions/WikiToolbar.vue` | entry (literal `lucide-*` class — lucide safelist) |
| Slash menu | `frontend/src/components/tiptap-extensions/slash-commands.js` | maths command |
| Server | `wiki/wiki/markdown.py:502` | `dollarmath_plugin` + renderer override |
| Reader (new) | `wiki/public/js/katex-renderer.js`, `wiki/public/js/vendor/katex/**` | vendored lib + hydrator |
| Reader | `wiki/templates/wiki/layout.html:144` | script tags |
| Boot | `wiki/www/wiki_app.py:60` | `katex_loader` asset hash |
| CSS | `wiki/public/css/main.css`, `frontend/src/wiki-editor-content.css` | inline/block maths |
| Tests | `math-markdown.test.js`, `wiki/wiki/test_markdown.py`, `e2e/tests/math.spec.ts` | see below |

Not affected: `skills/frappe-wiki-skill/**` — no whitelisted change-request
method changes, so its `reference/api.md` contract is untouched.

## Out of scope

- MathJax-only macros. KaTeX's feature set is the target.
- A telemetry counter for maths: unlike `blocks_mermaid` / `blocks_callout`
  (`telemetry_scan.py:37-38`), a `LIKE '%$%'` scan would count every currency
  amount and every code sample.
- Editor-side maths inside callouts works for free once the node is registered —
  a container node's content is real document content.

## Phases (tracer bullets)

Branch: `feat/alexandrie-editor-math` off `upstream/develop`. Spec committed
first, then one commit per phase. Stage by explicit path — this checkout has
concurrent sessions.

**Phase 0 — evidence.** Commit this spec. Verify
`@tiptap/extension-mathematics` against Tiptap 3.29.2 and `@tiptap/markdown`
(throwaway `node --test` harness, the way `callout-markdown.test.js` does it).
Read `dollarmath`'s signature and pin `allow_space` / `allow_digits`. Record the
extension-vs-hand-rolled decision. Done when the decision and the delimiter
flags are in the reconciliation log.

**Phase 1 — tracer bullet (editor + markdown only).** Type `$x^2$` and `$$…$$`,
save, reload: markdown byte-identical, both node types present in
`editor.getJSON()`. No toolbar, no server rendering, no CSS.

**Phase 2 — server.** `dollarmath_plugin` in `_build_markdown` with our class
names. `test_markdown.py` asserts inline, block, currency (not maths), and a `$`
inside a code fence (not maths).

**Phase 3 — public reader.** Vendor KaTeX, add `katex-renderer.js` and the script
tags, verify a published page in both themes. Expect font-path trouble here.

**Phase 4 — SPA polish.** Toolbar entry, slash command, node view editing popover,
`wiki-editor-content.css` parity, `katex_loader` boot hash.

**Phase 5 — print — DONE (2026-10-13).** Reversed from the original deferral: the
print flavour now typesets maths on the server (`wiki/wiki/math_render.py` +
`scripts/render-math.mjs`), so a PDF carries the same formulas as the reader.

**Phase 6 — e2e.** `e2e/tests/math.spec.ts`: slash-insert a formula, save, and
assert `.katex` exists on the published page. Create a throwaway space through
the API and delete it in `afterEach` — the callout work learned that authoring
into "whichever space is listed first" makes the suite flake.

## Tests

- `math-markdown.test.js` — round-trip for inline, block, `\begin{aligned}` inside
  `$$`, a `$` in a code span, and a currency string. Assert parsed node types,
  not just the fixed point.
- `wiki/wiki/test_markdown.py` — HTML shape for the same cases.
- `e2e/tests/math.spec.ts` — the reader-side proof.

## Reconciliation log

**Phase 0** — evidence gathered; decisions below.

*Editor node: extend the official extension, not hand-roll.*
`@tiptap/extension-mathematics@3.29.2` is the Tiptap 3 line the repo already
uses, so `InlineMath` / `BlockMath` (node names `inlineMath` / `blockMath`,
attribute `latex`) drop straight in. Its node view is **plain DOM with KaTeX**,
not a Vue component, which has two consequences: the node modules stay
importable under `node --test` (no `.vue` at the top level), and there is no
`NodeViewWrapper` to hand-roll — so `math-inline.js` / `math-block.js` are thin
`.extend()`s, not new node definitions.

Two things the stock extension gets wrong and this port overrides:

1. **`markdownTokenizer` is too loose.** Stock inline is `/^\$([^$]+)\$(?!\$)/`
   (matches `$5 and $10`), stock block is `/^\$\$([^$]+)\$\$/` (takes the
   single-line `$$x$$` as one line but is not whole-line anchored) and its input
   rule wants `$$$…$$$`. Replaced with the strict pair below, in
   `math-markdown.js` so it can be unit-tested the way `mermaid-markdown.js` is.
2. **Input rules.** Stock inline wants `$$…$$`, stock block wants `$$$…$$$`.
   Both are replaced; `addInputRules` replaces rather than merges — Tiptap's
   `extend()` is `{ ...this.config, ...extendedConfig }` (verified in
   `@tiptap/core/dist/index.js:4267`), so returning our own array drops the
   parent's.

`insertInlineMath` / `insertBlockMath` **return false when `latex` is empty**,
so the slash command and toolbar must supply a default (`E = mc^2`,
`\int_{-\infty}^{\infty} e^{-x^2}\,dx = \sqrt{\pi}`). KaTeX options are pinned to
`{ throwOnError: false, strict: false, trust: false }` — `trust` false is the
security-relevant one (`\href{javascript:…}` must not become a link).

*Delimiter flags, mirrored from `mdit_py_plugins.dollarmath`.* Configured
server-side in Phase 2 as `allow_labels=False, allow_space=False,
allow_digits=False, allow_blank_lines=True, double_inline=False` (read from
`env/.../mdit_py_plugins/dollarmath/index.py`). The flags that matter for
agreement between editor and published page:

- `allow_space=False` → the opening `$` may not be followed by whitespace and
  the closing `$` may not be preceded by it. This is what keeps
  `It costs $5 and $6` out of maths (the first `$` fails on the space before the
  second `$`).
- `allow_digits=False` → no digit immediately before the opener or after the
  closer. The closer side is mirrored as `(?![\d$])` (`$a$2` stays literal, same
  as the server). The opener side is **not** mirrored: marked hands the inline
  tokenizer the buffer starting at the `$`, so the character before it is not in
  scope, and `1$x$` converts in the editor while the server leaves it literal.
  Accepted as a rare divergence rather than chased with a custom `start` that the
  tokenizer would ignore anyway.

*marked's tokenizer contract (verified, not assumed).* `@tiptap/markdown`'s
`registerTokenizer` (`dist/index.js:421`) installs the tokenizer/`start` into
marked's `extensions.block`/`extensions.inline` and `startBlock`/`startInline`.
In marked 17 (`marked-tiptap/lib/marked.esm.js`, `Lexer#blockTokens` /
`#inlineTokens`) the extension list is tried **first** each iteration and is
handed the **full remaining buffer** — a match must therefore be anchored at
position 0 (`^\$`). That anchoring is what protects code: a fenced block is
consumed whole by the `fences` rule (which is only reached because our tokenizer
does not match at the fence opener), and a `` `$x$` `` codespan is consumed whole
before the inner `$` ever reaches position 0 — so no explicit code-skip is
needed on the parse side. `start` only bounds the fallback text token
(`startBlock` / `startInline`) so a `$` in a run of text is not swallowed by
`paragraph` / `inlineText` before the rule can see it.

Input rules need no code-block guard: Tiptap's runner already bails on
`$from.parent.type.spec.code` and on code marks
(`@tiptap/core/dist/index.js:4067`).

*Frontend deps added:* `@tiptap/extension-mathematics@3.29.2`, `katex@0.16.22`.

**Phase 1 — editor + markdown.** `math-inline.js` / `math-block.js` extend the
official nodes (see Phase 0) with the strict `markdownTokenizer` and replacement
`addInputRules`; both are exported from `tiptap-extensions/index.js` and
registered in `WikiEditor.vue` and `WikiContentViewer.vue` with
`MATH_KATEX_OPTIONS`. `math-markdown.test.js` drives the real `MarkdownManager`
(11 cases: both node types, single-line `$$x^2$$` → block, `\begin{aligned}`,
currency, `$a$2`, a `$` in a code span, a `$` in a fence, and byte-identical
round-trips). `katex/dist/katex.min.css` is imported in `main.js` for the node
view's markup, and `wiki-editor-content.css` centres `.math-block`.

**Phase 2 — server.** `_build_markdown` gains
`.use(dollarmath_plugin, allow_labels=False, allow_space=False,
allow_digits=False, allow_blank_lines=True, double_inline=False)` and two
renderer rules emitting `<span class="math math-inline">` / `<div class="math
math-block">` with the TeX HTML-escaped (the client hydrates; the server never
ships pre-rendered KaTeX). `test_markdown.py` gains `TestMathRendering` (7
cases). Whole module: 107 passing.

**Phase 3 — public reader.** KaTeX 0.16.22 is vendored at
`wiki/public/js/vendor/katex/` (js + css + `fonts/`; the CSS's relative
`fonts/KaTeX_*.woff2` paths resolve under the same directory).
`katex-loader.js` lazy-loads the bundle behind a `?v=` cache-buster and adds the
stylesheet on demand; `katex-renderer.js` scans `#wiki-content .math-inline,
.math-block`, stashes the escaped TeX in `data-math-src`, renders with
`displayMode = has('math-block')`, and returns early (never fetching KaTeX) when
the page has no maths. Both are wired in `layout.html` with
`get_asset_hash(...)`; `main.css` centres `.math-block`.

**Phase 4 — SPA polish.** Slash command `/math` (`Insert` group, `lucide-sigma`)
inserts a block formula with the default body; the toolbar carries `Inline Math`
(`lucide-sigma`) and `Block Math` (`lucide-sigma-square`) entries. Both entry
points must pass a non-empty body because `insertInlineMath` / `insertBlockMath`
return false otherwise. Icon classes are plain literals in scanned source, so
Tailwind's JIT emits them via frappe-ui's full-pack `matchComponents`; **no
change to `wiki/lucide_icons.json`** — that table only feeds the reader's
server-rendered templates, which draw no maths icon.

Two deviations from the spec's file table, both deliberate:

- **`katex_loader` boot hash — skipped.** `get_asset_hashes()` exists so the SPA
  can cache-bust the *vendored* loader it fetches at runtime (the mermaid path).
  The SPA renders maths through the bundled npm node view, not the vendored
  loader, so there is no runtime fetch to bust; the reader gets its hash from
  `layout.html` inline. Adding an unused key would be dead config.
- **Node-view editing popover — deferred.** The official node view exposes an
  `onClick(node, pos)` hook but no editor UI. Authoring a formula is a
  source-text act (`$…$` / `$$…$$`), and an existing one is editable by
  selecting and deleting it; a click-to-edit popover is a UX affordance, not
  feature parity, so it is left for a follow-up rather than half-built.

**Phase 5 — print: built, decision reversed (2026-10-13).** The original call was
to accept raw TeX in the PDF (option a); that was overruled on the ground that a
page which is correct on screen and wrong in the export is worse than one that is
wrong in both.

What was built:

- `wiki/wiki/math_render.py` replaces the TeX inside each `.math-inline` /
  `.math-block` container with MathJax SVG, keeping the container so the print
  CSS still applies. It is called from `Wiki Document.before_print`, which
  `frappe.www.printview` invokes for both the print view and PDF generation.
- `scripts/render-math.mjs` does the TeX → SVG work, one node process for the
  whole page, reading one JSON object on stdin and writing one on stdout.
- **MathJax, not KaTeX.** KaTeX emits HTML plus a stylesheet plus web fonts;
  MathJax `fontCache: 'local'` emits every glyph as a path inside the `<svg>`, so
  QtWebKit needs no fonts. KaTeX also has no SVG output at all.
- **The `es5/tex-svg.js` single-file bundle does not work here**: it hard-requires
  `xmldom-sre`, which only speech-rule-engine 3.x provides, and mathjax-full
  depends on 4.x. `mathjax-full/js/*` is CommonJS with no `exports` map, so the
  harness reaches it through `createRequire`. `yarn add mathjax-full@3.2.2` at the
  app root is the only new dependency.
- **`html` and `htmlCssColor` are dropped from the TeX packages.** With them,
  `\href{javascript:alert(1)}{x}` produced a real `<a href>` inside the SVG — an
  XSS vector, because the print HTML is previewed in a browser. The reader already
  refuses that construct (KaTeX runs with `trust: false`); the server now agrees,
  and `sanitize_svg` strips unsafe `href`/`xlink:href` as a second layer.
- A formula that fails to render keeps its raw TeX, and an unusable node
  installation degrades the same way: a wrong-looking PDF beats no PDF.
- Verified: a probe page with one inline and one display formula printed through
  `/printview` contains 2 `<svg>` and 10 `<path>` and no raw TeX, and
  `download_pdf` returns a valid one-page PDF. `wiki/wiki/test_math_render.py`
  pins the plumbing (12 cases) without needing node.

**Phase 6 — e2e.** `e2e/tests/math.spec.ts` covers editor parse + KaTeX preview,
byte-identical round-trip, the currency/code-span negatives, the slash insert,
and the public page (`.katex` hydrates) including a `\href{javascript:…}` trust
regression. Spaces are seeded through the `wiki` fixture, which tears them down
in its own epilogue.
