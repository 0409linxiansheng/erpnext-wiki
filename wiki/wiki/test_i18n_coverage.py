# Copyright (c) 2026, Frappe and Contributors
# See license.txt

"""Guards the app's translation catalogs.

`wiki/locale/main.pot` is the extraction of every translatable string in this app
and `wiki/locale/zh.po` is the catalog that ships with it. See
`specs/i18n_chinese_first.md` for the mechanism and for how to regenerate both.

An entry whose `msgstr` equals its `msgid` is the explicit "keep as-is" marker —
a product name, a literal example value, or a snippet that carries no prose — and
counts as covered. Anything else missing a translation fails here, so a new
English string cannot quietly reach a Chinese deployment.
"""

import unittest
from pathlib import Path

from babel.messages.pofile import read_po

LOCALE = Path(__file__).resolve().parents[1] / "locale"


def _catalog(name):
	with (LOCALE / name).open("rb") as handle:
		return read_po(handle)


class TestTranslationCoverage(unittest.TestCase):
	def test_catalogs_exist(self):
		for name in ("main.pot", "zh.po"):
			self.assertTrue((LOCALE / name).exists(), f"{name} 不存在")

	def test_every_extracted_string_is_translated(self):
		"""The catalog has to answer for everything the extractor finds."""
		zh = {m.id: m for m in _catalog("zh.po") if m.id}

		missing = [
			m.id
			for m in _catalog("main.pot")
			if m.id and not (zh.get(m.id) and zh[m.id].string)
		]

		self.assertEqual(
			[],
			missing,
			f"{len(missing)} 条提取出来的字符串没有中文译文（重新跑一次提取，再补译文）",
		)

	def test_catalog_has_no_orphans(self):
		"""A translation whose source string is gone is stale, not harmless."""
		extracted = {m.id for m in _catalog("main.pot") if m.id}

		orphans = [m.id for m in _catalog("zh.po") if m.id and m.id not in extracted]

		self.assertEqual([], orphans, f"{len(orphans)} 条译文的原文已不存在，应从 zh.po 移除")
