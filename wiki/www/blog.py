import frappe

from wiki import blog

no_cache = 1
PER_PAGE = 10


def get_context(context):
	page = _page_number()
	posts = blog.published(limit=PER_PAGE, offset=(page - 1) * PER_PAGE)

	context.no_cache = 1
	context.page_title = "博客"
	context.meta_description = "产品更新、使用教程与实践分享。"
	context.canonical = frappe.utils.get_url("/blog" if page == 1 else f"/blog?page={page}")
	context.posts = posts
	context.page_number = page
	context.has_next = len(posts) == PER_PAGE
	context.body_class = "blog-list"
	return context


def _page_number() -> int:
	try:
		return max(1, int(frappe.form_dict.get("page") or 1))
	except (TypeError, ValueError):
		return 1
