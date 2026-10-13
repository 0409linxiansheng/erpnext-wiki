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

**Phase 0 — evidence.** Add `babel_extractors.csv` (start from
`wlh_translate`'s, minus its app-specific `dock` / `hd_view` rules unless they
apply). Run `generate-pot-file --app wiki`. Record the real string count and any
extractor that cannot read a surface (the SPA's `.vue` templates are the risk).

**Phase 1 — catalog.** `create-po-file zh --app wiki`, then `compile-po-to-mo`
and confirm the chain end to end with a handful of hand-translated strings: change
one, compile, see it on the site. Do not translate 1100 strings before the pipe is
proven.

**Phase 2 — translate.** Fill `zh.po`. Assert nothing; this is content.

**Phase 3 — prove it.** A test that fails if the catalog rots: every `msgid` that
the extractor finds has a `msgstr` (or an explicit, listed exception). Without it,
new English strings creep back in and nobody notices.

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
