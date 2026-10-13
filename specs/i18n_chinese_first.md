# Chinese-first i18n (and the test-language contract)

Date: 2026-10-13
Status: **Spec — planned.** Nothing in this file is built yet.

## Problem

This app ships **no translations at all**: there is no `wiki/locale/`, no
`babel_extractors.csv`, no `.po` anywhere. Every string is wrapped in `__()` /
`_()` and every one of them renders as English. On a Chinese-first deployment
that is the single most visible defect the app has.

Two things make it more than a translation chore:

1. **The extraction rules do not exist yet.** The SPA is Vue + TS, and much of
   the user-visible text lives in `.vue` templates, `.ts` helpers and record
   JSON. Frappe's stock extractors do not read `.vue`/`.ts` — the sibling app
   `wlh_translate` had to add extractors for exactly this (`babel_extractors.csv`
   at the app root, read by `frappe/gettext/translate.py`).
2. **The e2e suite is written against an English UI.** 61 specs assert English
   labels (`getByLabel('Title')`, `getByRole('button', { name: 'Save' })`). On a
   `zh` site they fail systematically, before any product code is involved. This
   is not hypothetical: the first run of `math.spec.ts` on this site failed 5 of
   8 tests purely because the dialog said `标题` / `保存`.

## Goal

Chinese is the primary language of the product: a user who sets their language to
`zh` sees no English left in the wiki's own surfaces. Other languages stay
possible — adding one is dropping a `.po` next to `zh.po`, not editing code.

## Decisions

- **Translations live in this app** (`wiki/locale/zh.po`, compiled to
  `sites/assets/locale/zh/LC_MESSAGES/wiki.mo`). Not in an aggregator app: this
  is a product, and a product carries its own language files. `wlh_translate`
  stays useful as the *extraction engine* whose rules we borrow, not as the
  storage of record.
- **No language logic in code.** No `if lang == 'zh'`, no hardcoded Chinese. The
  mechanism is Frappe's standard `.po` → `.mo` chain, so a second language is
  additive.
- **DocType labels are included.** JSON field labels are user-visible in the Desk
  forms and lists; they go through the same catalog.
- **The e2e suite stays English and says so.** The suite never asserts on
  translated text where a structural selector will do; where a label is
  unavoidable, the run is pinned to English by `scripts/e2e-local.sh`. Making 61
  upstream specs language-agnostic is a much larger diff than the problem
  justifies, and it would fight upstream forever.

## Mechanism (verified against frappe 16.51.0)

| Step | Command |
| --- | --- |
| Extract every string in the app | `bench generate-pot-file --app wiki` → `wiki/locale/main.pot` |
| Create the locale catalog | `bench create-po-file zh --app wiki` → `wiki/locale/zh.po` |
| Merge new strings into the catalog | `bench update-po-files --app wiki --locale zh` |
| Compile | `bench compile-po-to-mo --app wiki --locale zh` |
| SPA | `frontend/src/translation.js` already reads `window.translatedMessages` from the boot payload, which frappe fills from every installed app's `.mo` — no frontend change needed once the catalog exists. |

Extraction is driven by `babel_extractors.csv` at the app root
(`frappe/gettext/translate.py` resolves it as
`Path(frappe.get_app_path(app)).parent / "babel_extractors.csv"`).

Inventory before extraction (rough): ~119 Python `_()` calls, ~740 `__()`/`$t()`
in `frontend/src`, ~240 DocType field labels, plus workspace/sidebar/dock record
JSON.

## Phases

**Phase 0 — evidence — DONE (2026-10-13).** No custom `babel_extractors.csv`
was needed; frappe's stock rules already cover every surface this app has. The
catalog is **899 entries with zero junk**. See the reconciliation log.

**Phase 1 — catalog.** `create-po-file zh --app wiki`, then `compile-po-to-mo`
and confirm the chain end to end with a handful of hand-translated strings: change
one, compile, see it on the site. Do not translate 1100 strings before the pipe is
proven.

**Phase 2 — translate — DONE (2026-10-13).** All 899 entries are accounted
for: 898 translated and 1 explicitly marked keep-as-is (a pure HTML snippet with
no prose). Delivered in six batches of ~150, each compiled and committed as it
landed, so the site never sat on a half-applied catalog.

**Phase 3 — prove it — DONE (2026-10-13).**
`wiki/wiki/test_i18n_coverage.py` asserts that every `msgid` in `main.pot` has a
`msgstr` in `zh.po`, and that no translation is orphaned (its source string gone).
Both directions were verified by breaking them: blanking one entry fails the run,
restoring it passes.

Entries that must stay English are marked `msgstr == msgid` rather than listed in
an allowlist — the marker travels with the entry, so it cannot rot separately.
The one piece of discipline left is regenerating `main.pot`
(`bench generate-pot-file --app wiki`) when strings change; the test then names
exactly what is new and untranslated.

**Phase 4 — the second language is possible.** `create-po-file de` (or any code)
produces a working catalog with no code change. This is the actual acceptance test
for "other languages later".

## Tests

- `scripts/e2e-local.sh` — runs Playwright with the site language pinned to `en`
  and restores the previous language on exit, success or failure. This is what
  keeps the English suite honest on a Chinese site.
- Phase 3 coverage test (Python, no browser).

## Out of scope

- Translating *content* (wiki pages). This is the interface only.
- Machine-translation quality review of the German/other catalogs — they only have
  to load.
- The Desk's own translations (frappe/erpnext) — those are the other apps' job and
  are already handled by `wlh_translate`.

## Reconciliation log

**Phase 0 — evidence (2026-10-13).**

- Extraction runs on frappe 16.51.0:
  `bench --site erp.local generate-pot-file --app wiki`.
- **No custom `babel_extractors.csv` is needed.** frappe's stock rules already
  cover every surface here — `**.vue` and `**.html` via
  `frappe.gettext.extractors.html_template`, `**.js`, `**.py`, `**/hooks.py`
  (navbar), `**/doctype/*/*.json`, `**/workspace/*/*.json`,
  `**/desktop_icon/*.json`, `**/report/*/*.json`, `**/fixtures/custom_field.json`.
  The SPA contains no `.ts`/`.tsx` at all, so the TS rules `wlh_translate` carries
  have nothing to do.
- The one JSON the stock rules miss is
  `wiki/frappe_wiki/print_format/standard_wiki_document/standard_wiki_document.json`.
  Its only user-visible string is the record `name` (`Standard Wiki Document`),
  which is a record name and belongs to the Translation doctype, not to gettext.
  Left out deliberately — extraction is not the tool for record names.
- `generate_pot` filters directories through `repo.ignored(...)`, so `.gitignore`
  keeps `frontend/node_modules/` and the built `wiki/public/frontend/` out of the
  catalog automatically: **899 entries, no minified-bundle junk**. That failure
  mode is exactly what polluted `wlh_translate` — it walks with its own filter and
  has to enumerate build outputs by hand.
- Inventory by area: `frontend/src` 731 references (the SPA is the bulk),
  `wiki/wiki` 306, `wiki/frappe_wiki` 199, `wiki/templates` 66, `wiki/api` 20.
- **Pipeline proven end to end on both runtime paths**, with five strings from four
  surfaces: `New Space` (SPA), `Space Name` (DocType label), `You don't have
  permission to edit this page` (Python), and `Copy page` / `Download` (server-side
  Jinja templates).
  - *SPA path:* after `compile-po-to-mo`, all five came back from
    `GET /api/method/wiki.api.get_translations` — the exact endpoint
    `frontend/src/translation.js` reads. That endpoint returns the raw catalog
    (`get_all_translations(language)`), so it proves loading, not `_()` resolution.
  - *Server-rendered path:* `GET /docs/welcome-to-frappe-wiki` served as a `zh` user
    contains `复制页面` in the HTML, which is `_()` resolving inside
    `wiki/templates/wiki/document.html`. This is the path a catalog that only loads
    into the SPA would silently miss.
  - Both paths read `sites/assets/locale/zh/LC_MESSAGES/wiki.mo`; without
    `compile-po-to-mo` neither sees a translation, which is the first thing to check
    when a string "does not translate".
  - `bench execute frappe._` is **not** a valid check here: outside a request there is
    no user language, so it answers with the msgid and looks like a failure.

**Phase 1 — catalog, and the first real bug it exposed (2026-10-13).**

- `bench create-po-file zh --app wiki` + `compile-po-to-mo` work as documented.
  Translations were seeded by hand and the catalog grows in batches.
- **The catalog alone did not change the rendered UI.** On `/wiki-app/spaces` a
  `zh` user still saw `Overview`, `All Spaces`, `New Space`, `Published` in
  English while `Search` / `Page` / `Spaces` were Chinese — a split that looks
  like a bad catalog and is not one.
- Cause: `frontend/src/translation.js` fired `createResource({auto: true})` from
  the plugin, and `main.js` mounted immediately after. `translate()` reads
  `window.translatedMessages`, a **plain object**, so the catalog arriving after
  the first render never triggers a re-render: every string a component resolves
  during setup keeps its msgid forever. Strings that only resolve once async data
  lands (list items, placeholders) came out Chinese — hence the split.
  `if (!window.translatedMessages) fetchTranslations()` also means the fetch is
  skipped entirely when the app is embedded in the Desk, where frappe's boot
  already set the object; only the standalone route was affected.
- Fix: `loadTranslations()` resolves once the catalog is in place and `main.js`
  mounts from `loadTranslations().finally(...)`, so a failed fetch still mounts.
- Verified: `/wiki-app/spaces` as a `zh` user now renders 全部空间 / 变更请求 /
  新建空间 / 已发布 / 最后更新 / 页面. What is still English is deliberate (the
  product name), not ours (the user name, `CTRL`), a route value (`docs`), or
  out of scope (the browser's relative timestamp, `a day ago`).
- **Lesson for the next app-specific SPA surface:** a translation that exists in
  the catalog, compiles into the `.mo`, and is present in the boot payload can
  still never reach the DOM. Check first paint, not just the payload.
