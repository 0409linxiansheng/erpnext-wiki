"""Unit tests for the ZIP-portability module (pure; no site required)."""

import io
import unittest
import zipfile

from wiki.wiki.zip_portability import (
	build_manifest,
	build_zip_bytes,
	extract_file_refs,
	read_manifest,
	remap_content,
	remap_route,
	validate_manifest,
)


class TestExtractFileRefs(unittest.TestCase):
	def test_extracts_image_syntax_with_spaces_and_parens(self):
		content = "![alt](/files/image (14).png)\n![x](/files/a b.mp3)"
		self.assertEqual(extract_file_refs(content), ["a b.mp3", "image (14).png"])

	def test_extracts_src_and_href_attributes(self):
		content = '<img src="/files/pic.png"> <a href="/files/doc.pdf">x</a>'
		self.assertEqual(extract_file_refs(content), ["doc.pdf", "pic.png"])

	def test_dedupes_and_sorts(self):
		content = "![a](/files/b.png)\n![c](/files/b.png)\n![d](/files/a.txt)"
		self.assertEqual(extract_file_refs(content), ["a.txt", "b.png"])

	def test_ignores_non_file_urls(self):
		content = "![x](https://example.com/a.png) [link](/wiki/foo) ![y](/assets/x.png)"
		self.assertEqual(extract_file_refs(content), [])


class TestManifestAndZip(unittest.TestCase):
	def _manifest(self):
		return build_manifest(
			{"space_name": "Docs", "route": "docs", "is_published": True},
			[
				{
					"id": 0,
					"parent": None,
					"title": "Home",
					"route": "docs/home",
					"slug": "home",
					"is_group": True,
					"is_published": True,
					"content": "![pic](/files/a.png)",
				},
				{
					"id": 1,
					"parent": 0,
					"title": "Child",
					"route": "docs/home/child",
					"slug": "child",
					"is_group": False,
					"is_published": True,
					"content": "hello",
				},
			],
			[{"url": "/files/a.png", "file": "files/a.png"}],
		)

	def test_manifest_round_trips_through_the_zip(self):
		manifest = self._manifest()
		data = build_zip_bytes(manifest, {"a.png": b"\x89PNG bytes"})

		with zipfile.ZipFile(io.BytesIO(data)) as archive:
			names = archive.namelist()
			self.assertIn("manifest.json", names)
			self.assertIn("files/a.png", names)
			self.assertEqual(archive.read("files/a.png"), b"\x89PNG bytes")

		self.assertEqual(read_manifest(data), manifest)

	def test_manifest_documents_keep_parent_indices(self):
		manifest = self._manifest()
		self.assertEqual(manifest["documents"][0]["parent"], None)
		self.assertEqual(manifest["documents"][1]["parent"], 0)
		self.assertEqual(manifest["format"], "wiki-space-export")


class TestValidateManifest(unittest.TestCase):
	def test_accepts_a_valid_manifest(self):
		validate_manifest(
			{
				"format": "wiki-space-export",
				"version": 1,
				"space": {},
				"documents": [],
				"attachments": [],
			}
		)

	def test_rejects_unknown_format(self):
		with self.assertRaises(ValueError):
			validate_manifest({"format": "nope", "version": 1, "documents": [], "attachments": []})

	def test_rejects_wrong_version(self):
		with self.assertRaises(ValueError):
			validate_manifest(
				{"format": "wiki-space-export", "version": 2, "documents": [], "attachments": []}
			)


class TestRemapRoute(unittest.TestCase):
	def test_exact_base_is_replaced(self):
		self.assertEqual(remap_route("docs", "docs", "docs-2"), "docs-2")

	def test_prefix_is_swapped(self):
		self.assertEqual(
			remap_route("docs/home/child", "docs", "imported"),
			"imported/home/child",
		)

	def test_unrelated_route_is_left_alone(self):
		self.assertEqual(remap_route("other/page", "docs", "imported"), "other/page")


class TestRemapContent(unittest.TestCase):
	def test_remaps_a_moved_attachment(self):
		content = "![a](/files/x.png)\n![b](/files/y.png)"
		remapped = remap_content(content, {"/files/x.png": "/files/x-abc123.png"})
		self.assertIn("/files/x-abc123.png", remapped)
		self.assertIn("/files/y.png", remapped)
		self.assertNotIn("![a](/files/x.png)", remapped)

	def test_no_map_is_a_noop(self):
		self.assertEqual(remap_content("![a](/files/x.png)", {}), "![a](/files/x.png)")


if __name__ == "__main__":
	unittest.main()
