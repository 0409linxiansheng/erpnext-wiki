import assert from 'node:assert/strict';
import test from 'node:test';

import { filterSnippets, matchesSnippet, previewLine } from './snippetFilter.js';

const SIGNATURE = { title: 'Signature', keywords: 'sign, closing', content: 'Best,\nAda' };
const NOTICE = { title: 'Security notice', keywords: 'legal', content: '## Notice' };

test('an empty query matches everything', () => {
	assert.deepEqual(filterSnippets([SIGNATURE, NOTICE], ''), [SIGNATURE, NOTICE]);
	assert.deepEqual(filterSnippets([SIGNATURE, NOTICE], '   '), [SIGNATURE, NOTICE]);
});

test('the title matches case-insensitively', () => {
	assert.ok(matchesSnippet(SIGNATURE, 'sign'));
	assert.ok(matchesSnippet(SIGNATURE, 'SIGNATURE'));
	assert.ok(!matchesSnippet(SIGNATURE, 'invoice'));
});

test('a keyword matches', () => {
	assert.ok(matchesSnippet(SIGNATURE, 'closing'));
	assert.ok(matchesSnippet(NOTICE, 'legal'));
});

test('keywords split on commas as well as spaces', () => {
	assert.ok(matchesSnippet({ title: 'x', keywords: 'a,b  c' }, 'b'));
	assert.ok(matchesSnippet({ title: 'x', keywords: 'a,b  c' }, 'c'));
});

test('a title prefix is offered first', () => {
	const later = { title: 'Assign signature', keywords: '' };
	const first = { title: 'Signature', keywords: '' };

	assert.deepEqual(filterSnippets([later, first], 'sig'), [first, later]);
});

test('a snippet with no keywords still matches on its title', () => {
	assert.ok(matchesSnippet({ title: 'Signature' }, 'sig'));
	assert.ok(!matchesSnippet({ title: 'Signature' }, 'zzz'));
});

test('preview takes the first non-empty line and collapses whitespace', () => {
	assert.equal(previewLine('\n\n  Best,   Ada  \nsecond'), 'Best, Ada');
	assert.equal(previewLine(''), '');
	assert.equal(previewLine(undefined), '');
});

test('preview truncates with an ellipsis', () => {
	const long = 'x'.repeat(200);
	const out = previewLine(long, 20);

	assert.equal(out.length, 20);
	assert.ok(out.endsWith('…'));
});
