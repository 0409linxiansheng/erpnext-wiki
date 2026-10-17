import frappe

from wiki.page_access import page_for_token, record_share_visit
from wiki.wiki.markdown import render_markdown_with_toc

no_cache = 1
sitemap = 0


def get_context(context):
	token = frappe.form_dict.get("token") or ""
	doc = page_for_token(token)
	if doc is None or not doc.is_published:
		frappe.local.flags.redirect_location = "/404"
		raise frappe.Redirect

	record_share_visit(doc, token)
	html, _toc = render_markdown_with_toc(doc.content or "")

	context.no_cache = 1
	context.page_title = doc.title
	context.shared = {
		"title": doc.title,
		"html": html,
		"description": doc.meta_description or "",
		"modified": frappe.utils.format_datetime(doc.modified, "medium"),
	}
	return context
