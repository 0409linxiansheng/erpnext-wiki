"""Read and edit a page's access entries from the app UI.

The model itself lives in :mod:`wiki.page_access`; this module is the thin API
the settings dialog talks to, plus the validation that keeps a hand-edited
request from writing a level or subject the resolver cannot understand.
"""

from __future__ import annotations

import frappe
from frappe import _

VALID_MODES = ("Inherit", "Restricted")
VALID_LEVELS = ("Read", "Write", "Admin")


def _clean_entries(entries) -> list[dict]:
	cleaned: list[dict] = []
	for row in entries or []:
		if not isinstance(row, dict):
			frappe.throw(_("Invalid access entry."), frappe.ValidationError)
		subject_type = row.get("subject_type") or "Role"
		level = row.get("level") or "Read"
		if subject_type not in ("Role", "User"):
			frappe.throw(_("Access entries are for a role or a person."), frappe.ValidationError)
		if level not in VALID_LEVELS:
			frappe.throw(_("Unknown access level."), frappe.ValidationError)

		if subject_type == "Role":
			role = (row.get("role") or "").strip()
			if not role or not frappe.db.exists("Role", role):
				frappe.throw(_("Pick an existing role."), frappe.ValidationError)
			cleaned.append({"subject_type": "Role", "role": role, "level": level})
		else:
			user = (row.get("user") or "").strip()
			if not user or not frappe.db.exists("User", user):
				frappe.throw(_("Pick an existing user."), frappe.ValidationError)
			cleaned.append({"subject_type": "User", "user": user, "level": level})
	return cleaned


@frappe.whitelist()
def get_page_access(docname: str) -> dict:
	from wiki.page_access import can_admin

	doc = frappe.get_doc("Wiki Document", docname)
	return {
		"mode": doc.get("access_mode") or "Inherit",
		"entries": [
			{
				"subject_type": entry.subject_type,
				"role": entry.role or "",
				"user": entry.user or "",
				"level": entry.level,
			}
			for entry in (doc.get("access_entries") or [])
		],
		"can_edit": can_admin(doc),
	}


@frappe.whitelist()
def update_page_access(docname: str, mode: str, entries=None) -> dict:
	from wiki.page_access import can_admin

	doc = frappe.get_doc("Wiki Document", docname)
	if not can_admin(doc):
		frappe.throw(_("You are not allowed to change access for this page."), frappe.PermissionError)
	if mode not in VALID_MODES:
		frappe.throw(_("Unknown access mode."), frappe.ValidationError)

	cleaned = _clean_entries(entries)
	if mode == "Restricted" and not cleaned:
		frappe.throw(
			_("Add at least one role or person, or keep the page inheriting its space."),
			frappe.ValidationError,
		)

	doc.access_mode = mode
	doc.set("access_entries", cleaned)
	doc.save(ignore_permissions=True)
	frappe.db.commit()
	return get_page_access(docname)
