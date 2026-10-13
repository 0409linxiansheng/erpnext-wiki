# Search and the command palette (Alexandrie port, spec 03)

Date: 2026-10-13
Status: **Spec — planned.** Program index: [README.md](README.md). Builds on the
two editor specs only in that the palette must keep working with whatever they
added; it has no dependency on them.

## Problem

Finding things should feel the same in the app as it does on the published
reader. Today it does not: the reader searches full text with relevance-ranked
snippets, while the in-app command palette matches the page **route** only, in a
recently-modified order, with no snippet and no score. There is also no search
on the Overview page, which is the app's front door.

## Phase 0 — evidence (2026-10-13)

- **Two search paths exist and are wired to different surfaces.**
  - `wiki.api.search.search_pages(query)` — a route-substring match
    (hyphenation-aware), `modified desc`, 20 results, no snippet, no score. Its
    only app consumer is `CommandPalette.vue`; a unit test and a telemetry test
    also touch it.
  - `wiki.frappe_wiki.doctype.wiki_document.search.search(query, space)` — the
    SQLite full-text index (`WikiSQLiteSearch`), returning title, a content
    snippet and a score, filtered by space visibility. This is what the public
    reader's search modal uses.
- **The palette is not "navigation only".** It already carries searchable
  *actions* (new page, new space, settings, theme, log out) and its page results
  already span every space the user can read. The program index's "add action +
  cross-space results" row is therefore **stale**: the actual gap is that the
  page results are route matches rather than full-text ones.
- **The Overview page has no search surface at all.**

## Decisions

1. **One relevance path, two entry points.** The palette and the Overview box both
   call the full-text `search` endpoint and render the same result shape —
   title, snippet, space, score — instead of maintaining a second, weaker
   matching rule in `search_pages`. `search_pages` keeps its job as the
   route-prefix lookup (typing a URL fragment is still a legitimate, different
   thing), but the palette stops using it for page results.
2. **Scores are exposed, not re-invented.** `WikiSQLiteSearch` already ranks;
   "calibration" here means asserting the ordering is stable and sensible rather
   than shipping a bespoke ranking. The one deliberate tweak is to break
   score-ties by recency, so a ranking is deterministic.
3. **The Overview search box reuses the reader's look** (an inset search icon and
   a kbd hint) so the two fronts of the product do not teach two habits.
4. **No cross-space *filtering* chrome in v1.** Results already span spaces and
   are already visibility-gated; adding a per-space facet is a later nicety, not
   this spec.

## Surfaces

| Surface | Change |
| --- | --- |
| Command palette | page results switch from `search_pages` to the FTS search; render snippet + space + score; keep the existing actions |
| Overview page | a search box; results in the same shape as the palette's |
| Server | none — both endpoints already exist; the palette's `search_pages` stays for route lookup |
| Reader / print | none |

## Phases (tracer bullets)

**Phase 1 — the palette speaks full text.** Swap the palette's page results to the
FTS endpoint, render title / snippet / space / score, keep actions and keep the
route lookup as a fallback when the query looks like a path. No Overview work yet.

**Phase 2 — deterministic ordering.** `search` orders by score, ties broken by
`modified`; a Python test pins that a title hit outranks a body hit and that equal
scores come back newest-first.

**Phase 3 — Overview search.** The search box on the Overview page, same result
shape, same endpoint, with the kbd affordance matching the reader.

**Phase 4 — e2e.** Type into the palette and assert a snippet-bearing result
appears and is navigable; the same on the Overview box.

## Out of scope

- Per-space facets / filters.
- Fuzzy typo correction.
- Re-ranking the reader (it already uses the same index; a change to scores would
  be its own spec with reader-facing consequences).

## Reconciliation log

**Phase 0** — evidence gathered, decisions above. The program index's spec-03 row
is corrected here rather than in the matrix: the palette already has actions and
cross-space results, so this spec is about relevance and the Overview surface, not
about adding navigation to the palette.

**Phase 1 & 2 — DONE (2026-10-13), and they exposed a real bug.**

- The palette now speaks full text: page results come from
  `wiki.frappe_wiki.doctype.wiki_document.search.search`, render title / route /
  snippet / score, and are ordered by the server score (with the existing
  space bias). `search_pages` stays as the route-prefix lookup, and its own test
  keeps passing.
- **The switch uncovered that incremental FTS indexing was broken**: a page created
  or edited through the app was invisible to full-text search. Two causes, both
  recorded because they will recur:
  1. frappe's generic `update_doc_index` only *queues* a re-index, drained by a
     5-minute scheduler job — long enough for the palette and the reader to look
     broken. `on_update` now indexes synchronously (`index_doc_on_save`), matching
     the unpublish path that was already synchronous (`remove_doc_from_index`).
  2. The SQLite index lives in WAL mode; the `-wal`/`-shm` sidecars had been
     created by a diagnostic that opened the file as the wrong user, so the web
     worker hit `attempt to write a readonly database`. The sidecars are transient;
     removing them let SQLite recreate them with the right owner.
- **Draft pages are not in the palette's search** and are recorded as a gap, not a
  bug: the full-text index is published-only by design (the reader's contract),
  and surfacing drafts in the palette needs an edit-permission gate on a
  guest-accessible endpoint — more surface than Phase 1 should buy. Drafts stay
  reachable from the space tree.

Tests: 11 unit cases for the palette grouping (score ordering, space bias, no-NaN
sort, the client-vs-server filtering split), and 25 e2e green across the palette,
maths, snippets, voice and mermaid.

**Phase 3 & 4 — DONE (2026-10-13).** The Overview page now carries a search box in
its header — `WikiSearch.vue`, the same full-text endpoint, the same result shape
(title, route, snippet), the same `role="listbox"`/`option` semantics as the
palette, and the kbd affordance the reader teaches. A keystroke of two or more
characters queries; arrow keys and Enter navigate, and the results are trusted
only for the query that produced them (the same stale-row guard the palette
learned).

The e2e drives it end to end: seed a published page, type its name on the
dashboard, click the one result, land on the page. 26 e2e green across the six
specs; the i18n guard still skips with the pending count.

This closes spec 03.
