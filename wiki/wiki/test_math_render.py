# Copyright (c) 2026, Frappe and Contributors
# See license.txt

"""Tests for the print-side maths pass.

The TeX → SVG step is node's job (`scripts/render-math.mjs`) and is exercised
end to end against a real document; what is worth pinning here is the pure
plumbing around it — which containers are found, that escaped TeX is un-escaped
before it reaches the renderer, that the container survives so the print CSS
still applies, and that an unsafe URL can never pass through.

No `frappe` state is touched: `render_math_for_print` is the only function that
needs a site, and it is not called here.
"""

import unittest

from wiki.wiki.math_render import (
	replace_containers,
	sanitize_svg,
	split_containers,
)


class TestSplitContainers(unittest.TestCase):
	def test_inline_container(self):
		found = split_containers('The value is <span class="math math-inline">x^2</span> here')

		self.assertEqual(1, len(found))
		self.assertEqual("x^2", found[0]["tex"])
		self.assertFalse(found[0]["display"])

	def test_block_container(self):
		found = split_containers('<div class="math math-block">\\int_0^1 x\\,dx</div>\n')

		self.assertEqual(1, len(found))
		self.assertTrue(found[0]["display"])
		self.assertIn("\\int_0^1", found[0]["tex"])

	def test_escaped_tex_is_unescaped_for_the_renderer(self):
		"""`markdown.py` escapes the source; MathJax needs the real characters."""
		found = split_containers('<span class="math math-inline">a &lt; b &amp;&amp; c</span>')

		self.assertEqual("a < b && c", found[0]["tex"])

	def test_both_kinds_in_one_document(self):
		content = (
			'<p>Use <span class="math math-inline">x</span></p>\n'
			'<div class="math math-block">y</div>\n'
		)
		found = split_containers(content)

		self.assertEqual(["x", "y"], [item["tex"] for item in found])

	def test_no_containers(self):
		self.assertEqual([], split_containers("<p>plain</p>"))
		self.assertEqual([], split_containers(""))
		self.assertEqual([], split_containers(None))


class TestReplaceContainers(unittest.TestCase):
	def test_svg_replaces_the_tex_and_keeps_the_container(self):
		content = 'before <span class="math math-inline">x^2</span> after'
		containers = split_containers(content)

		out = replace_containers(content, containers, {"0": "<svg>X</svg>"})

		self.assertIn('<span class="math math-inline"><svg>X</svg></span>', out)
		self.assertNotIn("x^2", out)
		self.assertTrue(out.startswith("before "))
		self.assertTrue(out.endswith(" after"))

	def test_block_keeps_its_div(self):
		content = '<div class="math math-block">y</div>\n'
		out = replace_containers(content, split_containers(content), {"0": "<svg>Y</svg>"})

		self.assertEqual('<div class="math math-block"><svg>Y</svg></div>\n', out)

	def test_a_container_without_an_svg_keeps_its_tex(self):
		content = (
			'<span class="math math-inline">a</span>'
			'<span class="math math-inline">b</span>'
		)
		out = replace_containers(content, split_containers(content), {"1": "<svg>B</svg>"})

		self.assertIn('<span class="math math-inline">a</span>', out)
		self.assertIn('<span class="math math-inline"><svg>B</svg></span>', out)

	def test_text_outside_the_containers_is_untouched(self):
		content = '<p>keep <b>this</b></p><span class="math math-inline">x</span><p>and this</p>'
		out = replace_containers(content, split_containers(content), {"0": "<svg>S</svg>"})

		self.assertIn("<p>keep <b>this</b></p>", out)
		self.assertIn("<p>and this</p>", out)


class TestSanitizeSvg(unittest.TestCase):
	def test_javascript_href_is_dropped(self):
		svg = '<a href="javascript:alert(1)"><g/></a>'

		self.assertNotIn("javascript", sanitize_svg(svg))

	def test_xlink_javascript_is_dropped(self):
		svg = '<a xlink:href="javascript:alert(1)"></a>'

		self.assertNotIn("javascript", sanitize_svg(svg))

	def test_safe_hrefs_survive(self):
		svg = '<a href="https://example.com"><a href="mailto:a@b.c"><a href="#x">'

		self.assertEqual(svg, sanitize_svg(svg))
