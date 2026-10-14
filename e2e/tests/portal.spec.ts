import { expect, test } from '../fixtures';
import { getDoc, setValue } from '../helpers/frappe';
import { APP_BASE } from '../helpers/routes';

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

	test('the Wiki Portal config drives the page', async ({ browser, baseURL, request }) => {
		// The single is global and the owner edits it by hand: snapshot it, and put
		// it back exactly as it was found.
		const original = await getDoc<Record<string, unknown>>(
			request,
			'Wiki Portal',
			'Wiki Portal',
		);
		const token = `PortalCfg${Date.now().toString(36)}`;

		const guest = await browser.newContext({
			baseURL,
			storageState: { cookies: [], origins: [] },
		});
		const guestPage = await guest.newPage();
		try {
			await setValue(request, 'Wiki Portal', 'Wiki Portal', {
				title: `${token} Centre`,
				footer_text: `${token} footer`,
			});

			await guestPage.goto('/portal');

			await expect(guestPage.getByTestId('portal-title')).toHaveText(`${token} Centre`);
			await expect(guestPage.getByTestId('portal-footer')).toContainText(`${token} footer`);
		} finally {
			await guest.close();
			await setValue(request, 'Wiki Portal', 'Wiki Portal', {
				title: original.title ?? '',
				footer_text: original.footer_text ?? '',
			});
		}
	});

	test('the Portal tab in the app settings saves it', async ({ browser, baseURL, page, request }) => {
		const original = await getDoc<Record<string, unknown>>(
			request,
			'Wiki Portal',
			'Wiki Portal',
		);
		const token = `PortalTab${Date.now().toString(36)}`;

		const guest = await browser.newContext({
			baseURL,
			storageState: { cookies: [], origins: [] },
		});
		const guestPage = await guest.newPage();
		try {
			await page.setViewportSize({ width: 1200, height: 900 });
			// The dialog opens for a Wiki Manager; this is how the existing settings
			// spec opens it.
			await page.goto(`${APP_BASE}?github_app_created=1`);

			const dialog = page.getByRole('dialog');
			await expect(dialog).toBeVisible({ timeout: 15000 });

			await dialog.getByRole('tab', { name: 'Portal', exact: true }).click();
			await dialog.getByTestId('portal-heading').fill(`${token} Centre`);
			await dialog.getByTestId('portal-save').click();

			// What the panel saved is what an anonymous visitor sees.
			await guestPage.goto('/portal');
			await expect(guestPage.getByTestId('portal-title')).toHaveText(`${token} Centre`);
		} finally {
			await guest.close();
			await setValue(request, 'Wiki Portal', 'Wiki Portal', {
				title: original.title ?? '',
			});
		}
	});
});
