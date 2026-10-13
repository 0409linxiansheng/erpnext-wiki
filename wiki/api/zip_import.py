"""Space ZIP import — re-create a space and its tree from an export.

Reads a ZIP produced by `wiki.api.zip_export`, validates the manifest, uploads its
attachments, then rebuilds the document tree. Routes and attachment URLs are
remapped on collision rather than failing, and importing over a non-empty space is
rejected (merging two histories is change-request territory, not this spec).
"""

import io
import zipfile

import frappe
from frappe import _

from wiki.wiki.zip_portability import (
	read_manifest,
	remap_content,
	remap_route,
	validate_manifest,
)


@frappe.whitelist()
def import_space(file_url: str, target_space_name: str | None = None) -> dict:
	"""Import a space ZIP. `file_url` is a `/files/...` or `/private/files/...` path.

	Without `target_space_name` a new space is created; with one, the target must be
	empty (only its root group). Returns the new/existing space name and counts.
	"""
	archive = _read_zip_bytes(file_url)
	manifest = read_manifest(archive)
	validate_manifest(manifest)

	if target_space_name:
		space = frappe.get_doc("Wiki Space", target_space_name)
		if space.document_count() > 0:
			frappe.throw(_("Cannot import into a space that already has pages."))
	else:
		space = _create_space(manifest)

	url_map = _upload_attachments(archive, manifest)

	created = _create_documents(space, manifest, url_map)

	return {
		"space": space.name,
		"route": space.route,
		"documents": created,
		"attachments": len(url_map),
	}


def _create_documents(space, manifest, url_map) -> int:
	new_root = space.root_group
	# Manifest document index 0 is the root group, which `before_insert` already made.
	name_by_index = {0: new_root}

	created = 0
	for doc in manifest["documents"]:
		if doc["id"] == 0:
			continue

		parent = name_by_index.get(doc.get("parent"))
		new_doc = frappe.new_doc("Wiki Document")
		new_doc.title = doc.get("title")
		new_doc.slug = doc.get("slug")
		new_doc.route = remap_route(
			doc.get("route"), manifest["space"].get("route"), space.route
		)
		new_doc.is_group = doc.get("is_group")
		new_doc.is_published = doc.get("is_published")
		new_doc.meta_title = doc.get("meta_title")
		new_doc.meta_description = doc.get("meta_description")
		new_doc.content = remap_content(doc.get("content"), url_map)
		new_doc.parent_wiki_document = parent

		new_doc.insert(ignore_permissions=True)

		sort_order = doc.get("sort_order")
		if sort_order is not None:
			frappe.db.set_value(
				"Wiki Document", new_doc.name, "sort_order", sort_order, update_modified=False
			)

		name_by_index[doc["id"]] = new_doc.name
		created += 1

	return created


def _create_space(manifest) -> "frappe.Document":
	payload = manifest["space"]
	route = _unique_route(payload.get("route") or "imported-space")

	new_space = frappe.new_doc("Wiki Space")
	new_space.space_name = payload.get("space_name") or _("Imported space")
	new_space.route = route
	new_space.is_published = bool(payload.get("is_published"))
	new_space.space_color = payload.get("space_color")
	new_space.space_icon = payload.get("space_icon")
	new_space.home_tab_title = payload.get("home_tab_title")
	new_space.home_tab_icon = payload.get("home_tab_icon")
	new_space.show_in_switcher = bool(payload.get("show_in_switcher"))
	# Logos/favicon point at the same `/files/<name>` the attachments re-create.
	for field in ("light_mode_logo", "dark_mode_logo", "favicon", "app_switcher_logo"):
		value = payload.get(field)
		if value:
			new_space.set(field, value)

	# `before_insert` creates the root group and fills `root_group`.
	new_space.insert(ignore_permissions=True)
	return new_space


def _unique_route(route: str) -> str:
	base = (route or "imported-space").strip("/")
	candidate = base
	suffix = 1
	while frappe.db.exists("Wiki Space", {"route": candidate}):
		suffix += 1
		candidate = f"{base}-{suffix}"
	return candidate


def _upload_attachments(archive: bytes, manifest: dict) -> dict[str, str]:
	"""Re-create the ZIP's files, returning `{old_url: actual_url}` for remapping."""
	url_map: dict[str, str] = {}

	with zipfile.ZipFile(io.BytesIO(archive)) as zf:
		for attachment in manifest["attachments"]:
			zip_path = attachment.get("file")
			if not zip_path or zip_path not in zf.namelist():
				continue

			name = zip_path[len("files/") :] if zip_path.startswith("files/") else zip_path
			old_url = attachment.get("url") or f"/files/{name}"

			file_doc = frappe.get_doc(
				{
					"doctype": "File",
					"file_name": name,
					"content": zf.read(zip_path),
					"is_private": 0,
				}
			).insert(ignore_permissions=True)

			if file_doc.file_url and file_doc.file_url != old_url:
				url_map[old_url] = file_doc.file_url

	return url_map


def _read_zip_bytes(file_url: str) -> bytes:
	"""Resolve a `/files/...` or `/private/files/...` URL to its bytes."""
	if not file_url:
		frappe.throw(_("No ZIP file given."))

	if file_url.startswith("/private/files/"):
		path = frappe.get_site_path("private", "files", file_url[len("/private/files/") :])
	elif file_url.startswith("/files/"):
		path = frappe.get_site_path("public", "files", file_url[len("/files/") :])
	else:
		# Accept a bare File record name as a convenience.
		file_url = frappe.db.get_value("File", file_url, "file_url") or file_url
		return _read_zip_bytes(file_url)

	with open(path, "rb") as handle:
		return handle.read()
