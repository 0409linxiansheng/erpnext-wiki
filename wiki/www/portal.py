# Copyright (c) 2026, Frappe and Contributors
# See license.txt

"""The public portal: the front door for visitors without an account.

It lists the spaces that are explicitly published (`Wiki Space.visibility ==
"Public"`), so it can only ever show what the owner chose to make public. What it
looks like — heading, subtitle, logo, accent, which spaces lead, footer — comes from
the `Wiki Portal` single, with built-in fallbacks so an untouched install still has
a working page.

The reader's chrome is hidden: its sidebar is a per-page tree, which means nothing
on a landing page. The template still extends the reader's layout, so theming,
fonts and the space marks come from one place.
"""

import frappe
from frappe import _

from wiki.api.wiki_space import get_public_spaces
from wiki.wiki.portal_config import build_portal_view

no_cache = 1
sitemap = 1


def get_context():
	context = frappe._dict()
	context.hide_chrome = True
	context.portal = build_portal_view(
		_portal_config(),
		get_public_spaces(),
		{
			"title": _("Documentation"),
			"subtitle": _("Browse the spaces we have published for you."),
		},
	)
	return context


def _portal_config():
	"""The `Wiki Portal` single, or None.

	Guarded because this page must render even before the doctype exists — a fresh
	checkout serves `/portal` while `bench migrate` is still pending.
	"""
	try:
		return frappe.get_cached_doc("Wiki Portal")
	except Exception:
		return None
