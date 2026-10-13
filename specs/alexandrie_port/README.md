# Alexandrie Feature Port

Date: 2026-10-12
Status: **Planned.** Program index only — no spec in this directory is built yet.

Source of truth for the target behaviour: **Alexandrie**
(https://github.com/Smaug6739/Alexandrie). It is a *behaviour reference only* —
none of its code is ported. Every item below is reimplemented on the Frappe +
Tiptap stack. Where Alexandrie and a spec in this directory disagree, the spec
wins: it records the decisions made while reconciling Alexandrie's behaviour with
the real data model and the real rendering surfaces.

## Why this is a reimplementation program, not a merge

Alexandrie shares no layer with this app:

| | Alexandrie | this app |
|---|---|---|
| Backend | Go (standalone service) | Python, Frappe framework |
| Frontend | Nuxt/Vue, own REST contract | Vue + frappe-ui, Frappe RPC |
| Database | MySQL 8, own schema | MariaDB, DocType ORM |
| Auth | self-built JWT + OIDC | Frappe session/roles |
| Storage | RustFS/S3 | Frappe File (S3 backend configurable) |

There is no seam at which "Alexandrie's functionality" can be dropped in. The
honest framing: **porting every Alexandrie feature is feasible; merging its
codebase is not** — that would be a rewrite. Roughly a third of the target
surface already exists here in some form (see the audit below), so the program is
about closing gaps, not building a wiki from scratch.

## The program in one paragraph

Keep this app as the single wiki, and close the feature delta against Alexandrie
in four areas the user cares about — **writing/editor, search/navigation,
permissions/organisation, storage/portability** — each feature its own branch,
its own spec, spec committed first. Nothing in the program changes the app's
data model except the page-level ACL (spec 05), which is deliberately sequenced
last among the four because it touches the one file every read and write passes
through, and because it must agree with the in-flight change-request work.

## Current-state audit

What already exists (verified against the checkout, not against README claims):

| Capability | Where it lives today | Delta |
|---|---|---|
| Nested document tree + groups | `Wiki Document` (tree), `Wiki Group Item` | none |
| Rich editor | Tiptap 3.29.2 (`frontend/package.json`); mermaid, callout, tables, task lists, images, code blocks (shiki/highlight.js) | LaTeX, snippet manager, speech-to-text absent |
| Diagram rendering | `tiptap-extensions/MermaidBlockView.vue`, `specs/mermaid_diagrams.md` | no in-editor editing UX |
| Callout containers | `specs/callout_container_node.md` (built) | 4 Alert types already; parity work done |
| Command palette (Ctrl+K) | `components/CommandPalette.vue`, `specs/cmd_k_search.md` | does not surface actions, only navigation |
| Full-text search | `wiki/frappe_wiki/doctype/wiki_document/search.py` — returns title, **content snippets**, **scores**, filters by space visibility, `allow_guest` | ranking calibration; search analytics is `specs/ia_refactor/05-search-analytics.md` |
| Route/title lookup | `wiki/api/search.py::search_pages` | fine as-is |
| Version history + diff | `Wiki Page Revision`, `components/DiffViewer.vue`, `@pierre/diffs` | — |
| CR + 3-way merge | `prd.md`, `wiki/frappe_wiki/doctype/wiki_change_request/**` | in flight |
| Space-scoped RBAC | `wiki/permissions.py` — `Wiki Space Role.permission_level` ∈ {Read, Write}; `specs/role_based_space_access_control.md` | **2 levels, space scope only** |
| PDF / video / iframe embeds | `PdfBlockView.vue`, `VideoBlockView.vue`, `IframeBlockView.vue`, `PdfViewerModal.vue` | audio and text/code preview absent |
| Git/GitHub sync | `wiki/git_sync.py`, `wiki_github_connection`, `specs/github_one_way_sync.md` | none (Alexandrie has no equivalent) |
| Page-view analytics | `wiki/analytics_store.py`, `wiki/api/analytics.py`, `specs/page_view_analytics.md` | none |
| Feedback | `Wiki Feedback` | none |
| Import/migration tooling | `Migrate To Wiki` doctype | no ZIP portability |
| Local-first editor | `specs/local_first_editor_migration_step_1.md`, `step_2.md` | upstream roadmap; follow it |

## Feature matrix

Difficulty is effort on *this* stack, not in Alexandrie.

| Alexandrie feature | Today | Work | Difficulty | Spec |
|---|---|---|---|---|
| LaTeX / math | absent | Tiptap math node + KaTeX, markdown round-trip, server render | easy | 01 |
| Custom containers, checkboxes | callout containers built; task-list extension already a dependency | verify task-list toolbar; container parity check | easy | 01 |
| Frames / embeds | PDF, video, iframe, image nodes | parity check only | easy | 01 |
| Snippet manager | absent | `Wiki Snippet` DocType + slash-command insert | medium | 02 |
| Speech-to-text | absent | Web Speech API button in the editor | easy | 02 |
| In-editor diagram editing | render only | edit UX around mermaid node | medium | 02 |
| Command center (Ctrl+K) | navigation only | add action + cross-space results | easy | 03 |
| Full-text with snippets + relevance | present | ranking calibration, surface in Overview | easy | 03 |
| Kanban task board | absent | `Wiki Task` + board view | medium | 04 |
| 5-level per-node permissions | 2-level, space-scoped | node-scoped ACL + tree inheritance + mapping to 5 levels | **hard** | 05 |
| Invitation codes / custom scopes | Frappe user invites | scoped invites | medium | 05 (optional) |
| Per-node public share links | published pages + Guest read only | share tokens per document | medium | 05 (optional) |
| S3 object storage | Frappe File backend | site config + migrate existing files | medium | 06 |
| Media sandbox (30+ formats) | PDF/video/iframe/image | audio, text/code preview | medium | 06 |
| Selective ZIP import/export | migration tool only | space-level ZIP export/import incl. attachments, routes, metadata | medium | 06 |
| OIDC SSO, multi-provider | Frappe Social Login Key | configuration + docs | easy | 07 |
| Offline-first PWA + sync | local-first specs in progress | follow upstream | **blocked** | 08 |
| Multi-tenant Teams/Workspaces/Categories | Space + Group Item (two levels) | — | out of scope | — |

## Specs, in build order

| # | Spec | What | Depends on |
|---|------|------|-----------|
| 01 ✅ | [01-editor-math-and-containers.md](01-editor-math-and-containers.md) | LaTeX node, task-list verification, container/frame parity across all render surfaces | — |
| 02 ✅ | [02-editor-snippets-and-voice.md](02-editor-snippets-and-voice.md) | Snippet manager, speech-to-text, in-editor diagram editing | 01 |
| 03 | `03-search-and-command-palette.md` | Ranking calibration, action + cross-space results in the palette, Overview search surface | — |
| 04 | `04-kanban-task-board.md` | `Wiki Task` docType + board view bound to a space | — |
| 05 | `05-page-level-access-control.md` | Node-scoped 5-level ACL with tree inheritance | **prd.md (change requests) must land first** |
| 06 | `06-storage-and-zip-portability.md` | S3 file backend, media previews, space ZIP export/import | — |
| 07 | `07-oidc-sso.md` | Social Login Key providers + docs | — |
| 08 | `08-offline-pwa.md` | Offline shell + sync | **blocked on HTTPS** |

Each spec is its own branch (`feat/alexandrie-*`) off `upstream/develop`, its own
PR against `frappe/wiki`, spec committed first. Ordering within 01–04 is
interchangeable; 05 is sequenced by the dependency, 08 by infrastructure.

## Program-level decisions

| # | Decision | Choice |
|---|----------|--------|
| 1 | Alexandrie's code | Behaviour reference only. No Go, no Nuxt, no schema is ported. |
| 2 | Editor engine | Stay on Tiptap. No CodeMirror/source-mode switch — Alexandrie's authoring model (raw Markdown) is not reproducible here, and WYSIWYG is what this app already ships. This is the largest expectation gap in the program. |
| 3 | New editor nodes | Every new node ships **all four render surfaces** — editor node view, `wiki/markdown.py`, public CSS, print format — plus markdown round-trip tests. This is the pattern `specs/callout_container_node.md` established; a node that renders only in the editor is not done. |
| 4 | Permissions sequencing | Spec 05 waits for the change-request / 3-way-merge work (`prd.md`) to land. That work reshapes `Wiki Document` identity (`doc_key`, `slug`, revisions) and permissions must be defined against the post-merge shape, not the current one. |
| 5 | Multi-tenant | Out of scope. Frappe's multi-tenancy is multi-site, not single-instance multi-tenant; the model conflict is not worth the cost. |
| 6 | Offline | Deferred. See landmine 4. |
| 7 | Kanban | Scope to a lightweight `Wiki Task` bound to a space rather than generalising Frappe's core Kanban Board. Needs sign-off before spec 04 is written. |
| 8 | Snippets | Ownership model (per-user vs per-space) is undecided — needs sign-off before spec 02 is written. |

## Landmines

1. **Rendering surfaces multiply.** A node added to the editor is invisible to the
   public reader and to print until `wiki/markdown.py` and the print format are
   updated too, and the reader's Jinja templates are DOM twins of the SPA. Server
   rendering is where the LaTeX work will actually be won or lost.
2. **`Wiki Document` field whitelists.** The CR/revision flow enumerates roughly
   forty fields explicitly. Any new tree metadata (a Kanban binding, an ACL
   pointer) has to be threaded through them by hand.
3. **Agent skill contract.** `skills/frappe-wiki-skill/reference/api.md` and
   `scripts/wikitool/` document the whitelisted change-request API. Any change to
   a whitelisted method in `wiki_change_request.py` must update both, with the
   skill's own tests run.
4. **This site is served over plain HTTP on a LAN IP** (`http://192.168.1.102`).
   That is a non-secure context: `navigator.serviceWorker` is `undefined` and a
   service worker never registers. Offline/PWA work (spec 08) is dead code until
   HTTPS is in front of the site. Do not debug "cache didn't pick up my change"
   in this direction.
5. **Concurrent sessions dirty this checkout.** Stage by explicit path, never by
   directory.

## Open questions (need sign-off)

1. ~~Snippet ownership: per-user library, per-space, or both?~~ **Decided
   2026-10-13: per-user library for v1, with a nullable `wiki_space` link on
   `Wiki Snippet` from the first commit** so space-shared snippets are additive
   later rather than a schema change. Spec 02 is unblocked.
2. Kanban: is a task board genuinely wanted, or is it a "nice to have" that should
   stay out? (blocks spec 04)
3. 5-level ACL: do the five levels need to be first-class, or is Read/Write/Admin
   plus an inherited default enough? Alexandrie's `Owner` level maps awkwardly
   onto a Frappe site where `Administrator` already exists. (blocks spec 05)
4. Public share links: per-node tokens, or is `is_published` + Guest read enough?
   (blocks spec 05)

## Reconciliation log

**Program index** — written 2026-10-12. No capability changes yet. Audit claims
in this file were taken from the checkout at that date; re-verify before
trusting any "already exists" row, since the CR work is actively moving
`Wiki Document`.
