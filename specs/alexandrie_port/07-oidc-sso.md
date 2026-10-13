# OIDC single sign-on (Alexandrie port, spec 07)

Date: 2026-10-14
Status: **Spec — planned.** Program index: [README.md](README.md). No dependency on
the other open specs.

## Problem

Alexandrie signs people in through OIDC against up to ten providers (including
LDAP). The wiki already rides Frappe's session, so the question is only whether
SSO reaches it — and it does, with no app code, because the SPA redirects the
unauthenticated to Frappe's login page, which already renders every configured
social-login button.

## Phase 0 — evidence (2026-10-14)

- **The wiki never sees a login form.** `frontend/src/router.js` does
  `window.location.href = '/login?redirect-to=/wiki-app…'` for an unauthenticated
  visitor, so sign-in is Frappe's `/login` page, and the OIDC buttons Frappe
  already renders there are the whole surface.
- **Frappe's SSO is the `Social Login Key` doctype.** Each record is one button:
  `social_login_provider`, the OAuth2/OIDC endpoints, `client_id`/`client_secret`,
  `auth_url_data` (where the `scope` lives), `api_endpoint` (the OIDC userinfo
  step), `user_id_property`, `sign_ups`, and `enable_social_login`.
- **OIDC is native via the built-in Keycloak provider.** Its endpoints are the
  standard `/protocol/openid-connect/{auth,token,userinfo}` and
  `user_id_property = preferred_username`, `scope = openid`.
- **Callbacks are per-provider.** `frappe.integrations.oauth2_logins` has one
  `login_via_<provider>` method per provider (google, github, keycloak, …); there
  is no generic `login_via_oauth2`. The `Custom` provider type therefore works
  only when its `redirect_url` points at an existing callback — a genuinely
  non-standard IdP would need a small hook, which is out of scope here.

## Decisions

1. **No wiki code.** The runbook configures `Social Login Key`; the wiki's login
   surface is Frappe's `/login`, which needs nothing from this app.
2. **Keycloak is the OIDC path**, and therefore the LDAP path too: LDAP is bridged
   to OIDC by Keycloak, which is how Alexandrie's "LDAP" is served, not raw LDAP.
3. **Ten providers = ten `Social Login Key` records.** Frappe shows all of them on
   `/login`; there is no artificial cap and no per-app limit to lift.
4. **The `Custom` caveat is recorded, not worked around.** If a future IdP does not
   follow the Keycloak endpoint shape, a `login_via_*` callback belongs in this
   app's hooks — a small, well-understood addition that is deliberately not built
   now because the built-in provider already covers the standard OIDC case.

## Runbook (Keycloak, then the general case)

**One-time site switch.** System Settings → enable social login (Frappe only renders
the buttons when `enable_social_login` is on for at least one key).

**Keycloak.** New `Social Login Key`, provider `Keycloak`, then:

- `base_url` = `https://<keycloak>/auth/realms/<realm>/` (the `custom_base_url`
  checkbox lets you point at your realm)
- `client_id` / `client_secret` from the Keycloak client
- `redirect_url` = `/api/method/frappe.integrations.oauth2_logins.login_via_keycloak`
  (also register this full URL as a valid redirect URI in the Keycloak client)
- `auth_url_data` = `{"response_type": "code", "scope": "openid profile email"}`
- `api_endpoint` = `/protocol/openid-connect/userinfo`, `user_id_property` =
  `preferred_username` (or `sub`)
- `sign_ups` = whether a first-time SSO user is provisioned automatically

**LDAP.** Point Keycloak's user federation at the directory; nothing about the
wiki side changes.

**Another standard OIDC IdP** (Auth0/Okta/Authentik) that exposes
`/protocol/openid-connect/*` can reuse the Keycloak provider type with its own
`base_url`; the endpoints are the same shape.

**Multiple providers.** One `Social Login Key` per provider; `/login` renders them
all.

## Surfaces

| Surface | Change |
| --- | --- |
| Login | none — Frappe `/login` already renders the buttons |
| Wiki app | none |
| Config | `Social Login Key` records + IdP-side client |

## Out of scope

- A generic `login_via_oauth2` callback for non-standard IdPs (recorded, not built).
- Raw LDAP (Frappe has no native LDAP; the OIDC bridge is the honest answer).
- Mapping OIDC groups/roles to wiki spaces (that is spec 05's territory, not auth).

## Reconciliation log

**Phase 0** — evidence above. This is the smallest spec in the program: the whole
feature already exists in Frappe; the deliverable is this runbook, which closes
the "configuration + docs" delta the program index assigned it.
