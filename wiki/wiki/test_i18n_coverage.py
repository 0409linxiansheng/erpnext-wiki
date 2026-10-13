# Copyright (c) 2026, Frappe and Contributors
# See license.txt

"""Guards the app's translation catalogs.

`wiki/locale/main.pot` is the extraction of every translatable string in this app
and `wiki/locale/zh.po` is the catalog that ships with it. See
`specs/i18n_chinese_first.md` for the mechanism and the workflow.

Two different guarantees, on two different clocks:

* **Orphans are always wrong.** A translation whose source string no longer exists
  is stale the moment it appears, so that check is unconditional.
* **Missing translations are a release gate, not a per-commit one.** Features are
  written first and translated in bulk through `wlh_translate` afterwards, so a new
  English string is expected to sit untranslated in the catalog for a while. Run
  `WIKI_I18N_STRICT=1` to turn coverage into a failure — that is the check to run
  before shipping, and the skip message reports the backlog while it waits.
"""

import os
import unittest
from pathlib import Path

from babel.messages.pofile import read_po

LOCALE = Path(__file__).resolve().parents[1] / "locale"


def _catalog(name):
	with (LOCALE / name).open("rb") as handle:
		return read_po(handle)


def _pending_translations() -> list[str]:
	zh = {m.id: m for m in _catalog("zh.po") if m.id}

	return [
		m.id for m in _catalog("main.pot") if m.id and not (zh.get(m.id) and zh[m.id].string)
	]


PENDING = _pending_translations()


class TestTranslationCoverage(unittest.TestCase):
	def test_catalogs_exist(self):
		for name in ("main.pot", "zh.po"):
			self.assertTrue((LOCALE / name).exists(), f"{name} 不存在")

	def test_catalog_has_no_orphans(self):
		"""A translation whose source string is gone is stale, not harmless."""
		extracted = {m.id for m in _catalog("main.pot") if m.id}

		orphans = [m.id for m in _catalog("zh.po") if m.id and m.id not in extracted]

		self.assertEqual([], orphans, f"{len(orphans)} 条译文的原文已不存在，应从 zh.po 移除")

	@unittest.skipUnless(
		os.environ.get("WIKI_I18N_STRICT"),
		f"发布闸门：还有 {len(PENDING)} 条待译（由 wlh_translate 统一翻译）。"
		"设 WIKI_I18N_STRICT=1 可让此检查失败。",
	)
	def test_every_extracted_string_is_translated(self):
		"""The catalog has to answer for everything the extractor finds."""
		self.assertEqual(
			[],
			PENDING[:20],
			f"{len(PENDING)} 条提取出来的字符串没有中文译文（重新跑一次提取，再补译文）",
		)
