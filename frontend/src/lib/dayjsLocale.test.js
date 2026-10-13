import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveDayjsLocale } from './dayjsLocale.js';

test('maps a bare zh to zh-cn', () => {
	assert.equal(resolveDayjsLocale('zh'), 'zh-cn');
});

test('passes a region code through', () => {
	assert.equal(resolveDayjsLocale('zh-cn'), 'zh-cn');
	assert.equal(resolveDayjsLocale('zh-tw'), 'zh-tw');
	assert.equal(resolveDayjsLocale('de'), 'de');
});

test('falls back to the base of an unknown region', () => {
	assert.equal(resolveDayjsLocale('de-AT'), 'de');
});

test('passes an unknown base through, and defaults to en when there is no language', () => {
	// An unknown code passes through as its base: dayjs ships many locales beyond
	// the curated map, and a genuinely missing one falls back to English inside the
	// loader's dynamic-import catch, not here.
	assert.equal(resolveDayjsLocale('xx'), 'xx');
	assert.equal(resolveDayjsLocale(undefined), 'en');
});
