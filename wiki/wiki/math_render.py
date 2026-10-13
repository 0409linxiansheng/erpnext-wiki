"""Server-side TeX → SVG for the print flavour of a wiki page.

`wiki/wiki/markdown.py` emits maths as containers holding the *escaped TeX* and
`katex-renderer.js` hydrates them in the browser. wkhtmltopdf runs no JavaScript,
so the print flavour has to arrive already rendered — otherwise a formula prints
as its raw TeX source. This module is that pass: it replaces the TeX inside each
container with MathJax SVG, leaving the container itself in place so the print CSS
still applies.

See `specs/alexandrie_port/01-editor-math-and-containers.md` (Phase 5).

The TeX → SVG work happens in `scripts/render-math.mjs`, which needs the
`mathjax-full` package (`yarn install` at the app root). When that is unavailable
the pass degrades to leaving the raw TeX in place: a wrong-looking PDF beats a
PDF that fails to generate.
"""

from __future__ import annotations

import hashlib
import html as html_module
import json
import re
import subprocess
from pathlib import Path

import frappe

# The renderer is a repo script, not a module, because it needs node.
RENDERER = Path(__file__).resolve().parents[2] / "scripts" / "render-math.mjs"

# Matches what `_build_markdown` emits: `<span class="math math-inline">` and
# `<div class="math math-block">`. Group 1 is inline, group 2 is block.
CONTAINER_RE = re.compile(
	r'<span class="math math-inline">(.*?)</span>'
	r'|<div class="math math-block">(.*?)</div>',
	re.DOTALL,
)

# Defence in depth. The renderer already drops MathJax's `html` extension so
# `\href{javascript:…}` cannot build a link, but the print HTML is previewed in a
# browser, so an unsafe URL should never survive a future configuration change.
UNSAFE_HREF_RE = re.compile(r'\s(?:xlink:)?href="(?!(?:https?://|mailto:|#))[^"]*"', re.IGNORECASE)

RENDER_TIMEOUT = 60
CACHE_TTL = 60 * 60 * 24 * 30


def split_containers(content: str) -> list[dict]:
	"""Every maths container in `content`, with its TeX un-escaped.

	Returns a list of dicts with `start`, `end` (indices into `content`), `tex`
	and `display`. The container markup itself is left to the caller.
	"""
	found = []
	for match in CONTAINER_RE.finditer(content or ""):
		inline, block = match.group(1), match.group(2)
		found.append(
			{
				"start": match.start(),
				"end": match.end(),
				"tex": html_module.unescape(inline if inline is not None else block),
				"display": block is not None,
			}
		)
	return found


def replace_containers(content: str, containers: list[dict], svgs: dict[str, str]) -> str:
	"""Swap the TeX inside each container for its SVG, keeping the container.

	`svgs` is keyed by `str(index)` into `containers`. A container with no SVG
	keeps its TeX, so a formula the renderer refused still reads as source.
	"""
	out = []
	cursor = 0
	for index, item in enumerate(containers):
		svg = svgs.get(str(index))
		if not svg:
			continue
		out.append(content[cursor : item["start"]])
		tag = "div" if item["display"] else "span"
		klass = "math math-block" if item["display"] else "math math-inline"
		out.append(f'<{tag} class="{klass}">{svg}</{tag}>')
		cursor = item["end"]
	out.append(content[cursor:])
	return "".join(out)


def sanitize_svg(svg: str) -> str:
	"""Drop href attributes that are not http(s), mailto or a fragment."""
	return UNSAFE_HREF_RE.sub("", svg or "")


def _cache_key(tex: str, display: bool) -> str:
	digest = hashlib.sha1(f"{int(display)}:{tex}".encode()).hexdigest()
	return f"wiki:math_svg:{digest}"


def _cached(tex: str, display: bool) -> str | None:
	try:
		return frappe.cache().get_value(_cache_key(tex, display))
	except Exception:
		return None


def _remember(tex: str, display: bool, svg: str) -> None:
	try:
		frappe.cache().set_value(_cache_key(tex, display), svg, expires_in_sec=CACHE_TTL)
	except Exception:
		pass


def _render_missing(items: list[dict]) -> dict[str, str]:
	"""One node process for every formula that was not cached."""
	if not items:
		return {}

	payload = json.dumps(
		{
			"items": [
				{"key": str(item["index"]), "tex": item["tex"], "display": item["display"]}
				for item in items
			]
		}
	)

	try:
		completed = subprocess.run(
			["node", str(RENDERER)],
			input=payload,
			capture_output=True,
			text=True,
			timeout=RENDER_TIMEOUT,
			cwd=str(RENDERER.parent.parent),
		)
	except (OSError, subprocess.SubprocessError) as error:
		frappe.log_error(f"math render: {error}", "Wiki print maths")
		return {}

	if completed.returncode != 0:
		frappe.log_error(
			f"math render exited {completed.returncode}: {completed.stderr[:500]}",
			"Wiki print maths",
		)
		return {}

	try:
		rendered = json.loads(completed.stdout or "{}").get("svg") or {}
	except ValueError as error:
		frappe.log_error(f"math render: bad output: {error}", "Wiki print maths")
		return {}

	return {key: sanitize_svg(svg) for key, svg in rendered.items()}


def render_math_for_print(content: str) -> str:
	"""Replace every maths container's TeX with SVG, for the print flavour."""
	if not content or "math " not in content:
		return content

	containers = split_containers(content)
	if not containers:
		return content

	svgs: dict[str, str] = {}
	missing = []
	for index, item in enumerate(containers):
		cached = _cached(item["tex"], item["display"])
		if cached:
			svgs[str(index)] = cached
		else:
			missing.append({**item, "index": index})

	for key, svg in _render_missing(missing).items():
		svgs[key] = svg
		item = containers[int(key)]
		_remember(item["tex"], item["display"], svg)

	return replace_containers(content, containers, svgs)
