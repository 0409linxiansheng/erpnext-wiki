"""Unit tests for the portal view model (pure; no site required)."""

import unittest

from wiki.wiki.portal_config import build_portal_view

DEFAULTS = {"title": "Documentation", "subtitle": "Browse the spaces."}


def _space(name, page_count=1):
	return {"name": name, "space_name": name.title(), "route": name, "page_count": page_count}


class TestPortalView(unittest.TestCase):
	def test_defaults_when_nothing_is_configured(self):
		view = build_portal_view(None, [_space("docs")], DEFAULTS)

		self.assertEqual(view["title"], "Documentation")
		self.assertEqual(view["subtitle"], "Browse the spaces.")
		self.assertEqual([s["name"] for s in view["spaces"]], ["docs"])

	def test_configured_text_wins_and_blank_falls_back(self):
		view = build_portal_view({"title": "  Handbook  ", "subtitle": "   "}, [], DEFAULTS)

		self.assertEqual(view["title"], "Handbook")
		self.assertEqual(view["subtitle"], "Browse the spaces.")

	def test_featured_spaces_lead_in_row_order(self):
		view = build_portal_view(
			{"featured_spaces": [{"wiki_space": "beta"}, {"wiki_space": "docs"}]},
			[_space("docs"), _space("beta"), _space("gamma")],
			DEFAULTS,
		)

		self.assertEqual([s["name"] for s in view["spaces"]], ["beta", "docs", "gamma"])

	def test_show_all_off_lists_only_featured(self):
		view = build_portal_view(
			{"show_all_spaces": 0, "featured_spaces": [{"wiki_space": "beta"}]},
			[_space("docs"), _space("beta")],
			DEFAULTS,
		)

		self.assertEqual([s["name"] for s in view["spaces"]], ["beta"])

	def test_a_featured_space_that_is_not_public_is_dropped(self):
		view = build_portal_view(
			{"featured_spaces": [{"wiki_space": "secret"}, {"wiki_space": "docs"}]},
			[_space("docs")],
			DEFAULTS,
		)

		self.assertEqual([s["name"] for s in view["spaces"]], ["docs"])

	def test_duplicate_featured_rows_are_collapsed(self):
		view = build_portal_view(
			{"featured_spaces": [{"wiki_space": "docs"}, {"wiki_space": "docs"}]},
			[_space("docs")],
			DEFAULTS,
		)

		self.assertEqual([s["name"] for s in view["spaces"]], ["docs"])

	def test_logo_accent_and_footer_pass_through(self):
		view = build_portal_view(
			{"logo": "/files/logo.png", "accent_color": "violet", "footer_text": "© us"},
			[],
			DEFAULTS,
		)

		self.assertEqual(view["logo"], "/files/logo.png")
		self.assertEqual(view["accent_color"], "violet")
		self.assertEqual(view["footer_text"], "© us")


if __name__ == "__main__":
	unittest.main()
