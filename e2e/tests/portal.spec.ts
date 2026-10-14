import { expect, test } from '../fixtures';

/**
 * The public portal (specs/public_portal.md, Phase 2).
 *
 * `/portal` is the front door for visitors without an account, so it is asserted
 * from a deliberately logged-out context: what it lists is exactly what an
 * anonymous stranger can reach.
 */
test.describe('Public portal', () => {
	test('an anonymous guest sees a Public space on /portal', async ({ browser, baseURL, wiki }) => {
		const token = `Portal${Date.now().toString(36)}`;
		const space = await wiki.space({
			visibility: 'Public',
			space_name: `${token} Handbook`,
			pages: [{ title: 'First' }, { title: 'Second' }],
		});

		const guest = await browser.newContext({
			baseURL,
			storageState: { cookies: [], origins: [] },
		});
		const guestPage = await guest.newPage();
		try {
			await guestPage.goto('/portal');

			const card = guestPage
				.getByTestId('portal-space-card')
				.filter({ hasText: `${token} Handbook` });
			await expect(card).toBeVisible();
			await expect(card).toContainText('2 pages');

			await card.click();
			await expect(guestPage).toHaveURL(new RegExp(space.route));
		} finally {
			await guest.close();
		}
	});

	test('a non-public space never appears on /portal', async ({ browser, baseURL, wiki }) => {
		const token = `Hidden${Date.now().toString(36)}`;
		await wiki.space({
			space_name: `${token} Handbook`,
			pages: [{ title: 'Members only' }],
		});

		const guest = await browser.newContext({
			baseURL,
			storageState: { cookies: [], origins: [] },
		});
		const guestPage = await guest.newPage();
		try {
			await guestPage.goto('/portal');

			await expect(guestPage.getByText(`${token} Handbook`)).toHaveCount(0);
		} finally {
			await guest.close();
		}
	});
});
