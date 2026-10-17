"""Single-page exports.

The space-level ZIP (content + attachments) already exists in
``wiki/api/zip_export.py``; this adds the one-page download people reach for when
they want to take a page into another tool.
"""

from __future__ import annotations

import re

import frappe
from frappe import _


def _readable_doc(docname: str):
	from wiki.page_access import can_read

	doc = frappe.get_doc("Wiki Document", docname)
	if not can_read(doc):
		frappe.throw(_("Page not found"), frappe.DoesNotExistError)
	return doc


def _filename(title: str, fallback: str) -> str:
	slug = re.sub(r"[^\w一-鿿-]+", "-", (title or "").strip(), flags=re.UNICODE).strip("-")
	return (slug[:80] or fallback) + ".md"


@frappe.whitelist()
def page_markdown(docname: str) -> None:
	"""Download one page as Markdown, with its title as the heading."""
	doc = _readable_doc(docname)
	body = f"# {doc.title}\n\n{(doc.content or '').rstrip()}\n"
	frappe.response["type"] = "download"
	frappe.response["filename"] = _filename(doc.title, doc.name)
	frappe.response["content_type"] = "text/markdown; charset=utf-8"
	frappe.response["filecontent"] = body
