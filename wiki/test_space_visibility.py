# Copyright (c) 2026, Frappe and Contributors
# See license.txt

"""The space read gate follows ``Wiki Space.visibility``.

Plain ``unittest.TestCase`` for the same reason as
``wiki/wiki/doctype/wiki_snippet/test_wiki_snippet.py``: the v16
``IntegrationTestCase`` bootstraps every app's test records and this site's
ERPNext/HRMS fixtures are incomplete, so it never reaches a test. This module owns
its fixtures and removes them in ``tearDown``.
"""

import time
import unittest

import frappe

from wiki.permissions import can_read_space

GUEST = "Guest"
OUTSIDER = "visibility-outsider@example.com"
MANAGER = "visibility-manager@example.com"


class TestSpaceVisibility(unittest.TestCase):
	def setUp(self):
		frappe.set_user("Administrator")
		for email, roles in ((OUTSIDER, ["Wiki User"]), (MANAGER, ["Wiki Manager"])):
			if not frappe.db.exists("User", email):
				frappe.get_doc(
					{
						"doctype": "User",
						"email": email,
						"first_name": email.split("@")[0],
						"send_welcome_email": 0,
						"roles": [{"role": role} for role in roles],
					}
				).insert(ignore_permissions=True)

		suffix = str(int(time.time() * 1000))
		self.space = frappe.get_doc(
			{
				"doctype": "Wiki Space",
				"space_name": f"Visibility {suffix}",
				"route": f"visibility-{suffix}",
			}
		).insert(ignore_permissions=True)
		frappe.db.commit()

	def tearDown(self):
		frappe.set_user("Administrator")
		if frappe.db.exists("Wiki Space", self.space.name):
			frappe.delete_doc("Wiki Space", self.space.name, force=True, ignore_permissions=True)
		frappe.db.commit()

	def _set_visibility(self, value: str) -> None:
		frappe.db.set_value("Wiki Space", self.space.name, "visibility", value)
		frappe.db.commit()

	def test_public_is_readable_by_an_anonymous_guest(self):
		self._set_visibility("Public")

		self.assertTrue(can_read_space(self.space.name, GUEST))
		self.assertTrue(can_read_space(self.space.name, OUTSIDER))

	def test_logged_in_refuses_a_guest_but_allows_a_user(self):
		self._set_visibility("Logged in")

		self.assertFalse(can_read_space(self.space.name, GUEST))
		self.assertTrue(can_read_space(self.space.name, OUTSIDER))

	def test_private_refuses_a_guest_and_an_unrelated_user(self):
		self._set_visibility("Private")

		self.assertFalse(can_read_space(self.space.name, GUEST))
		self.assertFalse(can_read_space(self.space.name, OUTSIDER))

	def test_a_manager_always_reads(self):
		self._set_visibility("Private")

		self.assertTrue(can_read_space(self.space.name, MANAGER))

	def test_private_with_a_guest_role_row_still_admits_guests(self):
		"""The older escape hatch keeps working: an explicit Guest role row."""
		self._set_visibility("Private")
		doc = frappe.get_doc("Wiki Space", self.space.name)
		doc.append("roles", {"role": GUEST, "permission_level": "Read"})
		doc.save(ignore_permissions=True)
		frappe.db.commit()

		self.assertTrue(can_read_space(self.space.name, GUEST))

	def test_role_rows_gate_even_when_visibility_is_logged_in(self):
		"""Naming roles is the restriction; the three states decide the role-less case."""
		self._set_visibility("Logged in")
		doc = frappe.get_doc("Wiki Space", self.space.name)
		doc.append("roles", {"role": "Wiki Approver", "permission_level": "Read"})
		doc.save(ignore_permissions=True)
		frappe.db.commit()

		# Only the named role reads it — not a guest, not an unrelated signed-in user.
		self.assertFalse(can_read_space(self.space.name, GUEST))
		self.assertFalse(can_read_space(self.space.name, OUTSIDER))

	def test_public_overrides_role_rows(self):
		"""`Public` is the explicit way to publish a space that also names roles."""
		doc = frappe.get_doc("Wiki Space", self.space.name)
		doc.append("roles", {"role": "Wiki Approver", "permission_level": "Read"})
		doc.save(ignore_permissions=True)
		self._set_visibility("Public")

		self.assertTrue(can_read_space(self.space.name, GUEST))

	def test_migration_default_is_logged_in(self):
		"""A freshly created space must not be public by accident."""
		self.assertEqual(
			frappe.db.get_value("Wiki Space", self.space.name, "visibility"),
			"Logged in",
		)
		self.assertFalse(can_read_space(self.space.name, GUEST))


if __name__ == "__main__":
	unittest.main()
