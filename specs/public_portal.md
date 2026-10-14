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
- **Test gap.** The e2e case named "renders the diagram as inline SVG on the public
  page" runs in an authenticated browser context, so anonymous access has never been
  covered. That is why this went unnoticed.
- **Reusable material already present**: space display fields (`light_mode_logo`,
  `dark_mode_logo`, `favicon`, `space_color`, `space_icon`, `avatar`,
  `home_tab_title`, `home_tab_icon`), `Wiki Settings` (`default_wiki_space`,
  `head_html`, `javascript`), the reader's Jinja layout, OG image generation,
  `sitemap.xml`, `llms.txt`, and a guest-accessible full-text search endpoint
  (`allow_guest=True`) that already filters by space readability.

## Decisions

1. **`Wiki Space.visibility` is an explicit three-state field**, default
   `Logged in`:
   - `Private` — only users granted a space role (plus wiki managers).
   - `Logged in` — any signed-in user (today's "no role rows" behaviour).
   - `Public` — anyone, anonymous guests included.
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
