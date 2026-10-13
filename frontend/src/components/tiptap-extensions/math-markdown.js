/**
 * Shared maths constants and markdown tokenizers for inline and block maths.
 *
 * Split out of math-inline.js / math-block.js so the delimiter rules can be
 * unit tested — the same shape as mermaid-markdown.js and callout-markdown.js.
 * The node extensions keep the KaTeX rendering; only the "what counts as maths"
 * decision and the defaults live here.
 *
 * The rules mirror `mdit_py_plugins.dollarmath`, configured on the server in
 * `wiki/wiki/markdown.py` as `allow_space=False, allow_digits=False`. Editor and
 * server have to agree, or a `$` the editor turns into a formula prints as
 * literal text once the page is published — and a bare `$` is currency far more
 * often than it is maths (`It costs $5 and $6`).
 */

/**
 * KaTeX options shared by both node views. `trust: false` is the security
 * -relevant one: `\href{javascript:alert(1)}{x}` must never become a link.
 * `throwOnError: false` leaves an invalid formula on screen as red source text
 * instead of throwing it away, which is friendlier while typing.
 */
export const MATH_KATEX_OPTIONS = {
	throwOnError: false,
	strict: false,
	trust: false,
};

/**
 * Default bodies inserted by the slash command and the toolbar.
 * `insertInlineMath` / `insertBlockMath` return false on an empty body, so the
 * insertion points cannot pass nothing.
 */
export const DEFAULT_INLINE_MATH_LATEX = 'E = mc^2';
export const DEFAULT_BLOCK_MATH_LATEX =
	'\\int_{-\\infty}^{\\infty} e^{-x^2}\\,dx = \\sqrt{\\pi}';

/**
 * Inline `$…$`.
 *
 * `(?!\s)` after the opening `$` and `[^\s$]` before the closing one mirror
 * `allow_space=False`; `(?![\d$])` after the closing `$` mirrors
 * `allow_digits=False` and keeps a `$$` opener out of the inline rule. Single
 * line, and never empty.
 */
export const INLINE_MATH_RE = /^\$(?!\s)([^$\n]*?[^\s$])\$(?![\d$])/;

/**
 * Block `$$…$$`.
 *
 * Anchored at the start (marked hands the tokenizer the full remaining buffer,
 * so position 0 is a line start) and whole-line at the end — `[ \t]*` then
 * end-of-line mirrors dollarmath's `lineText.strip().endswith('$$')`. The body
 * is lazy so `$$` inside it is not mistaken for the close; `\begin{aligned}`
 * spans lines but uses no dollars.
 */
export const BLOCK_MATH_RE = /^\$\$([\s\S]+?)\$\$[ \t]*(?=\n|$)/;

export function parseInlineMathSource(src) {
	const match = INLINE_MATH_RE.exec(src);
	if (!match) return null;

	return { raw: match[0], latex: match[1] };
}

export function parseBlockMathSource(src) {
	const match = BLOCK_MATH_RE.exec(src);
	if (!match) return null;

	const latex = match[1].trim();
	// An empty body is not maths; `$$$$` is not a formula.
	if (!latex) return null;

	return { raw: match[0], latex };
}

export const inlineMathMarkdownTokenizer = {
	name: 'inlineMath',
	level: 'inline',

	// Only bounds the fallback text token (marked's `startInline`); the real
	// match is anchored in `tokenize`.
	start: (src) => src.indexOf('$'),

	tokenize(src) {
		const parsed = parseInlineMathSource(src);
		if (!parsed) return undefined;

		return { type: 'inlineMath', raw: parsed.raw, latex: parsed.latex };
	},
};

export const blockMathMarkdownTokenizer = {
	name: 'blockMath',
	level: 'block',

	start: (src) => src.indexOf('$$'),

	tokenize(src) {
		const parsed = parseBlockMathSource(src);
		if (!parsed) return undefined;

		return { type: 'blockMath', raw: parsed.raw, latex: parsed.latex };
	},
};