/**
 * Map a Frappe language code to a dayjs locale name.
 *
 * Pure on purpose (no `dayjs` import), so the mapping is unit-testable in node and
 * the dayjs wiring lives where the dayjs instance already is (main.js).
 *
 * dayjs ships English; `fromNow()` keeps saying "a day ago" until a locale module
 * is loaded *and selected*. This maps the site/user language to that module name.
 */
export const DAYJS_LOCALE = {
	zh: 'zh-cn',
	'zh-cn': 'zh-cn',
	'zh-tw': 'zh-tw',
	'zh-hk': 'zh-hk',
	de: 'de',
};

export function resolveDayjsLocale(lang) {
	const exact = DAYJS_LOCALE[lang];
	if (exact) return exact;

	const base = (lang || '').split('-')[0];
	return DAYJS_LOCALE[base] || base || 'en';
}
