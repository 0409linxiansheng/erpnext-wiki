import assert from 'node:assert/strict';
import test from 'node:test';

import { CodeBlock } from '@tiptap/extension-code-block';
import { MarkdownManager } from '@tiptap/markdown';

import { WikiBlockMath } from './math-block.js';
import { WikiInlineMath } from './math-inline.js';
import { PreserveBlankLines } from './preserve-blank-lines.js';
import { wikiStarterKit } from './wiki-starterkit.js';

/**
 * Regression coverage for the maths markdown round-trip.
 *
 * The delimiter rules are strict on purpose: a bare `$` is currency far more
 * often than it is maths, and `mdit_py_plugins.dollarmath` (configured in
 * `wiki/wiki/markdown.py` with `allow_space=False, allow_digits=False`) makes the
 * same call. If the editor disagreed, a paragraph would render as a formula here
 * and as literal text once published.
 *
 * The node extensions import no `.vue`, so `node --test` can load the real ones.
 * A fixed point alone proves nothing about fidelity — content that degrades to
 * plain text round-trips just as stably — so every case asserts the parsed node
 * types too.
 */
function buildManager() {
	const starterKit = wikiStarterKit();
	const baseExtensions = starterKit.config.addExtensions.call({
		options: starterKit.options,
		name: 'starterKit',
	});
	return new MarkdownManager({
		extensions: [
			...baseExtensions,
			CodeBlock,
			PreserveBlankLines,
			WikiInlineMath,
			WikiBlockMath,
		],
		markedOptions: { breaks: true },
	});
}

function nodeTypes(node, found = []) {
	if (node && typeof node === 'object') {
		// Skip the `doc` root so callers assert over real content nodes.
		if (typeof node.type === 'string' && node.type !== 'doc') found.push(node.type);
		if (Array.isArray(node.content)) {
			for (const child of node.content) nodeTypes(child, found);
		}
	}
	return found;
}

function findFirst(node, type) {
	if (!node || typeof node !== 'object') return null;
	if (node.type === type) return node;
	for (const child of node.content || []) {
		const match = findFirst(child, type);
		if (match) return match;
	}
	return null;
}

/** Serialize -> parse -> serialize, `passes` times, collecting each output. */
function roundTrip(manager, source, passes = 3) {
	const outputs = [];
	let current = source;
	for (let i = 0; i < passes; i++) {
		current = manager.serialize(manager.parse(current));
		outputs.push(current);
	}
	return outputs;
}

test('inline maths parses to an inlineMath node', () => {
	const doc = buildManager().parse('The value is $x^2$ here');
	const math = findFirst(doc, 'inlineMath');

	assert.ok(math, 'expected an inlineMath node');
	assert.equal(math.attrs.latex, 'x^2');
});

test('block maths parses to a blockMath node', () => {
	const doc = buildManager().parse('$$\n\\int_0^1 x\\,dx\n$$');
	const math = findFirst(doc, 'blockMath');

	assert.ok(math, 'expected a blockMath node');
	assert.equal(math.attrs.latex, '\\int_0^1 x\\,dx');
});

test('single-line block maths is still block, not inline', () => {
	const doc = buildManager().parse('$$x^2$$');
	assert.deepEqual(nodeTypes(doc), ['blockMath']);
});

test('a multi-line aligned body stays one blockMath node', () => {
	const source =
		'$$\n\\begin{aligned}\nx &= 1 \\\\\ny &= 2\n\\end{aligned}\n$$';
	const math = findFirst(buildManager().parse(source), 'blockMath');

	assert.ok(math, 'expected a blockMath node');
	assert.match(math.attrs.latex, /\\begin\{aligned\}/);
	assert.match(math.attrs.latex, /x &= 1/);
});

test('a currency string is not maths', () => {
	const doc = buildManager().parse('It costs $5 and $6 today');
	assert.ok(!nodeTypes(doc).includes('inlineMath'));
});

test('a $ near a digit after the closer is not maths', () => {
	const doc = buildManager().parse('row $a$2 wins');
	assert.ok(!nodeTypes(doc).includes('inlineMath'));
});

test('a $ inside a code span is not maths', () => {
	const doc = buildManager().parse('Use `$x$` to write maths');
	assert.ok(!nodeTypes(doc).includes('inlineMath'));
});

test('a $ inside a fenced code block is not maths', () => {
	const doc = buildManager().parse('```\n$$\nx$$\n```');
	const types = nodeTypes(doc);

	assert.ok(types.includes('codeBlock'));
	assert.ok(!types.includes('blockMath'));
	assert.ok(!types.includes('inlineMath'));
});

test('inline maths round-trips to a fixed point', () => {
	const manager = buildManager();
	const outputs = roundTrip(manager, 'Einstein wrote $E = mc^2$.');

	assert.deepEqual(outputs, Array(outputs.length).fill(outputs[0]));
	assert.match(outputs[0], /\$E = mc\^2\$/);
});

test('block maths round-trips to a fixed point', () => {
	const manager = buildManager();
	const outputs = roundTrip(
		manager,
		'Before.\n\n$$\n\\int_0^1 x\\,dx\n$$\n\nAfter.',
	);

	assert.deepEqual(outputs, Array(outputs.length).fill(outputs[0]));
	assert.match(outputs[0], /\$\$\n\\int_0\^1 x\\,dx\n\$\$/);
});

test('inline and block maths survive side by side', () => {
	const manager = buildManager();
	const source =
		'Inline $a+b$ and block:\n\n$$\nc^2\n$$';
	const outputs = roundTrip(manager, source);

	assert.deepEqual(outputs, Array(outputs.length).fill(outputs[0]));
});