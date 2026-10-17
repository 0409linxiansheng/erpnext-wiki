"""CJK-aware tokenisation for the SQLite FTS index.

SQLite's `unicode61` tokenizer splits on non-alphanumeric characters, and CJK
ideographs count as alphanumeric: a whole Chinese sentence becomes a single
token, so searching for a word inside it finds nothing.

We index an extra space-separated **bigram shadow** of every CJK run
("库存盘点" -> "库存 存盘 盘点") and expand the query the same way. Overlapping
bigrams give substring-grade recall for words of two or more characters with no
extra dependency and no query-time tokenizer to keep in sync. The original text
stays indexed untouched, so snippets and highlighting remain readable.
"""

from __future__ import annotations

import re

# CJK Unified Ideographs (+ Ext A, + compatibility ideographs). Enough for
# Simplified/Traditional Chinese, kana and hangul are handled by the same
# mechanism when they show up, because the range covers the common blocks.
_CJK_RUN = re.compile(r"[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]+")


def has_cjk(text: str | None) -> bool:
	return bool(text and _CJK_RUN.search(text))


def _bigrams(run: str) -> str:
	if len(run) == 1:
		return run
	return " ".join(run[i : i + 2] for i in range(len(run) - 1))


def segment_cjk(text: str | None) -> str:
	"""Space-separate overlapping bigrams inside each CJK run.

	ASCII words, punctuation and markdown syntax pass through untouched, so the
	result is still a valid FTS5 document / query once quoted per token.
	"""
	if not text:
		return ""
	return _CJK_RUN.sub(lambda match: _bigrams(match.group(0)), text)
