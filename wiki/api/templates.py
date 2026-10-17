"""Page templates offered when creating a page."""

from __future__ import annotations

import frappe


@frappe.whitelist()
def list_templates() -> list[dict]:
	"""Active templates with their body, so the create dialog seeds in one call."""
	return frappe.get_all(
		"Wiki Template",
		filters={"is_active": 1},
		fields=["name", "title", "description", "content"],
		order_by="sort_order asc, title asc",
		limit=100,
	)
