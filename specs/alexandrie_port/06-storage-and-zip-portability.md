# Storage and ZIP portability (Alexandrie port, spec 06)

Date: 2026-10-13
Status: **Spec — planned.** Program index: [README.md](README.md). No dependency on
the other open specs.

## Problem

Three related gaps sit behind "storage/portability" in the program:

1. The wiki can show images, video, PDFs and iframes, but nothing else. Alexandrie
   previews a wide spread of file types; here an audio file or a `.md`/`.py`
   upload has no in-page preview at all.
2. There is no way to lift a whole space out of one install and set it down in
   another — the "portable wiki" property the user cares about. Migration today is
   the `Migrate To Wiki` doctype, which imports from a live source, not from a
   file a user can hand around.
3. Storage is on the local filesystem. Frappe's File backend can already be S3;
   the gap is configuration plus a migration path for files that already live on
   disk, not app code.

## Phase 0 — evidence (2026-10-13)

- **File backend is local.** Neither `erp.local/site_config.json` nor
  `common_site_config.json` sets `file_backends`, so Frappe stores files under
  `sites/<site>/private/files` and `public/files`.
- **The editor has four media nodes, each with its own picker.** `image-extension.js`
  (image), `video-block.js`, `pdf-block.js`, `iframe-block.js`. There is no generic
  "attach a file" path, so an audio file or a text/code file cannot even be
  uploaded from the editor today.
- **`Migrate To Wiki` exists** (migration from a live source), so ZIP import has a
  natural neighbour but no overlap — it is file-based, not source-based.

## Decisions

1. **S3 is configuration and documentation, not app code.** Frappe's File backend
   is already pluggable (`file_backends` in site config). The spec ships a
   runbook (site config + how to migrate existing local files to the bucket) and,
   only if Frappe lacks it, a small migration command. No DocType or hook changes.
2. **One generic "attach file" path, not a picker per type.** A toolbar item
   uploads any file and renders a preview by MIME: `audio/*` → an audio element,
   `text/*` and known code types → the fetched text (syntax-highlighted when the
   type is known), everything else → a download link. The existing image/video/PDF
   pickers stay; they are shortcuts into the same preview.
3. **ZIP export/import is space-scoped and self-contained.** The ZIP carries a
   manifest (space name/route/logo/settings), the document tree (parent/child,
   routes, content, is_published, timestamps), revisions are **excluded** (they
   are history, not content), and attachments (File records referenced from
   content, bundled by content hash). Import re-creates the tree and remaps
   routes on collision instead of failing.
4. **Export is read-only and import is idempotent-ish but not merge-aware.** Import
   into an empty space only in v1; importing over an existing space is rejected
   with a clear error rather than half-applied. Merging two histories is CR
   territory, not this spec.

## Surfaces

| Surface | Change |
| --- | --- |
| Editor | "Attach file" toolbar item; audio + text/code node views |
| Public reader | audio + text/code preview render |
| Print | audio → a caption link; text/code → the fetched text as a `<pre>` (no audio in paper) |
| API | `wiki.api.zip_export.export_space`, `wiki.api.zip_import.import_space` |
| Storage | S3 runbook in the spec (no code unless a migration command is missing) |

## Phases (tracer bullets)

**Phase 1 — attach + preview.** Generic file upload from the toolbar; preview by
MIME (audio, text/code highlighted, fallback download link); markdown round-trip
for the new node; the public reader and print render the same thing.

**Phase 2 — ZIP export.** A space's tree, routes, content, metadata and its
attachments into one ZIP, deterministic ordering, a manifest that import can read
back. Test: round-trip the exported bytes.

**Phase 3 — ZIP import.** Re-create the tree and routes, remap on collision,
restore attachments, reject importing over a non-empty space. Test: export → wipe
→ import → compare.

**Phase 4 — S3 runbook.** Site-config snippet, the migrate-existing-files steps,
and (if Frappe lacks one) a `migrate_files_to_backend` command. Verified by
documentation review, not by provisioning a bucket here.

## Out of scope

- Merge-aware import into a live space.
- Revision history in the ZIP.
- Provisioning an actual S3 bucket in this environment (the runbook is the
  deliverable; pointing the site at a bucket is an ops action).
- Multi-tenant team/workspace packaging (that whole area is out of scope).

## Reconciliation log

**Phase 0** — evidence above; decisions recorded. S3 demoted from "medium code" to
"runbook" because Frappe's backend is already pluggable and there is nothing to
build but the switch-over procedure; the real code is attach/preview and the ZIP
round-trip.

**Phase 1, first slice — DONE (2026-10-13): the reader and print surfaces.**

`markdown.py` now renders full-line `![name](url)` for the file types that used to
produce a broken `<img>`: `audio/*` → a native `<audio>` player, text/code
extensions → a text preview block, and any other URL with an extension → a
download card. Image/video/PDF still win (regression-pinned), and an extensionless
URL is left alone so a remote imageless image is never hijacked.

The renderer stays a **pure function** — it cannot read the file at render time —
so the text itself is fetched client-side by `public/js/text-file-preview.js`
(the same lazy/MutationObserver pattern as pdf-viewer.js), which fills the
`<code>` and highlights it with the reader's existing highlight.js. The filename +
download link is the no-JS/print fallback. 113 markdown unit tests green.

The editor side (attach-from-toolbar, the optimistic upload flow, the node view)
is the next slice; until it lands, a text/audio/file is already correctly rendered
anywhere a `![name](url)` reaches the reader.
