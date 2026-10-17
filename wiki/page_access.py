"""Per-page access on top of the space's role gate.

A page is either ``Inherit`` (the default) or ``Restricted``. A restricted page
answers for itself and, because children walk up to their nearest restricted
ancestor, for its whole subtree. Levels mirror Alexandrie's model:

    Read   open the page
    Write  edit it (implies Read)
    Admin  manage access entries and the public link (implies Write)

Pages that inherit fall through to the space's existing roles, so every page
created before this model keeps its current behaviour.
"""

from __future__ import annotations

import frappe

from wiki.permissions import MANAGER_ROLES, can_read_space, can_write_space

READ, WRITE, ADMIN = 1, 2, 3
LEVEL_BY_NAME = {"Read": READ, "Write": WRITE, "Admin": ADMIN}


def _roles_of(user: str) -> set[str]:
	return set(frappe.get_roles(user))


def _entry_level(entry, user: str) -> int:
	level = LEVEL_BY_NAME.get(entry.get("level"), 0)
	if not level:
		return 0
	if entry.get("subject_type") == "User":
		return level if entry.get("user") == user else 0
	return level if entry.get("role") in _roles_of(user) else 0


def _restricted_ancestor(doc):
	"""The nearest page at or above ``doc`` that opts out of inheritance."""
	node = doc
	seen: set[str] = set()
	while node is not None:
		name = node.get("name")
		if name in seen:  # a corrupt tree must not loop forever
			return None
		seen.add(name)
		if (node.get("access_mode") or "Inherit") == "Restricted":
			return node
		parent = node.get("parent_wiki_document")
		node = frappe.get_cached_doc("Wiki Document", parent) if parent else None
	return None


def level_for(doc, user: str | None = None) -> int:
	"""The strongest level ``user`` holds on ``doc``: 0, Read, Write or Admin."""
	user = user or frappe.session.user
	if user == "Administrator" or (MANAGER_ROLES & _roles_of(user)):
		return ADMIN

	gate = _restricted_ancestor(doc)
	if gate is not None:
		return max(
			(_entry_level(entry, user) for entry in (gate.get("access_entries") or [])),
			default=0,
		)

	space = doc.get("wiki_space")
	if not space:
		return READ  # orphan pages stay readable, as before
	if can_write_space(space, user):
		return WRITE
	if can_read_space(space, user):
		return READ
	return 0


def can_read(doc, user: str | None = None) -> bool:
	return level_for(doc, user) >= READ


def can_write(doc, user: str | None = None) -> bool:
	return level_for(doc, user) >= WRITE


def can_admin(doc, user: str | None = None) -> bool:
	return level_for(doc, user) >= ADMIN


# ---------------------------------------------------------------------------
# Public share links
# ---------------------------------------------------------------------------


def ensure_share_token(doc) -> str:
	"""Return this page's share token, creating one the first time it is shared."""
	if doc.get("share_token"):
		return doc.share_token
	token = frappe.generate_hash(length=32)
	frappe.db.set_value("Wiki Document", doc.name, "share_token", token, update_modified=False)
	doc.share_token = token
	return token


def page_for_token(token: str):
	"""The page a share token points at, or None. Only explicitly shared pages count."""
	if not token:
		return None
	name = frappe.db.get_value(
		"Wiki Document",
		{"share_token": token, "enable_public_link": 1},
		"name",
	)
	return frappe.get_doc("Wiki Document", name) if name else None


def record_share_visit(doc, token: str, ip: str = "") -> None:
	"""Append an access-log row; never let auditing break the page itself.

	Commits on its own: a public page is usually a GET, and Frappe does not commit
	the request transaction for reads, so without this the row is silently rolled
	back when the response finishes.
	"""
	try:
		frappe.get_doc(
			{
				"doctype": "Wiki Share Access",
				"wiki_document": doc.name,
				"token": token,
				"ip_address": ip or getattr(frappe.local, "request_ip", "") or "",
				"user": frappe.session.user,
			}
		).insert(ignore_permissions=True)
		frappe.db.commit()
	except Exception:
		frappe.db.rollback()
		frappe.log_error(title="Wiki share access log failed")
