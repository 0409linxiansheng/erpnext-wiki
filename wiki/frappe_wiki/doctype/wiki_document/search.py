import frappe

from wiki.telemetry import capture


@frappe.whitelist(allow_guest=True)  # nosemgrep: frappe-semgrep-rules.rules.security.guest-whitelisted-method
def search(query: str, space: str | None = None) -> dict:
	"""
	Search wiki documents with space-scoped filtering.

	Args:
	    query: Search query string
	    space: Wiki space (root group) name to scope search

	Returns:
	    Search results with title, content snippets, and scores
	"""
	from wiki.frappe_wiki.doctype.wiki_document.wiki_sqlite_search import WikiSQLiteSearch

	if not query or not query.strip():
		return {"results": [], "total": 0}

	search_engine = WikiSQLiteSearch()
	filters = {"space": space} if space else {}

	result = search_engine.search(query, filters=filters)

	hits = _filter_hits_by_page_access(result["results"])

	capture("search_performed", interval="1d", surface="reader", hits=bool(hits))

	return {
		"results": [
			{
				"name": r["name"],
				"title": r["title"],
				"route": r.get("route", ""),
				"content": r["content"],
				"score": r["score"],
				"wiki_space": r.get("wiki_space"),
				"is_published": r.get("is_published"),
			}
			for r in hits
		],
		"total": len(hits),
	}


def _filter_hits_by_page_access(hits: list[dict]) -> list[dict]:
	"""Drop search hits the current user couldn't open as a page.

	The SQLite index is built without user context, so titles and snippets from
	restricted pages or spaces can surface here. Every hit goes through the same
	gate the page itself uses — ``page_access.can_read`` (nearest restricted
	ancestor, then the space's roles) — plus the space's published flag, so a
	page-level restriction cannot leak through search.
	"""
	from wiki.page_access import can_read

	allowed = []
	for hit in hits:
		if not frappe.db.exists("Wiki Document", hit["name"]):
			continue
		doc = frappe.get_doc("Wiki Document", hit["name"])
		if not doc.is_published or not can_read(doc):
			continue
		if doc.wiki_space and not frappe.get_cached_value("Wiki Space", doc.wiki_space, "is_published"):
			continue
		# The app-side palette needs these to route and badge a result without a
		# second round-trip per row.
		hit["wiki_space"] = doc.wiki_space
		hit["is_published"] = doc.is_published
		allowed.append(hit)
	return allowed
