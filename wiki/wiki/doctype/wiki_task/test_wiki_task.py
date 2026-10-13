# Copyright (c) 2026, Frappe and Contributors
# See license.txt

"""The Wiki Task doctype that the kanban board rides on.

Plain `unittest.TestCase` for the same reason as
`wiki/wiki/doctype/wiki_snippet/test_wiki_snippet.py`: the v16
`IntegrationTestCase` bootstraps every app's test records and this site's
ERPNext/HRMS fixtures are incomplete, so it never reaches a test. This module owns
its fixtures and removes them in `tearDown`.
"""

import time
import unittest

import frappe


class TestWikiTask(unittest.TestCase):
	def setUp(self):
		frappe.set_user("Administrator")
		self.suffix = str(int(time.time() * 1000))
		self.space_name = f"Task Test {self.suffix}"
		self.route = f"task-test-{self.suffix}"
		self.space = frappe.get_doc(
			{
				"doctype": "Wiki Space",
				"space_name": self.space_name,
				"route": self.route,
			}
		).insert(ignore_permissions=True)
		self.task_names = []
		frappe.db.commit()

	def tearDown(self):
		frappe.set_user("Administrator")
		for name in self.task_names:
			if frappe.db.exists("Wiki Task", name):
				frappe.delete_doc("Wiki Task", name, force=True, ignore_permissions=True)
		if self.space and frappe.db.exists("Wiki Space", self.space.name):
			# on_trash cascades the root group and its documents.
			frappe.delete_doc("Wiki Space", self.space.name, force=True, ignore_permissions=True)
		frappe.db.commit()

	def _make(self, **kwargs):
		task = frappe.get_doc(
			{
				"doctype": "Wiki Task",
				"title": kwargs.pop("title", "Ship the board"),
				"wiki_space": self.space.name,
				**kwargs,
			}
		).insert(ignore_permissions=True)
		self.task_names.append(task.name)
		return task

	def test_task_inserts_and_round_trips_fields(self):
		task = self._make(description="Drag between columns.", assigned_to="Administrator")

		self.assertEqual(task.status, "Backlog")

		reloaded = frappe.get_doc("Wiki Task", task.name)
		self.assertEqual(reloaded.title, "Ship the board")
		self.assertEqual(reloaded.wiki_space, self.space.name)
		self.assertEqual(reloaded.description, "Drag between columns.")
		self.assertEqual(reloaded.assigned_to, "Administrator")

	def test_status_columns_are_the_four_board_columns(self):
		field = frappe.get_meta("Wiki Task").get_field("status")
		options = [o.strip() for o in (field.options or "").split("\n") if o.strip()]
		self.assertEqual(options, ["Backlog", "To Do", "In Progress", "Done"])

	def test_a_task_can_move_status(self):
		task = self._make()
		frappe.set_value("Wiki Task", task.name, "status", "Done")
		reloaded = frappe.get_doc("Wiki Task", task.name)
		self.assertEqual(reloaded.status, "Done")


if __name__ == "__main__":
	unittest.main()
