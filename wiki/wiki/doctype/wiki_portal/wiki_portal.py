# Copyright (c) 2026, Frappe and contributors
# For license information, please see license.txt

from frappe.model.document import Document


class WikiPortal(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		from wiki.wiki.doctype.wiki_portal_space.wiki_portal_space import WikiPortalSpace

		accent_color: DF.Literal["", "gray", "blue", "green", "amber", "red", "violet"]
		featured_spaces: DF.Table[WikiPortalSpace]
		footer_text: DF.SmallText | None
		logo: DF.AttachImage | None
		show_all_spaces: DF.Check
		subtitle: DF.SmallText | None
		title: DF.Data | None
	# end: auto-generated types

	pass
