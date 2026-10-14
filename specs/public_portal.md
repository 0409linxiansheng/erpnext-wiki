# Public portal and public visibility

Date: 2026-10-14
Status: **Spec — planned.** A new feature, not part of the Alexandrie port. Scope
agreed with the owner in discussion on 2026-10-14.

## Problem

The wiki is built for signed-in readers. An anonymous visitor gets a 404 for every
page, and the site root is Frappe's login page — so an external customer sees a
login box and nothing else. The owner needs the opposite: a public-facing portal
where customers browse public spaces and public documents with no account, and the
portal itself is customizable.

## Phase 0 — evidence (2026-10-14, verified live)

- **No landing page exists.** `/` serves Frappe's login page (`<title>` is Login).
  `home_page` is commented out in `hooks.py`, and `website_route_rules` only routes
  the SPA.
- **Anonymous access is refused for every page.** `/<space.route>/<page.route>`
  returns **404 for a guest** and **200 for a signed-in user**, on the same URL.
- **Root cause** — `wiki/permissions.py::can_read_space`: a space with **no role
  rows** (the code's "open space") returns `user != "Guest"`. "Open" therefore means
  *signed-in only*, and an anonymous guest is always refused. This is the app's
  design, not a misconfiguration.
- **Counter-test confirming the mechanism**: adding one
  `Wiki Space Role{role: Guest, permission_level: Read}` to a space flipped the guest
  response 404 → 200; deleting it flipped it back. The diagnostic file and the data
  change were both reverted.
- **Test gap, stated precisely.** The e2e case named "renders the diagram as inline
  SVG on the public page" runs in an authenticated browser context, so that case
  never covered anonymous access. The repo *does* have real anonymous coverage in
  `accept-contributions.spec.ts`, but it publishes a space the legacy way — an
  explicit `Guest` role row — which is exactly the path this spec must not break.
- **Reusable material already present**: space display fields (`light_mode_logo`,
  `dark_mode_logo`, `favicon`, `space_color`, `space_icon`, `avatar`,
  `home_tab_title`, `home_tab_icon`), `Wiki Settings` (`default_wiki_space`,
  `head_html`, `javascript`), the reader's Jinja layout, OG image generation,
  `sitemap.xml`, `llms.txt`, and a guest-accessible full-text search endpoint
  (`allow_guest=True`) that already filters by space readability.

## Decisions

1. **`Wiki Space.visibility` is an explicit three-state field**, default
   `Logged in`. **Role rows are themselves a gate**: a space that names roles is
   restricted to them (this is exactly the pre-visibility behaviour, and what keeps
   the legacy `Guest` row working). The three states decide the **role-less** case:
   - `Private` — wiki managers only.
   - `Logged in` — any signed-in user (today's "no role rows" behaviour).
   - `Public` — anyone, anonymous guests included; it also overrides role rows.
2. **The migration preserves today's behaviour exactly.** Spaces with role rows
   become `Private`; spaces without become `Logged in`. Nothing becomes public
   implicitly — `Public` is opt-in per space.
3. **Visibility is the space gate; `is_published` stays the page gate.** A `Public`
   space still exposes only its published pages, so drafts can live inside a public
   space. (Confirmed with the owner.)
4. **Writing is unaffected.** `can_write_space` keeps its current role logic;
   visibility governs reading only.
5. **The portal lives at `/portal`**, not the site root — the owner is building a
   separate marketing site at `/`. The route is reserved: a space whose `route` is
   `portal` must not shadow it (and must not be creatable/renamable to it).
6. **Customization starts structured** — a single `Wiki Portal` document (hero
   title, subtitle, logo, theme colour, featured spaces with order, footer). A
   "portal-as-a-wiki-page with dynamic blocks" mode may follow later.
7. **Public spaces get a directory page** at their own route when no page occupies
   it: instead of today's 302 to the first page, a public space lists its published
   pages. Non-public spaces keep the 302, so nothing existing changes.

## Surfaces

| Surface | Change |
| --- | --- |
| Backend | `Wiki Space.visibility` + migration patch; `can_read_space` consults it |
| Public API | guest-accessible `get_public_spaces()` returning only public spaces |
| Public portal | `www/portal.py` + `www/portal.html`, listing public spaces |
| Customization | `Wiki Portal` single doctype (Desk form) + fallbacks in the portal |
| Space directory | `WikiDocumentRenderer` renders a listing for a public space route |
| Search / crawler | already gate on space readability, so they follow automatically |
| e2e | a **true anonymous** case — the gap this spec also exists to close |

## Phases

**Phase 1 — public readability.** `visibility` + migration patch + `can_read_space`,
a guest-accessible `get_public_spaces()`, and an anonymous-guest e2e proving a
`Public` space's page is readable while a `Logged in` space's is not. Commit.

**Phase 2 — minimal portal.** `/portal` lists public spaces as cards (logo, name,
description, published-page count), reusing the reader layout, with an empty state
when nothing is public. Commit.

**Phase 3 — structured customization.** `Wiki Portal` single doctype; the portal
reads hero/featured/footer from it with sensible fallbacks. Commit.

**Phase 4 — space directory + crawler.** A public space's own route renders a
directory when no page owns it; confirm `sitemap.xml` / `llms.txt` include public
spaces. Commit.

## Out of scope

- Taking over the site root `/` (the owner is building a separate site there).
- A per-page visibility override (page-level `is_published` already covers it).
- Anonymous comments/feedback (the feedback flow stays signed-in).
- Portal theming beyond the `Wiki Portal` fields.
- The two specs still blocked from the Alexandrie port (05 ACL, 08 PWA).

## Reconciliation log

**Phase 0** — evidence above, all verified on the live site; the diagnostic module
and its data change were reverted. The gap is structural: the app has no "public"
state at all, which is why a landing page cannot mean anything until a visibility
model exists.

**Phase 1 — DONE (2026-10-14).** `Wiki Space.visibility` (Private / Logged in /
Public, default Logged in) with a behaviour-preserving migration patch (spaces with
role rows → Private, without → Logged in); `can_read_space` rewritten around
visibility with role rows as the gate; a guest-accessible `get_public_spaces()` and a
`set_space_visibility()` API; a Visibility select in the space settings panel; 8
plain-unittest cases; and a **true anonymous** e2e (3 cases) that opens a logged-out
browser context. Verified live: guest 404 → **200** when a space flips to `Public`,
and back to 404. Regression: 24 e2e green across the public/access/space specs,
including `accept-contributions` (the legacy Guest row) and `space-default-page`.

**Two traps found the hard way, both worth keeping:**

- **Frappe defaults an unset `Select` to its *first option*.** The first design
  derived `Private`/`Logged in` from the role rows when the field was empty — which
  never happens, because the column comes back pre-filled with whatever option is
  listed first. The field now carries an explicit default and there is no
  derive-on-insert; the semantics above replaced that idea.
- **`accept-contributions.spec.ts` publishes spaces with a `Guest` role row.** An
  early version of `can_read_space` returned early on `Logged in` and silently
  ignored that grant, which would have broken a passing spec. Role grants are
  therefore checked before the visibility switch, and a unit case pins it.

**Phase 2 — DONE (2026-10-14).** `/portal` is a Jinja page (`wiki/www/portal.py` +
`portal.html`) that extends the **reader's layout** with `hide_chrome` set: the
reader's sidebar is a per-page tree, which means nothing on a landing page, while
the layout still brings the theme, fonts and asset pipeline. It lists
`get_public_spaces()` — the same guest API Phase 1 added — as cards that reuse the
reader's `render_space_mark` macro, so a space's mark on the portal is the same mark
it shows everywhere else (the macro and `SpaceAvatar.vue` already agree by design).
An empty state covers "nothing published yet".

Verified as a **logged-out** visitor: the card shows the space name and its page
count, clicking it lands on the space, and a non-public space never appears. 28 e2e
green across the portal, public, sidebar and wiki suites. The four new strings are
extracted and left untranslated under the bulk-translation workflow.

Two things deliberately not done yet: the portal is not linked from anywhere (the
reader's header is Phase 4's business), and `sitemap = 1` is set on the page but the
wiki's own `/sitemap.xml` renderer takes over that path, so whether the portal and
the public spaces appear there is Phase 4's check, not an assumption.

**Phase 3 — DONE (2026-10-14).** The portal is configurable from a `Wiki Portal`
single: heading, subtitle, logo, an accent colour drawn from the same six-colour
wiki palette the space marks use, a `Featured Spaces` child table whose row order is
the display order, `show all public spaces` (off = featured only), and a footer line.
Access mirrors `Wiki Settings` (System Manager + Wiki Approver).

The rules live in `wiki/wiki/portal_config.py` — pure, so they are unit-tested (7
cases) rather than read out of Jinja: featured spaces lead in row order, a featured
space that is **not** public is dropped (the portal must never advertise something a
visitor cannot open), duplicates collapse, `show all` off narrows the list to the
featured ones, and a blank field falls back. The fallback heading and subtitle are
**passed in** by `portal.py`, already translated, instead of being English literals
buried in a module that has no language context.

Verified live (a configured heading, subtitle and footer rendered on `/portal`, then
reverted) and by e2e: the config drives the page, and that case restores the config
in its `finally` so the suite leaves the install as it found it. 31 e2e green across
the portal, public, settings, sidebar and wiki suites.

**Phase 4 — DONE (2026-10-14).** A public space's own route now serves a browsable
directory (`templates/wiki/space_directory.html`: the space's mark and name, then its
published pages in tree order with groups as headings) instead of bouncing to the
first page. `can_render` claims the route only when **no page occupies it** and the
space is `Public`, so a non-public space keeps the redirect a signed-in reader
already expects — verified live: `/docs` is a 302 for `Logged in` and a 200 directory
listing 7 pages for `Public`, back to 302 after reverting. A draft inside a public
space stays out of the directory, exactly as it stays out of the reader.

**The crawler question is answered, not assumed.** `sitemap.py` builds its wiki
links from `public_spaces()`, and `llms_txt.py` drives that from
`can_read_space(space, "Guest")` — the same gate Phase 1 rewrote. So public spaces
flow into both with no further change, which the live check confirmed: with the
space flipped to `Public`, `/sitemap.xml` listed its 7 pages and `/llms.txt` listed
the space; `/portal` itself is in the sitemap through its `sitemap = 1`.

One consequence worth naming: the portal's cards link to the space route, which for
a public space is now the directory — a visitor lands on the contents rather than
being bounced straight into a page.

Housekeeping: two stray spaces left behind by the Phase-1 diagnostic were deleted,
leaving only the three real ones.

**Post-Phase-3 — the config moved into the app's own settings (2026-10-14).** The
owner asked for it there rather than in the Desk, so the settings dialog gained a
**Portal** tab (`WikiSettings/PortalPanel.vue`, between General and Feedback):
heading, subheading, logo upload, accent colour, footer line, list-everything, and a
featured-spaces list with add / remove / move-up / move-down. It saves through
`wiki.api.wiki_portal.update_portal_settings`, which re-checks that every featured
space is still `Public` — so what is stored can never disagree with what the portal
can show — and refuses to write without write permission on the single. The Desk form
still exists and is untouched; it is now the fallback rather than the way in.

**A bug this exposed in my own tests.** The e2e that drives the config used to blank
it in its `finally`, which would have wiped the owner's own text (they had already
edited the single by hand from the Desk — the reason they asked for the panel). It
now snapshots the single with `getDoc` and restores exactly the fields it changed.
Verified afterwards: the owner's configuration is byte-identical to the snapshot
taken before the run. Any future test that writes a global single must do the same.
