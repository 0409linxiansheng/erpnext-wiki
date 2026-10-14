"""The public portal's configuration, saved from the app's own settings dialog.

The `Wiki Portal` single is the store; this is the whitelisted reader/writer the SPA
calls, because the featured-spaces child table cannot be written field-by-field.
"""

import frappe

from wiki.api.wiki_space import get_public_spaces

FIELDS = ("title", "subtitle", "logo", "accent_color", "footer_text")


def _payload() -> dict:
	doc = frappe.get_single("Wiki Portal")
	return {
		"title": doc.title or "",
		"subtitle": doc.subtitle or "",
		"logo": doc.logo or "",
		"accent_color": doc.accent_color or "",
		"show_all_spaces": bool(doc.show_all_spaces),
		"footer_text": doc.footer_text or "",
		"featured_spaces": [row.wiki_space for row in (doc.featured_spaces or [])],
	}


@frappe.whitelist()
def get_portal_settings() -> dict:
	"""The portal config, plus the public spaces it is allowed to feature."""
	return {**_payload(), "public_spaces": get_public_spaces()}


@frappe.whitelist()
def update_portal_settings(**kwargs) -> dict:
	"""Save the portal config. Restricted to whoever may write the single."""
	doc = frappe.get_single("Wiki Portal")
	doc.check_permission("write")

	for field in FIELDS:
		if field in kwargs:
			doc.set(field, kwargs.get(field) or "")

	if "show_all_spaces" in kwargs:
		doc.show_all_spaces = 1 if frappe.parse_json(kwargs["show_all_spaces"]) else 0

	if "featured_spaces" in kwargs:
		names = frappe.parse_json(kwargs["featured_spaces"]) or []
		doc.set("featured_spaces", [])
		for name in names:
			# Only spaces a visitor can actually open may be featured, so what gets
			# stored always agrees with what the portal is able to show.
			if frappe.db.get_value(
				"Wiki Space", {"name": name, "visibility": "Public", "is_published": 1}, "name"
			):
				doc.append("featured_spaces", {"wiki_space": name})

	doc.save()
	return _payload()
