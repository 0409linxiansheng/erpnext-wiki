# Copyright (c) 2026, Frappe and Contributors
# See license.txt

"""Owner isolation for snippets.

A snippet is private data, so the `if_owner` flag on the `All` role is what
enforces that — not the picker UI, which any user could bypass with a request of
their own. This is the test that should fail if someone later "simplifies" the
permissions away.

Uses plain `unittest.TestCase` for the same reason
`wiki/wiki/doctype/wiki_page_revision/test_wiki_page_revision.py` does: the
v16 `IntegrationTestCase` bootstraps every installed app's test records, and this
site's ERPNext/HRMS fixtures are incomplete (`Could not find Parent Department:
All Departments`), so the suite never reaches a test. This module owns its
fixtures and removes them in `tearDown`.

See `specs/alexandrie_port/02-editor-snippets-and-voice.md` (Phase 1).
"""

import unittest

import frappe

OWNER = "snippet-owner@example.com"
OTHER = "snippet-other@example.com"


class TestWikiSnippetOwnership(unittest.TestCase):
	def setUp(self):
		frappe.set_user("Administrator")
		for email in (OWNER, OTHER):
			if not frappe.db.exists("User", email):
				frappe.get_doc(
					{
						"doctype": "User",
						"email": email,
						"first_name": email.split("@")[0],
						"send_welcome_email": 0,
					}
				).insert(ignore_permissions=True)
		frappe.db.commit()

	def tearDown(self):
		frappe.set_user("Administrator")
		for name in frappe.get_all(
			"Wiki Snippet", filters={"owner": ("in", (OWNER, OTHER))}, pluck="name"
		):
			frappe.delete_doc("Wiki Snippet", name, force=True, ignore_permissions=True)
		for email in (OWNER, OTHER):
			if frappe.db.exists("User", email):
				frappe.delete_doc("User", email, force=True, ignore_permissions=True)
		frappe.db.commit()

	def _snippet(self, title="Notice", content="**Note**\n"):
		"""A snippet owned by `OWNER`, created as that user."""
		frappe.set_user(OWNER)
		try:
			doc = frappe.get_doc(
				{"doctype": "Wiki Snippet", "title": title, "content": content}
			).insert()
			frappe.db.commit()
		finally:
			frappe.set_user("Administrator")
		return doc

	def test_the_owner_can_read_their_own_snippet(self):
		doc = self._snippet()

		self.assertTrue(frappe.has_permission("Wiki Snippet", doc=doc, user=OWNER))

	def test_another_user_cannot_read_it(self):
		doc = self._snippet()

		self.assertFalse(frappe.has_permission("Wiki Snippet", doc=doc, user=OTHER))

	def test_it_stays_out_of_another_users_list(self):
		"""`if_owner` has to filter the query, not just block a single read."""
		doc = self._snippet("Only mine")

		frappe.set_user(OTHER)
		try:
			names = [
				row.name
				for row in frappe.get_list("Wiki Snippet", fields=["name"], limit_page_length=0)
			]
		finally:
			frappe.set_user("Administrator")

		self.assertNotIn(doc.name, names)

	def test_another_user_cannot_delete_it(self):
		doc = self._snippet()

		frappe.set_user(OTHER)
		try:
			with self.assertRaises(frappe.PermissionError):
				frappe.delete_doc("Wiki Snippet", doc.name)
		finally:
			frappe.set_user("Administrator")

		self.assertTrue(frappe.db.exists("Wiki Snippet", doc.name))

	def test_a_snippet_keeps_its_content_verbatim(self):
		"""The picker inserts this string as markdown, so nothing may rewrite it."""
		body = "**Note**\n\n| a | b |\n| - | - |\n\n$E = mc^2$\n"

		doc = self._snippet("Verbatim", body)

		self.assertEqual(body, frappe.db.get_value("Wiki Snippet", doc.name, "content"))
