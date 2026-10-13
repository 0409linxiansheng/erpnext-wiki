import fuzzysort from 'fuzzysort';

const MATCH_THRESHOLD = 0.3;
// Pages match on their path inside the space, never the title. Stricter,
// because a short query scatter-matches letters across a long path.
const PATH_THRESHOLD = 0.5;

export const MIN_SERVER_QUERY = 2;

/**
 * Turn the palette's sources into the groups it renders, in order.
 * Groups are `{ id, title, items }`; empty groups are dropped.
 *
 * With no query the palette is a shortcut list, not a result list: the app's
 * own destinations plus the pages the user last opened.
 *
 * `pages` may still hold rows for an earlier query while a new request is in
 * flight. Ranking them against the current query drops the ones that no longer
 * match, so stale rows never need tracking.
 */
export function buildResultGroups(
	query,
	{ jumpTo, spaces, pages, recent, actions, titles },
) {
	const q = (query || '').trim();
	if (!q) {
		return [
			{ id: 'jump', title: titles.jump, items: jumpTo },
			{
				id: 'actions',
				title: titles.actions,
				items: (actions || []).filter((action) => !action.queryOnly),
			},
			{ id: 'recent', title: titles.recent, items: recent || [] },
		].filter((group) => group.items.length);
	}

	const groups = [
		{ id: 'jump', title: titles.jump, items: rank(q, jumpTo) },
		{ id: 'spaces', title: titles.spaces, items: rank(q, spaces) },
		{
			id: 'actions',
			title: titles.actions,
			items: rank(q, actions || [], { key: 'search' }),
		},
		{
			id: 'pages',
			title: titles.pages,
			// Pages arrive ranked by the server (full-text score); do not re-fuzzy
			// them, or the snippet relevance frappe already computed is thrown away.
			// The space bias still nudges the current space, as it did for fuzzysort.
			items:
				q.length >= MIN_SERVER_QUERY
					? [...(pages || [])].sort(
							(a, b) =>
								(b.score ?? 0) * (b.scoreScale ?? 1) -
								(a.score ?? 0) * (a.scoreScale ?? 1),
						)
					: [],
		},
	];
	return groups.filter((group) => group.items.length);
}

function rank(
	query,
	items,
	{ key = 'label', threshold = MATCH_THRESHOLD } = {},
) {
	return fuzzysort
		.go(query, items, { key, threshold })
		.map((result) => ({
			item: result.obj,
			score: result.score * (result.obj.scoreScale ?? 1),
		}))
		.sort((a, b) => b.score - a.score)
		.map((result) => result.item);
}
