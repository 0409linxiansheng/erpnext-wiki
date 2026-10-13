/**
 * The snippet picker's filter and preview, kept out of the component so they can
 * be unit tested the way the markdown rules are.
 *
 * Matching is deliberately plain: a case-insensitive substring over the title,
 * and over each comma- or space-separated keyword. Snippets are a handful per
 * person, so fuzzy ranking would buy nothing and cost predictability — the
 * picker has to be obviously predictable when it is driven by arrow keys.
 */

function terms(keywords) {
	return String(keywords || '')
		.toLowerCase()
		.split(/[\s,]+/)
		.filter(Boolean);
}

export function matchesSnippet(snippet, query) {
	const needle = String(query || '')
		.trim()
		.toLowerCase();
	if (!needle) return true;

	if (String(snippet.title || '').toLowerCase().includes(needle)) return true;

	return terms(snippet.keywords).some((term) => term.includes(needle));
}

/**
 * Filter, then lift title *prefix* matches above the rest, so typing "sig"
 * offers "Signature" before "Assign signature".
 */
export function filterSnippets(snippets, query) {
	const needle = String(query || '')
		.trim()
		.toLowerCase();
	const matched = (snippets || []).filter((snippet) => matchesSnippet(snippet, query));
	if (!needle) return matched;

	return matched.sort((a, b) => {
		const aStarts = String(a.title || '')
			.toLowerCase()
			.startsWith(needle);
		const bStarts = String(b.title || '')
			.toLowerCase()
			.startsWith(needle);
		if (aStarts !== bStarts) return aStarts ? -1 : 1;
		return String(a.title || '').localeCompare(String(b.title || ''));
	});
}

/** The one-line preview under a snippet's title in the picker. */
export function previewLine(content, limit = 80) {
	const firstLine =
		String(content || '')
			.split('\n')
			.map((line) => line.trim())
			.find((line) => line.length > 0) || '';
	const collapsed = firstLine.replace(/\s+/g, ' ');
	return collapsed.length > limit ? `${collapsed.slice(0, limit - 1)}…` : collapsed;
}
