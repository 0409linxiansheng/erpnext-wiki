"""Space ZIP export — the database/filesystem half.

Thin wrapper around `wiki.wiki.zip_portability`, which holds the pure format and
assembly. This module fetches the space's documents and attachments, calls the
pure builders, and saves the result as a private Frappe File.
"""

import frappe
from frappe import _

from wiki.wiki.zip_portability import build_manifest, build_zip_bytes, extract_file_refs

# Space image fields whose `/files/...` values must travel with the ZIP.
SPACE_IMAGE_FIELDS = ("light_mode_logo", "dark_mode_logo", "favicon", "app_switcher_logo")

PORTABLE_DOCUMENT_FIELDS = (
	"title",
	"route",
	"slug",
	"parent_wiki_document",
	"is_group",
	"is_published",
	"content",
	"meta_title",
	"meta_description",
	"sort_order",
)


@frappe.whitelist()
def export_space(space_name: str) -> dict:
	"""Export a Wiki Space — its document tree, metadata and attachments — as a ZIP.

	The ZIP is saved as a private File and its URL returned. Revisions are not
	included: the export carries content, not history.
	"""
	space = frappe.get_doc("Wiki Space", space_name)

	documents, _ = _collect_documents(space)

	content_bulk = "\n".join((doc["content"] or "") for doc in documents)
	references = set(extract_file_refs(content_bulk))
	for field in SPACE_IMAGE_FIELDS:
		references.update(extract_file_refs(space.get(field) or ""))

	attachment_files: dict[str, bytes] = {}
	attachments: list[dict] = []
	for name in sorted(references):
		data = _read_public_file(name)
		if data is None:
			continue
		attachment_files[name] = data
		attachments.append({"url": f"/files/{name}", "file": f"files/{name}"})

	manifest = build_manifest(_space_payload(space), documents, attachments)
	data = build_zip_bytes(manifest, attachment_files)

	file_name = f"{space.route or space.name}-export.zip"
	file_doc = frappe.get_doc(
		{
			"doctype": "File",
			"file_name": file_name,
			"content": data,
			"is_private": 1,
		}
	).insert(ignore_permissions=True)

	return {
		"file_url": file_doc.file_url,
		"file_name": file_name,
		"documents": len(documents),
		"attachments": len(attachments),
	}


def _collect_documents(space) -> tuple[list[dict], dict]:
	"""All Wiki Documents of a space in tree order, with parent references as
	indices. Walked from the space's root group by NestedSet range (lft/rgt), so the
	root group is included and every parent precedes its children — an index lookup
	is unambiguous. The denormalized `wiki_space` field is deliberately not used as
	the filter: it can be missing on the root group, which would orphan every
	top-level page's parent reference."""
	root = frappe.get_doc("Wiki Document", space.root_group)
	rows = frappe.get_all(
		"Wiki Document",
		filters={"lft": (">=", root.lft), "rgt": ("<=", root.rgt)},
		fields=["name", *PORTABLE_DOCUMENT_FIELDS],
		order_by="lft asc",
	)

	index_by_name = {row.name: i for i, row in enumerate(rows)}
	documents = []
	for index, row in enumerate(rows):
		parent = index_by_name.get(row.parent_wiki_document)
		documents.append(
			{
				"id": index,
				"parent": parent if parent is not None else None,
				"title": row.title,
				"route": row.route,
				"slug": row.slug,
				"is_group": bool(row.is_group),
				"is_published": bool(row.is_published),
				"meta_title": row.meta_title,
				"meta_description": row.meta_description,
				"sort_order": row.sort_order,
				"content": row.content,
			}
		)
	return documents, index_by_name


def _space_payload(space) -> dict:
	"""The space fields worth carrying across an export/import round-trip."""
	return {
		"space_name": space.space_name,
		"route": space.route,
		"is_published": bool(space.is_published),
		"space_color": space.space_color,
		"space_icon": space.space_icon,
		"home_tab_title": space.home_tab_title,
		"home_tab_icon": space.home_tab_icon,
		"show_in_switcher": bool(space.show_in_switcher),
		"light_mode_logo": space.light_mode_logo,
		"dark_mode_logo": space.dark_mode_logo,
		"favicon": space.favicon,
		"app_switcher_logo": space.app_switcher_logo,
	}


def _read_public_file(name: str) -> bytes | None:
	"""Read a public /files/ upload by name, or None when it is missing.

	`name` must be a bare filename: any slash is rejected so a crafted reference
	cannot walk out of the public files directory.
	"""
	if not name or "/" in name or name.startswith("."):
		return None
	path = frappe.get_site_path("public", "files", name)
	try:
		with open(path, "rb") as handle:
			return handle.read()
	except OSError:
		return None
