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
