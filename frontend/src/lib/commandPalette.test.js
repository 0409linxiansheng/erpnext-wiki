import assert from 'node:assert/strict';
import test from 'node:test';

import { buildResultGroups } from './commandPalette.js';

const titles = {
	jump: 'Jump to',
	spaces: 'Spaces',
	pages: 'Pages',
	recent: 'Recent',
};
const jumpTo = [{ key: 'overview', label: 'All Spaces' }];
const spaces = [
	{ key: 'space:docs', label: 'Docs' },
	{ key: 'space:eng', label: 'Engineering' },
];
const recent = [{ key: 'page:9', label: 'Release notes' }];

// Pages arrive from the full-text endpoint already filtered and ranked; the client
// only orders them by `score` (with the space bias). The default fixture is empty so
// a query that should not produce pages does not inherit a page group; the ordering
// tests pass their own scored pages explicitly.
const pages = [];

function build(query, overrides = {}) {
	return buildResultGroups(query, {
		jumpTo,
		spaces,
		pages,
		recent,
		titles,
		...overrides,
	});
}

function labels(groups) {
	return groups.map((group) => [group.id, group.items.map((i) => i.label)]);
}

test('offers destinations and recent pages for an empty query', () => {
	assert.deepEqual(labels(build('  ')), [
		['jump', ['All Spaces']],
		['recent', ['Release notes']],
	]);
});

test('drops the recent group when there is nothing recent', () => {
	assert.deepEqual(labels(build('', { recent: [] })), [['jump', ['All Spaces']]]);
});

test('drops client-matched groups that have no match', () => {
	// Pages are pre-filtered by the server and trusted as-is; the caller passes an
	// empty list when nothing matched. Spaces/actions are still matched client-side,
	// so this pins the split rather than pretending pages filter here too.
	assert.deepEqual(labels(build('engin', { pages: [] })), [['spaces', ['Engineering']]]);
});

test('orders pages by the server score, not by anything the client computes', () => {
	const ranked = [
		{ key: 'page:3', label: 'Onboarding', score: 1 },
		{ key: 'page:1', label: 'Deploying to production', score: 3 },
		{ key: 'page:2', label: 'Getting Started', score: 2 },
	];
	const [group] = build('anything', {
		pages: ranked,
		jumpTo: [],
		spaces: [],
		actions: [],
	});
	assert.deepEqual(
		group.items.map((item) => item.key),
		['page:1', 'page:2', 'page:3'],
	);
});

test('the space bias nudges the current space without reordering the rest', () => {
	const ranked = [
		{ key: 'page:1', label: 'Deploy', score: 10 },
		{ key: 'page:2', label: 'Deployment checklist', score: 8, scoreScale: 1.5 },
	];
	const [group] = build('deploy', { pages: ranked, jumpTo: [], spaces: [], actions: [] });
	// 10 vs 8 * 1.5 = 12 — the biased row wins; with the bias removed it does not.
	assert.deepEqual(
		group.items.map((item) => item.key),
		['page:2', 'page:1'],
	);

	const plain = ranked.map(({ scoreScale, ...item }) => item);
	const [unbiased] = build('deploy', { ...{ pages: plain }, jumpTo: [], spaces: [], actions: [] });
	assert.equal(unbiased.items[0].key, 'page:1');
});

test('a missing score sorts as the weakest match, not as NaN', () => {
	const ranked = [
		{ key: 'page:a', label: 'No score', score: undefined },
		{ key: 'page:b', label: 'Scored', score: 2 },
	];
	const [group] = build('anything', { pages: ranked, jumpTo: [], spaces: [], actions: [] });
	assert.deepEqual(
		group.items.map((item) => item.key),
		['page:b', 'page:a'],
	);
});

test('ignores page rows below the server query length', () => {
	assert.equal(build('d').some((group) => group.id === 'pages'), false);
});

test('lists actions above recent pages for an empty query', () => {
	const actions = [{ key: 'toggle-theme', label: 'Toggle theme' }];
	assert.deepEqual(labels(build('', { actions })), [
		['jump', ['All Spaces']],
		['actions', ['Toggle theme']],
		['recent', ['Release notes']],
	]);
});

test('matches an action by an alias it does not render', () => {
	const actions = [
		{
			key: 'toggle-theme',
			label: 'Toggle theme',
			search: 'toggle theme dark light mode',
		},
	];
	assert.deepEqual(labels(build('dark', { actions })), [
		['actions', ['Toggle theme']],
	]);
});

test('hides query-only actions for an empty query', () => {
	const actions = [
		{ key: 'toggle-theme', label: 'Toggle theme' },
		{ key: 'theme-dark', label: 'Theme: Dark', queryOnly: true },
	];
	assert.deepEqual(labels(build('', { actions })), [
		['jump', ['All Spaces']],
		['actions', ['Toggle theme']],
		['recent', ['Release notes']],
	]);
});

test('matches only the theme named in the query', () => {
	const actions = [
		{
			key: 'toggle-theme',
			label: 'Toggle theme',
			search: 'toggle theme mode appearance',
		},
		{
			key: 'theme-dark',
			label: 'Theme: Dark',
			search: 'theme dark mode appearance',
			queryOnly: true,
		},
		{
			key: 'theme-light',
			label: 'Theme: Light',
			search: 'theme light mode appearance',
			queryOnly: true,
		},
	];
	assert.deepEqual(labels(build('light', { actions })), [
		['actions', ['Theme: Light']],
	]);
	assert.deepEqual(labels(build('dark', { actions })), [
		['actions', ['Theme: Dark']],
	]);
});
