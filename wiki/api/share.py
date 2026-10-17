"""Public share links.

A page can be shared with a token that works without a session, independent of
its space's roles: the token is the credential. Access entries are ignored for
token holders on purpose - the link *is* the grant - while the page still has to
be published, and every visit is logged to `Wiki Share Access`.
"""

from __future__ import annotations

import frappe
from frappe import _

from wiki.page_access import page_for_token, record_share_visit
from wiki.wiki.markdown import render_markdown


@frappe.whitelist(allow_guest=True)
def get_shared_document(token: str) -> dict:
	"""Render a shared page for anonymous readers (SPA / API clients)."""
	doc = _resolve(token)
	html, _toc = _render(doc)
	record_share_visit(doc, token)
	return {
		"name": doc.name,
		"title": doc.title,
		"route": doc.route,
		"html": html,
		"modified": frappe.utils.format_datetime(doc.modified, "medium"),
		"description": doc.meta_description or "",
	}


def _resolve(token: str):
	doc = page_for_token(token)
	if doc is None:
		frappe.throw(_("This link is not valid."), frappe.DoesNotExistError)
	if not doc.is_published:
		frappe.throw(_("This page is not published."), frappe.DoesNotExistError)
	return doc


def _render(doc):
	from wiki.wiki.markdown import render_markdown_with_toc

	html, toc = render_markdown_with_toc(doc.content or "")
	return html, toc


def share_state(doc) -> dict:
	"""What the settings panel needs to render the share block."""
	return {
		"enabled": bool(doc.enable_public_link),
		"token": doc.share_token or "",
		"url": _share_url(doc) if doc.enable_public_link and doc.share_token else "",
	}


def _share_url(doc) -> str:
	return f"{frappe.utils.get_url()}/s/{doc.share_token}"


@frappe.whitelist()
def get_share_state(docname: str) -> dict:
	"""Sharing state for the page's share dialog."""
	from wiki.page_access import can_admin

	doc = frappe.get_doc("Wiki Document", docname)
	if not can_admin(doc):
		frappe.throw(_("You are not allowed to view sharing for this page."), frappe.PermissionError)
	return share_state(doc)


@frappe.whitelist()
def update_sharing(docname: str, enabled: bool) -> dict:
	"""Turn the public link on or off for a page the caller may administer."""
	from wiki.page_access import can_admin, ensure_share_token

	doc = frappe.get_doc("Wiki Document", docname)
	if not can_admin(doc):
		frappe.throw(_("You are not allowed to change sharing for this page."), frappe.PermissionError)

	doc.enable_public_link = 1 if int(enabled) else 0
	if doc.enable_public_link:
		doc.share_token = ensure_share_token(doc)
	doc.save(ignore_permissions=True)
	return share_state(doc)


@frappe.whitelist()
def rotate_share_link(docname: str) -> dict:
	"""Replace the token, invalidating every copy of the old link."""
	from wiki.page_access import can_admin

	doc = frappe.get_doc("Wiki Document", docname)
	if not can_admin(doc):
		frappe.throw(_("You are not allowed to change sharing for this page."), frappe.PermissionError)

	doc.share_token = frappe.generate_hash(length=32)
	doc.enable_public_link = 1
	doc.save(ignore_permissions=True)
	return share_state(doc)
