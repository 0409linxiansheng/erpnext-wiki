"""Public blog: the queries and rendering shared by pages, feeds and sitemap."""

from __future__ import annotations

import frappe

from wiki.wiki.markdown import render_markdown

POST_FIELDS = (
	"name",
	"title",
	"slug",
	"excerpt",
	"content",
	"cover_image",
	"author",
	"published_on",
	"tags",
	"meta_description",
	"meta_image",
	"modified",
)


def published(limit: int = 20, offset: int = 0) -> list[dict]:
	"""Newest published posts, with the author's display name resolved."""
	posts = frappe.get_all(
		"Blog Post",
		filters={"is_published": 1},
		fields=list(POST_FIELDS),
		order_by="published_on desc, creation desc",
		limit=limit,
		start=offset,
	)
	return [_with_author(post) for post in posts]


def count() -> int:
	return frappe.db.count("Blog Post", {"is_published": 1})


def by_slug(slug: str) -> dict | None:
	if not slug:
		return None
	name = frappe.db.get_value("Blog Post", {"slug": slug, "is_published": 1}, "name")
	if not name:
		return None
	return _with_author(frappe.get_doc("Blog Post", name).as_dict())


def _with_author(post: dict) -> dict:
	post["author_name"] = _display_name(post.get("author"))
	post["url"] = f"/blog/{post.get('slug')}"
	post["tag_list"] = [tag.strip() for tag in (post.get("tags") or "").split(",") if tag.strip()]
	post["published_label"] = (
		frappe.utils.formatdate(post.get("published_on"), "medium") if post.get("published_on") else ""
	)
	post["excerpt"] = post.get("excerpt") or _excerpt(post.get("content") or "")
	post["description"] = post.get("meta_description") or post["excerpt"]
	return post


def _display_name(user: str | None) -> str:
	if not user:
		return ""
	full_name = frappe.db.get_value("User", user, "full_name")
	return full_name or user


def _excerpt(markdown: str, length: int = 180) -> str:
	"""First paragraph of the post, with markdown syntax stripped."""
	import re

	text = re.sub(r"```[\s\S]*?```", " ", markdown)
	text = re.sub(r"[#>*_`\[\]()!-]+", " ", text)
	text = re.sub(r"\s+", " ", text).strip()
	return text[:length] + ("…" if len(text) > length else "")


def html(post: dict) -> str:
	return render_markdown(post.get("content") or "")
