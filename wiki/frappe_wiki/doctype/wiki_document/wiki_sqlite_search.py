import re
from typing import ClassVar

import frappe
from frappe.search.sqlite_search import SQLiteSearch

from wiki.cjk import has_cjk, segment_cjk

# Frappe v15 inserts a new row on every index_doc and never drops the old one.
INDEX_DOC_APPENDS = int(frappe.__version__.split(".", 1)[0]) < 16


class WikiSQLiteSearch(SQLiteSearch):
	# Bumped when INDEX_SCHEMA changes: the FTS table is created with a fixed set
	# of columns, so an old file would silently reject inserts that carry the
	# `*_cjk` fields. A new name makes the next build start from scratch instead
	# of requiring operators to remember `rm …/wiki_search.db`.
	INDEX_NAME = "wiki_search_v2.db"

	INDEX_SCHEMA: ClassVar[dict] = {
		# The `*_cjk` columns hold the bigram shadow of their source column (see
		# wiki/cjk.py): SQLite's unicode61 tokenizer treats a whole Chinese
		# sentence as one token, so without them only exact full-sentence queries
		# match. The originals stay indexed and displayed, so snippets are clean.
		"text_fields": ["title", "content", "title_cjk", "content_cjk"],
		"metadata_fields": ["doctype", "name", "route", "space", "published", "modified"],
		"tokenizer": "unicode61 remove_diacritics 2 tokenchars '-_'",
	}

	INDEXABLE_DOCTYPES: ClassVar[dict] = {
		"Wiki Document": {
			"fields": [
				"name",
				"title",
				"content",
				"route",
				{"published": "is_published"},
				"modified",
			],
			"filters": {"is_published": 1, "is_group": 0, "is_external_link": 0},
		}
	}

	def get_search_filters(self):
		"""Permission-based filtering - only return published documents"""
		return {"published": 1}

	def prepare_document(self, doc):
		"""Override to compute space and strip markdown from content"""
		prepared = super().prepare_document(doc)
		if prepared and doc.get("doctype") == "Wiki Document":
			prepared["space"] = self._get_root_space(doc.get("name"))
			if prepared.get("content"):
				prepared["content"] = self._strip_markdown(prepared["content"])
			# Bigram shadows for CJK search, computed after markdown stripping so
			# syntax never contributes tokens.
			prepared["title_cjk"] = segment_cjk(prepared.get("title") or "")
			prepared["content_cjk"] = segment_cjk(prepared.get("content") or "")
		return prepared

	def _expand_query_with_corrections(self, query):
		"""Skip spelling correction for CJK queries.

		The correction pass compares whitespace-separated words against the
		indexed vocabulary. Chinese has no spaces, so the whole query would be
		treated as one "word" and either left alone or "corrected" into an
		unrelated CJK run. Bigram expansion below is the CJK equivalent.
		"""
		if has_cjk(query):
			return query, None
		return super()._expand_query_with_corrections(query)

	def _prepare_fts_query(self, query):
		"""Expand CJK runs into overlapping bigrams before FTS5 quoting."""
		return super()._prepare_fts_query(segment_cjk(query))

	def index_doc(self, doctype, docname):
		if INDEX_DOC_APPENDS:
			self.remove_doc(doctype, docname)
		super().index_doc(doctype, docname)

	def _strip_markdown(self, text):
		"""Convert markdown to plain text for cleaner search indexing"""
		if not text:
			return text

		# Remove code blocks (``` ... ```)
		text = re.sub(r"```[\s\S]*?```", " ", text)

		# Remove inline code (`code`)
		text = re.sub(r"`[^`]+`", " ", text)

		# Remove custom directives (:::note, :::danger, etc.)
		text = re.sub(r":::[a-z]+\s*", " ", text)
		text = re.sub(r":::\s*", " ", text)

		# Remove images ![alt](url)
		text = re.sub(r"!\[[^\]]*\]\([^)]+\)", " ", text)

		# Convert links [text](url) to just text
		text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)

		# Remove headers (# ## ### etc.)
		text = re.sub(r"^#{1,6}\s+", "", text, flags=re.MULTILINE)

		# Remove bold/italic markers
		text = re.sub(r"\*{1,3}([^*]+)\*{1,3}", r"\1", text)
		text = re.sub(r"_{1,3}([^_]+)_{1,3}", r"\1", text)

		# Remove blockquotes
		text = re.sub(r"^>\s+", "", text, flags=re.MULTILINE)

		# Remove horizontal rules
		text = re.sub(r"^[-*_]{3,}\s*$", "", text, flags=re.MULTILINE)

		# Remove HTML tags
		text = re.sub(r"<[^>]+>", " ", text)

		# Collapse multiple whitespace/newlines
		text = re.sub(r"\s+", " ", text)

		return text.strip()

	def _get_root_space(self, docname):
		"""Get the root wiki space for a document"""
		wiki_doc = frappe.get_doc("Wiki Document", docname)
		return wiki_doc.get_root_group() or docname


def remove_doc_on_trash(doc, method=None):
	"""Drop a deleted page from the index once the delete has committed.

	Frappe's generic delete path removes the queue row, not the SQLite index row,
	so without this a deleted page keeps answering searches (and the reader API
	then surfaces a hit whose page 404s). Deferred through after_commit so a
	rolled-back delete never costs the live entry.
	"""
	frappe.db.after_commit.add(lambda: remove_doc_from_index(doc.name))


def index_doc_on_save(doc, method=None):
	"""Index a Wiki Document the moment it is saved.

	Frappe's generic ``update_doc_index`` (the "*" on_update hook) only *queues* the
	re-index, drained by a 5-minute scheduler job, so a freshly created or edited
	page is invisible to full-text search for up to five minutes — long enough that
	the command palette and the reader both look broken. The unpublish path already
	removes synchronously (``remove_doc_from_index``); publish/edit deserve the
	same. On Frappe v16 ``enqueue_reindex`` indexes inline, so this is synchronous.
	"""
	enqueue_reindex([doc.name])


def enqueue_reindex(docnames: list[str]):
	"""Re-index Wiki Documents after a merge.

	Merge fast paths write content with raw ``frappe.db.set_value``, which
	skips the framework's on_update hook that normally triggers the re-index,
	so without this the search index keeps serving the pre-merge content.

	Goes through ``index_doc`` rather than the framework's queue table: the
	queue only exists on Frappe develop, while ``index_doc`` is present on
	version-16 too (indexing inline there, queueing on develop).
	"""
	search = WikiSQLiteSearch()
	if not (search.is_search_enabled() and search.index_exists()):
		return

	try:
		for docname in docnames:
			search.index_doc("Wiki Document", docname)
	except Exception:
		frappe.log_error(
			title="Wiki Search Reindex Error",
			message=frappe.get_traceback(),
		)


def remove_doc_from_index(docname: str):
	"""Remove a Wiki Document from the search index immediately.

	The framework's index update path only *queues* a re-index (drained by a
	5-minute scheduler job, 30 docs per run), so an unpublished page would keep
	surfacing in search until the queue catches up. Unpublishing must take
	effect right away, so we delete the row synchronously.
	"""
	search = WikiSQLiteSearch()
	if not (search.is_search_enabled() and search.index_exists()):
		return

	try:
		search.remove_doc("Wiki Document", docname)
	except Exception:
		frappe.log_error(
			title="Wiki Search Index Removal Error",
			message=f"Failed to remove Wiki Document {docname} from the search index",
		)
