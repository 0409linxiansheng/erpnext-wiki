# Copyright (c) 2026, Frappe and contributors
# For license information, please see license.txt

from frappe.model.document import Document


class WikiTask(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		assigned_to: DF.Link | None
		description: DF.Text | None
		sort_order: DF.Int
		status: DF.Literal["Backlog", "To Do", "In Progress", "Done"]
		title: DF.Data
		wiki_space: DF.Link
	# end: auto-generated types

	pass
