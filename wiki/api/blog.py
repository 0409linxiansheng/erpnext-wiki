"""Machine-readable blog endpoints: RSS and a blog-only sitemap.

They live under /api/method because Frappe's page renderer always answers
text/html; `type = "download"` with `display_content_as = "inline"` is the one
way to return real XML with the right content type from a whitelisted method.
"""

from __future__ import annotations

import html

import frappe

from wiki import blog


def _send(content: str, content_type: str, filename: str) -> None:
	frappe.response["type"] = "download"
	frappe.response["filename"] = filename
	frappe.response["content_type"] = content_type
	frappe.response["display_content_as"] = "inline"
	frappe.response["filecontent"] = content


@frappe.whitelist(allow_guest=True)
def rss() -> None:
	base = frappe.utils.get_url()
	items = []
	for post in blog.published(limit=30):
		link = html.escape(base + post["url"])
		items.append(
			"<item>"
			f"<title>{html.escape(post['title'])}</title>"
			f"<link>{link}</link>"
			f'<guid isPermaLink="true">{link}</guid>'
			f"<pubDate>{_rfc822(post.get('published_on'))}</pubDate>"
			f"<description>{html.escape(post.get('excerpt') or '')}</description>"
			"</item>"
		)

	xml = (
		'<?xml version="1.0" encoding="UTF-8"?>'
		'<rss version="2.0"><channel>'
		"<title>知识库 · 博客</title>"
		f"<link>{html.escape(base + '/blog')}</link>"
		"<description>产品更新、使用教程与实践分享</description>"
		+ "".join(items)
		+ "</channel></rss>"
	)
	_send(xml, "application/rss+xml; charset=utf-8", "rss.xml")


@frappe.whitelist(allow_guest=True)
def sitemap() -> None:
	base = frappe.utils.get_url()
	urls = [f"<url><loc>{html.escape(base + '/blog')}</loc></url>"]
	for post in blog.published(limit=500):
		lastmod = frappe.utils.formatdate(post.get("modified"), "yyyy-MM-dd")
		urls.append(
			f"<url><loc>{html.escape(base + post['url'])}</loc><lastmod>{lastmod}</lastmod></url>"
		)

	xml = (
		'<?xml version="1.0" encoding="UTF-8"?>'
		'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
		+ "".join(urls)
		+ "</urlset>"
	)
	_send(xml, "application/xml; charset=utf-8", "sitemap.xml")


def _rfc822(value) -> str:
	if not value:
		return ""
	return frappe.utils.get_datetime(value).strftime("%a, %d %b %Y 00:00:00 +0000")
