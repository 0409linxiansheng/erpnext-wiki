import frappe

from wiki import blog

no_cache = 1


def get_context(context):
	post = blog.by_slug((frappe.form_dict.get("slug") or "").strip())
	if post is None:
		frappe.local.flags.redirect_location = "/404"
		raise frappe.Redirect

	context.no_cache = 1
	context.page_title = post["title"]
	context.meta_description = post["description"]
	context.canonical_url = frappe.utils.get_url(post["url"])
	context.og_image = post.get("meta_image") or post.get("cover_image")
	context.post = post
	context.post_html = blog.html(post)
	context.body_class = "blog-post"
	# Built here, not in the template: date/datetime objects fall over in Jinja's
	# tojson filter, and schema.org only wants ISO strings anyway.
	context.structured_data = {
		"@context": "https://schema.org",
		"@type": "BlogPosting",
		"headline": post["title"],
		"datePublished": str(post.get("published_on") or ""),
		"dateModified": str(post.get("modified") or ""),
		"author": {"@type": "Person", "name": post.get("author_name") or "知识库"},
		"description": post.get("description") or "",
		"mainEntityOfPage": context.canonical_url,
	}
	return context
