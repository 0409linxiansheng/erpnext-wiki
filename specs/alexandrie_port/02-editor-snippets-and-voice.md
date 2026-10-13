# Snippets, voice input and in-editor diagrams (Alexandrie port, spec 02)

Date: 2026-10-13
Status: **Spec — planned.** Program index: [README.md](README.md). Builds on
[01](01-editor-math-and-containers.md), which established the shape of an editor
feature in this app.

## Problem

Alexandrie's authoring surface has three things this app does not: a library of
reusable text fragments, dictation, and (it was assumed) editing a diagram in
place. Two of the three survive contact with the checkout; one does not.

## Phase 0 — evidence (2026-10-13)

- **In-editor diagram editing already exists here.** `MermaidBlockView.vue` is a
  two-pane node view: a `textarea` holding the source, a live preview that keeps
  the last good SVG while the source is mid-edit or invalid, a remove action and a
  help link; `/mermaid` is already a slash command. This item is a **parity check
  with a small gap list**, not a feature. It is sequenced last because nothing
  depends on it.
- **Voice input is absent.** No `SpeechRecognition`, `getUserMedia` or
  `MediaRecorder` anywhere in `frontend/src`, and frappe-ui ships no audio or
  speech component to reuse. It has to be built.
- **Snippets are absent.** No DocType, no library, no insertion path.
- **The prerequisite for voice is already met.** Web Speech and `getUserMedia`
  need a secure context; this site now serves HTTPS and the capability probe
  recorded earlier reports `isSecureContext: true`, `serviceWorker: true`,
  `getUserMedia: true` over `https://192.168.1.102` and `https://erp.local`.

## Decisions

1. **A snippet is text inserted at the cursor, not a Tiptap node.** The program's
   decision 3 — every new node ships editor view, `markdown.py`, public CSS and
   print — therefore **does not apply here**, and pretending it does would be
   busywork: there is no new node, no markdown syntax, and no reader or print
   change. A snippet's body is inserted as markdown source, so `**bold**`,
   `$x^2$` and a mermaid fence behave exactly as if typed. This is the single most
   important decision in this spec.
2. **Ownership: per-user library for v1, with a nullable `wiki_space` link on
   `Wiki Snippet` from the first commit** (signed off 2026-10-13, recorded in the
   program index). Space-shared snippets are then additive rather than a schema
   change — but v1 neither sets nor reads the field.
3. **Voice is browser-side only.** Web Speech API, feature-detected, no server
   transcription, no third-party key and no audio leaving the machine. Where the
   API is missing the control is not shown, because a button that cannot work is
   worse than no button.
4. **Snippets use the stock REST surface.** The DocType plus `if_owner`
   permissions make `/api/resource/Wiki Snippet` sufficient, so the SPA uses
   frappe-ui's resource helpers and **no whitelisted method is added** — which
   keeps `skills/frappe-wiki-skill/reference/api.md` untouched.
5. **No templating in v1.** Alexandrie's snippets are reusable fragments; so are
   these. Variables/placeholders are a different feature and are out of scope.

## Storage

`Wiki Snippet` (`wiki/wiki/doctype/wiki_snippet/`):

| Field | Type | Notes |
| --- | --- | --- |
| `title` | Data, reqd, in list view | `title_field` |
| `content` | Text, reqd | markdown source, inserted verbatim |
| `keywords` | Data | extra terms the picker matches on |
| `wiki_space` | Link → Wiki Space | **nullable, unread in v1** (decision 2) |

Permissions: `All` with `if_owner` for read/write/create/delete — a snippet is
private data, so the permission has to be the thing that enforces it, not the UI —
plus `System Manager` read/write for support.

## Surfaces

| Surface | Change |
| --- | --- |
| Editor (SPA) | `/snippet` slash entry (Insert group) opening a picker; a "Manage snippets" dialog for create/edit/delete; a mic button in the toolbar |
| Server | the DocType and its permissions. **No `markdown.py`, no reader CSS, no print format, no hydration** |
| Reader / print | none, by decision 1 |
| Skill contract | nothing whitelisted is added or changed |

## Phases (tracer bullets)

**Phase 1 — the store.** DocType, permissions, `bench migrate`. Done when a second
user cannot read the first user's snippet — asserted by a test, not by inspection.

**Phase 2 — insert.** A snippet picker behind `/snippet` in the Insert group,
filtered by title and keywords, keyboard-drivable like the existing slash menu.
Insertion goes through the editor's markdown insertion so the round-trip rules
(and therefore `$…$`, callouts and fences inside a snippet) are the ones already
under test.

**Phase 3 — manage.** A dialog to create, edit and delete snippets, reachable from
the picker, built like `NewSpaceDialog.vue`. Search over title + keywords.

**Phase 4 — dictate.** A mic button that starts/stops `SpeechRecognition` and
streams interim results into the editor at the caret. Capability-probed at mount
(decision 3); a permission denial or an API error surfaces as a message and
changes nothing in the document.

**Phase 5 — diagrams, parity check.** Walk the existing node view against
Alexandrie's: insert from the slash menu, edit the source, recover from invalid
syntax, delete. Close only what is actually missing, and record what was already
there instead of rebuilding it.

## Tests

- **Python** — owner isolation on `Wiki Snippet`: user A cannot read, and cannot
  even `get_list`, user B's snippet (`if_owner` is a permission, so it is worth a
  test that fails if someone later "simplifies" the permissions).
- **Frontend unit** — the picker's filter: title match, keyword match, no match,
  case handling.
- **e2e** — create a snippet, insert it through the slash menu, assert the editor
  content; and for voice, **inject a stub `SpeechRecognition`** that emits a result
  and assert the text lands at the caret (a test cannot speak, but it can prove the
  wiring), plus the capability path where the stub is absent and the button is not
  rendered.

## Out of scope

- Space-shared snippets (the field exists; the behaviour does not).
- Snippet variables/placeholders.
- Server-side or third-party transcription.
- Rebuilding the mermaid node view.

## Reconciliation log

**Phase 0** — evidence gathered, decisions above. The probe page used for the
HTTPS capability check was created and deleted; no test data is left behind.

**Phase 2 — insert — DONE (2026-10-13).** `/snippet` in the Insert group opens a
picker (`SnippetPickerDialog.vue`) that filters on title and keywords, is driven
by arrow keys, and inserts the stored markdown at the caret through
`insertContent(content, { contentType: 'markdown' })` — the path a paste takes, so
a snippet containing `$…$`, a callout or a fence obeys the rules already under
test. The command hands its editor and range to `stores/snippetPicker.js`, because
a Tiptap extension can hold that state but cannot render a dialog.

The picker can also create a snippet, which is the difference between a usable
feature and a dead end; editing and deleting stay in Phase 3.

Two things the working code taught us, both recorded rather than papered over:

- **frappe-ui's `Dialog` takes its body through the default slot and its footer
  through `#actions`.** Content placed in a `#body-content` slot renders nowhere,
  silently — the dialog opened with a title and an empty body, and the first e2e
  run failed on a placeholder that could never exist.
- **The slash menu's own labels are not translatable at all.** `SLASH_COMMANDS`
  stores plain `title` / `group` strings (no `__()`), so the extractor never sees
  them and `Heading 1`, `Mermaid`, `Insert`, `Callouts` … stay English on a `zh`
  site. Confirmed against `main.pot`: none of them are entries. This predates this
  spec — every slash command has it — and it is its own small increment rather
  than a drive-by change to the picker: the fix has to make the literals
  extractable *and* call `__()` at render time, since the commands array is built
  at import time, before `translationPlugin` installs `window.__`.

  **Fixed (2026-10-13) as its own increment.** `SLASH_COMMANDS` became a lazy
  `slashCommands()` builder, so `__()` wraps each label where the label is written
  (the extractor sees it) while the array is still built on first use, after the
  catalog is installed. `keywords` stay in the source language, so "mermaid" and
  "snippet" keep finding their commands once the labels turn Chinese. The three
  consumers moved with it: `filterCommands`, `WikiEditor.vue` and
  `mermaid-block.test.js`.

  Wrapping the labels exposed **the same class of gap in the editor toolbar**,
  including the two maths buttons this spec's predecessor added: nine `label:` 
  literals in `WikiToolbar.vue` were invisible to the extractor. Those sit inside
  `<script setup>`, which runs after `translationPlugin`, so they only needed
  `__()` around them — no builder. 31 labels are now translatable in total
  (24 from the slash menu, 7 new from the toolbar; `Task List` and `Code Block`
  were already entries, which is a useful cross-check that the two menus share
  msgids). Catalog: 943/943.

  What this does *not* yet fix is the general case: any component that writes a
  visible literal into a plain object (`label: '…'`, `title: '…'`) escapes
  extraction silently. The guard only sees strings that reach `main.pot`, so it
  cannot catch a string that never gets there. A lint or a test that flags
  suspicious literals in `frontend/src` would close that hole properly and is worth
  its own small spec.
