# Kanban task board (Alexandrie port, spec 04)

Date: 2026-10-14
Status: **Spec — planned.** Program index: [README.md](README.md). Sign-off given by
the maintainer (2026-10-14); the README's open question #2 is resolved in favour of
building it, scoped as a lightweight `Wiki Task` rather than Frappe's core Kanban
Board.

## Problem

Alexandrie gives each space a lightweight task board. This app has none: a space is
a document tree plus settings, with no place for the short-lived "to do / doing /
done" list a team keeps next to its pages.

## Phase 0 — evidence (2026-10-14)

- **No task doctype or board exists.** The closest precedent is the `Wiki Snippet`
  doctype from spec 02 — a small DocType with `All`-role owner-isolated permissions
  — which is the template here.
- **The space has a home for a board.** `/spaces/:spaceId` (`SpaceDetails.vue`) is a
  router-view with nested routes; a `tasks` child route slots in without touching
  the tree.
- **The README already fixed the scope** (line 116): bind a lightweight `Wiki Task`
  to a space, do not generalise Frappe's core Kanban Board.

## Decisions

1. **A small `Wiki Task` DocType, not the Desk Kanban.** Fields: `title` (reqd),
   `status` (Select: Backlog / To Do / In Progress / Done — the four columns),
   `wiki_space` (Link, reqd — the binding), `description` (Text), `assigned_to`
   (Link User), and `sort_order` (Int, for order within a column). `autoname: hash`.
2. **The board is columns of `status`, and dragging a card across columns is a
   `status` write.** Within-column drag is a `sort_order` write; v1 orders by
   `sort_order asc` and updates it on drop.
3. **Access is space-agnostic for now.** `All` role CRUD (any signed-in wiki user),
   like `Wiki Snippet`. Enforcing the space's role on tasks is spec 05's job, not
   this spec's; the `wiki_space` field is for grouping and display, not a gate.
4. **No task links a page.** A card is standalone text + status + assignee. Linking
   a task to a document is a later nicety, not this spec.

## Surfaces

| Surface | Change |
| --- | --- |
| Backend | `Wiki Task` DocType; standard `frappe.client` CRUD (no whitelisted method) |
| SPA | a `tasks` child route → board view bound to the space |
| Reader / print | none (tasks are not wiki pages) |
| i18n | the four status labels and the board's UI strings through `__()` |

## Phases (tracer bullets)

**Phase 1 — the doctype.** `Wiki Task` created through the framework, the four
statuses, `All`-role permissions, a Python test that a task inserts and its fields
round-trip. Commit.

**Phase 2 — the board.** The `tasks` child route, a board that lists a space's tasks
grouped by `status`, and inline create. Commit.

**Phase 3 — drag.** Dragging a card to another column writes `status`; reordering
within a column writes `sort_order`. Commit.

**Phase 4 — e2e.** Create a task from the board, drag it to Done, assert the server
row changed and a reload keeps it.

## Out of scope

- Frappe's core Kanban Board (the README already said so).
- Linking tasks to pages.
- Space-role gating on tasks (spec 05).
- Due dates, labels, watchers, comments.

## Reconciliation log

**Phase 0** — evidence above; the README's open question #2 is closed. The design is
deliberately the smallest thing that is a useful board: one doctype, four columns,
two drag writes.

**Phases 2–4 — DONE (2026-10-14).** The board is a `tasks` child route under
`/spaces/:spaceId` (`SpaceTasks.vue`), reachable from a kanban button in the space
sidebar header. Four columns (the statuses), inline create per column, delete per
card, and native HTML5 drag: dropping on another column writes `status`, and the
board reloads. Within-column reordering is deferred — the spec's sort_order field
is in place and the list orders by it, but the drop handler only moves status for
now.

Deleting a space now cascades to its `Wiki Task`s (`delete_linked_content`), the
same as documents and revisions — without it a space with a board could never be
deleted (LinkExistsError), which the e2e cleanup caught immediately.

Two incidents worth recording:
- The board's e2e initially drove a `LinkExistsError` from the factory cleanup,
  which is what surfaced the missing cascade above.
- An unrelated regression surfaced too: the editor's link popup stopped rendering.
  It is mounted as its **own** `createApp` (into a tippy container), so it does not
  inherit the main app's `globalProperties.__`; the i18n sweep had switched its
  tooltips to `__()`, and the popup failed to resolve it. The fix hands the popup
  app `window.__` before mount.

Tests: 3 doctype unit cases, 2 kanban e2e (create + drag to Done; delete), and the
full suite at 32 green across eight specs.
