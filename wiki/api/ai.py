"""Ask the wiki a question.

Retrieval is always available: the existing full-text search (already filtered
by page access) supplies the passages. Answer *generation* needs a model and is
optional — configure an OpenAI-compatible endpoint in the site config:

    wiki_ai_api_key  = "sk-..."
    wiki_ai_base_url = "https://api.deepseek.com/v1"   (default)
    wiki_ai_model    = "deepseek-chat"                 (default)

Without a key the endpoint answers with the ranked sources, and says so, rather
than pretending to be an assistant. The model only ever sees pages the asking
user could open, because retrieval runs as that user.
"""

from __future__ import annotations

import re

import frappe
from frappe import _

MAX_SOURCES = 5
CONTEXT_CHARS = 1500
DEFAULT_BASE_URL = "https://api.deepseek.com/v1"
DEFAULT_MODEL = "deepseek-chat"
_TAG_RE = re.compile(r"<[^>]+>")


def _plain(text: str) -> str:
	"""Search highlights arrive as <mark>…</mark>; the model and the UI want text."""
	return _TAG_RE.sub("", text or "")

SYSTEM_PROMPT = (
	"你是企业知识库的问答助手。只依据提供的资料回答；资料不足时明确说“资料中没有”。"
	"用简体中文回答，简洁、分点。不要编造链接或数据。"
)


@frappe.whitelist()
def ask(question: str) -> dict:
	text = (question or "").strip()
	if not text:
		frappe.throw(_("Ask something first."), frappe.ValidationError)
	if len(text) > 1000:
		frappe.throw(_("Keep the question under 1000 characters."), frappe.ValidationError)

	sources = _retrieve(text)
	answer, mode = _answer(text, sources)
	return {"answer": answer, "mode": mode, "sources": sources}


def _retrieve(question: str) -> list[dict]:
	from wiki.frappe_wiki.doctype.wiki_document.search import search

	result = search(query=question)
	sources = []
	for hit in (result.get("results") or [])[:MAX_SOURCES]:
		doc = frappe.get_doc("Wiki Document", hit["name"])
		sources.append(
			{
				"name": hit["name"],
				"title": _plain(hit["title"]),
				# The controller knows how a page is addressed in the app (and
				# whether it is a GitHub-synced page with a different edit URL).
				"url": doc.get_edit_link() or (f"/{doc.route}" if doc.route else ""),
				"snippet": _plain(hit.get("content") or "")[:CONTEXT_CHARS],
			}
		)
	return sources


def _answer(question: str, sources: list[dict]) -> tuple[str, str]:
	key = frappe.conf.get("wiki_ai_api_key")
	if not key:
		return _retrieval_answer(sources), "search"
	if not sources:
		return _("没有在知识库中找到相关内容。换个说法，或先补充相关页面。"), "search"

	try:
		return _call_model(question, sources, key), "ai"
	except Exception:
		frappe.log_error(title="Wiki AI answer failed")
		return _retrieval_answer(sources), "search"


def _retrieval_answer(sources: list[dict]) -> str:
	if not sources:
		return _("没有找到相关文档。")
	return _("根据知识库检索，以下页面最相关（尚未配置 AI 模型，先给出检索结果）：")


def _call_model(question: str, sources: list[dict], key: str) -> str:
	import requests

	context = "\n\n".join(
		f"[{index}] {source['title']}\n{source['snippet']}"
		for index, source in enumerate(sources, start=1)
	)
	base = (frappe.conf.get("wiki_ai_base_url") or DEFAULT_BASE_URL).rstrip("/")
	response = requests.post(
		f"{base}/chat/completions",
		headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
		json={
			"model": frappe.conf.get("wiki_ai_model") or DEFAULT_MODEL,
			"temperature": 0.2,
			"messages": [
				{"role": "system", "content": SYSTEM_PROMPT},
				{"role": "user", "content": f"资料：\n{context}\n\n问题：{question}"},
			],
		},
		timeout=60,
	)
	response.raise_for_status()
	payload = response.json()
	return (payload["choices"][0]["message"]["content"] or "").strip()
