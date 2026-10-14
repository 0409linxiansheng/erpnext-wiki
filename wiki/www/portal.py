# Copyright (c) 2026, Frappe and Contributors
# See license.txt

"""The public portal: the front door for visitors without an account.

It lists the spaces that are explicitly published (`Wiki Space.visibility ==
"Public"`), so it can only ever show what the owner chose to make public. The
reader's chrome is hidden — its sidebar is a per-page tree, which means nothing on
a landing page — and the template reuses the reader's layout, so theming, fonts and
the space marks come from one place.
"""

import frappe

from wiki.api.wiki_space import get_public_spaces

no_cache = 1
sitemap = 1


def get_context():
	context = frappe._dict()
	context.hide_chrome = True
	context.spaces = get_public_spaces()
	return context
