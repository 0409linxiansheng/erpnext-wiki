"""Page comments, on top of Frappe's Comment timeline.

Comments are readable by anyone who can read the page and writable by the same
people (a reader may discuss a page without editing it). ``@someone@example.com``
in the text notifies that user; the mention is notification-only, it grants no
access.
"""

from __future__ import annotations

import re

import frappe
from frappe import _

MENTION_RE = re.compile(r"@([A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,})")
MAX_LENGTH = 5000


def _readable_doc(docname: str):
	from wiki.page_access import can_read

	doc = frappe.get_doc("Wiki Document", docname)
	if not can_read(doc):
		frappe.throw(_("Page not found"), frappe.DoesNotExistError)
	return doc


def _row(comment: dict) -> dict:
	author = comment.get("comment_email") or comment.get("owner") or ""
	return {
		"name": comment.get("name"),
		"content": comment.get("content") or "",
		"author": author,
		"author_name": _display_name(author),
		"created": frappe.utils.format_datetime(comment.get("creation"), "medium"),
		"is_mine": author == frappe.session.user,
	}


def _display_name(user: str) -> str:
	if not user:
		return ""
	return frappe.db.get_value("User", user, "full_name") or user


@frappe.whitelist()
def list_comments(docname: str, limit: int = 100) -> list[dict]:
	_readable_doc(docname)
	rows = frappe.get_all(
		"Comment",
		filters={
			"reference_doctype": "Wiki Document",
			"reference_name": docname,
			"comment_type": "Comment",
		},
		fields=["name", "content", "comment_email", "owner", "creation"],
		order_by="creation asc",
		limit=max(1, min(int(limit), 500)),
	)
	return [_row(row) for row in rows]


@frappe.whitelist()
def add_comment(docname: str, content: str) -> dict:
	doc = _readable_doc(docname)
	text = (content or "").strip()
	if not text:
		frappe.throw(_("Write something first."), frappe.ValidationError)
	if len(text) > MAX_LENGTH:
		frappe.throw(_("Comments are limited to {0} characters.").format(MAX_LENGTH), frappe.ValidationError)

	comment = doc.add_comment("Comment", frappe.utils.escape_html(text))
	_notify_mentions(doc, text)
	frappe.db.commit()

	return _row(
		{
			"name": comment.name,
			"content": comment.content,
			"comment_email": comment.comment_email,
			"creation": comment.creation,
		}
	)


def _notify_mentions(doc, text: str) -> None:
	"""Notify every mentioned user who can be found; never fail the comment."""
	mentioned = {email for email in MENTION_RE.findall(text) if email != frappe.session.user}
	for email in mentioned:
		if not frappe.db.exists("User", email):
			continue
		try:
			notification = frappe.new_doc("Notification Log")
			notification.for_user = email
			notification.from_user = frappe.session.user
			notification.type = "Mention"
			notification.document_type = "Wiki Document"
			notification.document_name = doc.name
			notification.subject = _("Mentioned you in “{0}”").format(doc.title)
			notification.insert(ignore_permissions=True)
			frappe.publish_realtime(
				"wiki_page_comment",
				{"document": doc.name, "mention": email},
				user=email,
				after_commit=True,
			)
		except Exception:
			frappe.log_error(title="Wiki mention notification failed")
