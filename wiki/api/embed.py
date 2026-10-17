"""Live ERPNext data inside a page.

A page can embed a report through the `frappe-report` block; the frontend asks
this endpoint for the rows. Everything runs as the *reader*: the report's own
role permissions and the reader's user permissions apply, so an embedded table
can never show data the reader could not already open in ERPNext.
"""

from __future__ import annotations

import frappe
from frappe import _

MAX_ROWS = 100
MAX_COLUMNS = 12


def _columns(data) -> list[dict]:
	columns = []
	for column in data.get("columns") or []:
		if isinstance(column, dict):
			columns.append(
				{
					"label": column.get("label") or column.get("fieldname") or "",
					"fieldname": column.get("fieldname") or "",
					"fieldtype": column.get("fieldtype") or "",
				}
			)
		elif isinstance(column, str):
			columns.append({"label": column, "fieldname": column, "fieldtype": ""})
	return columns[:MAX_COLUMNS]


def _cell(value):
	"""Plain JSON values only: dates, Decimals and links become strings."""
	if value is None or isinstance(value, (str, int, float, bool)):
		return value
	return frappe.utils.cstr(value)


def _rows(data, limit: int) -> list[list]:
	rows = []
	for row in (data.get("result") or [])[:limit]:
		if isinstance(row, dict):
			rows.append([_cell(value) for value in row.values()])
		else:
			rows.append([_cell(value) for value in row])
	return rows


@frappe.whitelist()
def report_snippet(report: str, filters=None, limit: int = MAX_ROWS) -> dict:
	"""Run a report as the current user and return a trimmed table."""
	name = (report or "").strip()
	if not name or not frappe.db.exists("Report", name):
		frappe.throw(_("Unknown report: {0}").format(name), frappe.DoesNotExistError)

	if isinstance(filters, str):
		filters = frappe.parse_json(filters)
	if not isinstance(filters, dict):
		filters = {}

	try:
		from frappe.desk.query_report import run as run_report

		result = run_report(name, filters=filters)
	except frappe.PermissionError:
		frappe.throw(_("You are not allowed to run this report."), frappe.PermissionError)

	rows_limit = max(1, min(int(limit or MAX_ROWS), MAX_ROWS))
	all_rows = result.get("result") or []
	return {
		"report": name,
		"columns": _columns(result),
		"rows": _rows(result, rows_limit),
		"total": len(all_rows),
		"truncated": len(all_rows) > rows_limit,
	}


@frappe.whitelist()
def reports() -> list[dict]:
	"""Reports the current user may run, for the insert dialog."""
	return frappe.get_all(
		"Report",
		filters={"disabled": 0, "is_standard": "Yes"},
		fields=["name", "report_name"],
		order_by="name asc",
		limit=300,
	)
