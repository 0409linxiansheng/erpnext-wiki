import frappe


def execute():
	"""Give every existing space the visibility that matches today's behaviour.

	A space that restricts by role was already private; a role-less one was
	readable by any signed-in user. Nothing becomes public implicitly.
	"""
	for name in frappe.db.get_all("Wiki Space", pluck="name"):
		has_roles = frappe.db.exists(
			"Wiki Space Role", {"parent": name, "parenttype": "Wiki Space"}
		)
		frappe.db.set_value(
			"Wiki Space",
			name,
			"visibility",
			"Private" if has_roles else "Logged in",
			update_modified=False,
		)
	frappe.db.commit()
