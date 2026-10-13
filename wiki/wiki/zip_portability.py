"""Space ZIP portability — the pure, side-effect-free half.

The export is split in two so the format and the assembly can be unit-tested
without a site: this module builds the manifest and the ZIP bytes from plain
data, while `wiki.api.zip_export` supplies that data from the database and the
file system. Nothing here imports `frappe` or touches the network.

ZIP layout (deterministic ordering — documents in tree order, attachments sorted):

    manifest.json
    files/<name>      (one entry per referenced attachment, name = original filename)

`manifest.json` carries the space's portable fields, the document tree (parent
references by index into `documents`), and the attachment list mapping an
original `/files/<name>` URL to its zip path. Revisions are deliberately
excluded: they are history, not content.
"""

import io
import json
import re
import zipfile

FORMAT_NAME = "wiki-space-export"
FORMAT_VERSION = 1

# The URL inside image syntax, allowing spaces and one level of balanced parens
# so Frappe filenames like `/files/image (14).png` are captured whole — the same
# shape the server renderer already tolerates.
_IMAGE_URL_RE = re.compile(r'!\[[^\]]*\]\(((?:[^()"]|\([^()"]*\))+?)\)')

# src="/files/..." or href="/files/..." (single or double quotes).
_ATTR_URL_RE = re.compile(r"""(?:src|href)\s*=\s*["'](/files/[^"']+)["']""")


def extract_file_refs(content: str) -> list[str]:
	"""Unique `/files/<name>` references in a document, sorted by name.

	Both markdown image syntax (`![alt](/files/x.png)`, which every attachment
	node uses) and raw `src`/`href` attributes are matched.
	"""
	if not content:
		return []

	names: set[str] = set()

	for match in _IMAGE_URL_RE.finditer(content or ""):
		url = match.group(1).strip()
		if url.startswith("/files/"):
			names.add(url[len("/files/") :].split("?", 1)[0])

	for match in _ATTR_URL_RE.finditer(content or ""):
		url = match.group(1)
		if url.startswith("/files/"):
			names.add(url[len("/files/") :].split("?", 1)[0])

	return sorted(names)


def build_manifest(space: dict, documents: list[dict], attachments: list[dict]) -> dict:
	"""Assemble the portable manifest from already-fetched data.

	`documents` are in tree order (lft ascending); each carries `id` (its index),
	`parent` (parent's index or None) and the portable fields. `attachments` map an
	original URL to its zip path.
	"""
	return {
		"format": FORMAT_NAME,
		"version": FORMAT_VERSION,
		"space": space,
		"documents": documents,
		"attachments": attachments,
	}


def build_zip_bytes(manifest: dict, attachment_files: dict[str, bytes]) -> bytes:
	"""Serialize a manifest and its attachment bytes into an in-memory ZIP."""
	buffer = io.BytesIO()
	with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
		archive.writestr(
			"manifest.json",
			json.dumps(manifest, indent=2, ensure_ascii=False, sort_keys=True),
		)
		for name in sorted(attachment_files):
			archive.writestr(f"files/{name}", attachment_files[name])
	return buffer.getvalue()


def read_manifest(archive_bytes: bytes) -> dict:
	"""Read the manifest back out of a ZIP — the import side's entry point."""
	with zipfile.ZipFile(io.BytesIO(archive_bytes)) as archive:
		with archive.open("manifest.json") as handle:
			return json.loads(handle.read().decode("utf-8"))


def validate_manifest(manifest: dict) -> None:
	"""Raise on a manifest this import cannot read. Pure, so the rules are tested."""
	if not isinstance(manifest, dict):
		raise ValueError("manifest is not an object")
	if manifest.get("format") != FORMAT_NAME:
		raise ValueError(f"unknown format {manifest.get('format')!r}")
	if manifest.get("version") != FORMAT_VERSION:
		raise ValueError(f"unsupported version {manifest.get('version')!r}")
	if not isinstance(manifest.get("documents"), list):
		raise ValueError("manifest.documents is not a list")
	if not isinstance(manifest.get("attachments"), list):
		raise ValueError("manifest.attachments is not a list")


def remap_route(route: str | None, old_base: str, new_base: str) -> str | None:
	"""Rewrite a document route when the space's base route changed on import.

	Mirrors the clone path's `_clone_route`: an exact base match is replaced, a
	`base/...` prefix is swapped, and anything else is left alone.
	"""
	if not route or not old_base or not new_base:
		return route
	if route == old_base:
		return new_base
	prefix = f"{old_base}/"
	if route.startswith(prefix):
		return f"{new_base}{route[len(old_base):]}"
	return route


def remap_content(content: str | None, url_map: dict[str, str]) -> str | None:
	"""Rewrite attachment URLs in a document's content after the files moved.

	`url_map` maps an original `/files/<name>` URL to the URL the upload actually
	got (a collision dedup changes it). Plain substring replace is enough because
	the exporter recorded exactly the `/files/<name>` form.
	"""
	if not content or not url_map:
		return content
	for old_url, new_url in url_map.items():
		content = content.replace(old_url, new_url)
	return content
