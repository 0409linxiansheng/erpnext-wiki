import { expect, test } from '../fixtures';

/**
 * Public visibility (specs/public_portal.md, Phase 1).
 *
 * The project's default browser context carries an admin session, so every other
 * spec — including the one named "public page" — exercises the signed-in reader.
 * These cases deliberately open a logged-out context; that is the whole point of
 * `Wiki Space.visibility`.
 */
test.describe('Public visibility', () => {
	test('an anonymous guest reads a Public space page', async ({ browser, baseURL, wiki }) => {
		const space = await wiki.space({
			visibility: 'Public',
			pages: [{ title: 'Public Page', content: 'Public body content.' }],
		});

		const guest = await browser.newContext({
			baseURL,
			storageState: { cookies: [], origins: [] },
		});
		const guestPage = await guest.newPage();
		try {
			const response = await guestPage.goto(`/${space.page('Public Page').route}`);

			expect(response?.status()).toBe(200);
			await expect(guestPage.locator('#wiki-content')).toContainText('Public body content.');
		} finally {
			await guest.close();
		}
	});

	test('an anonymous guest is refused a Logged in space page', async ({ browser, baseURL, wiki }) => {
		const space = await wiki.space({
			pages: [{ title: 'Members Page', content: 'Members only.' }],
		});

		const guest = await browser.newContext({
			baseURL,
			storageState: { cookies: [], origins: [] },
		});
		const guestPage = await guest.newPage();
		try {
			const response = await guestPage.goto(`/${space.page('Members Page').route}`);

			expect(response?.status()).toBe(404);
		} finally {
			await guest.close();
		}
	});

	test('the guest portal API lists public spaces only', async ({ browser, baseURL, wiki }) => {
		const publicSpace = await wiki.space({
			visibility: 'Public',
			space_name: `Public ${Date.now()}`,
		});
		const membersSpace = await wiki.space({ space_name: `Members ${Date.now()}` });

		const guest = await browser.newContext({
			baseURL,
			storageState: { cookies: [], origins: [] },
		});
		const guestPage = await guest.newPage();
		try {
			// A relative fetch needs a document with an origin first.
			await guestPage.goto('/');

			const names = await guestPage.evaluate(async () => {
				const response = await fetch('/api/method/wiki.api.wiki_space.get_public_spaces');
				const payload = await response.json();
				return (payload.message as { name: string }[]).map((space) => space.name);
			});

			expect(names).toContain(publicSpace.name);
			expect(names).not.toContain(membersSpace.name);
		} finally {
			await guest.close();
		}
	});

	test('a Public space route is a browsable directory for a guest', async ({
		browser,
		baseURL,
		wiki,
	}) => {
		const space = await wiki.space({
			visibility: 'Public',
			pages: [{ title: 'Alpha' }, { title: 'Beta' }],
		});

		const guest = await browser.newContext({
			baseURL,
			storageState: { cookies: [], origins: [] },
		});
		const guestPage = await guest.newPage();
		try {
			// The space's own route, with no page of its own.
			const response = await guestPage.goto(`/${space.route}`);

			expect(response?.status()).toBe(200);
			await expect(guestPage.getByTestId('space-directory-list')).toBeVisible();
			await expect(guestPage.getByTestId('space-directory-page')).toHaveCount(2);
			await expect(guestPage.getByText('Alpha')).toBeVisible();
		} finally {
			await guest.close();
		}
	});

	test('a non-public space route is not a directory for a guest', async ({
		browser,
		baseURL,
		wiki,
	}) => {
		const space = await wiki.space({ pages: [{ title: 'Members' }] });

		const guest = await browser.newContext({
			baseURL,
			storageState: { cookies: [], origins: [] },
		});
		const guestPage = await guest.newPage();
		try {
			// Bounced to the first page, which this visitor may not read.
			const response = await guestPage.goto(`/${space.route}`);

			expect(response?.status()).not.toBe(200);
			await expect(guestPage.getByTestId('space-directory-list')).toHaveCount(0);
		} finally {
			await guest.close();
		}
	});
});
