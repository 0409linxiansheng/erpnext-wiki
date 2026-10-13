import { expect, test } from '../fixtures';
import { appUrl } from '../helpers/routes';

/**
 * The Overview search box (Alexandrie port, spec 03): the dashboard's front door
 * runs the same full-text search as the reader and the palette, and opens the
 * page it finds.
 */

test.describe('Overview search', () => {
	test('finds a page from the dashboard and opens it', async ({ page, wiki }) => {
		const token = `OverviewSearch${Date.now().toString(36)}`;
		const space = await wiki.space({
			space_name: `${token} Space`,
			pages: [{ title: `${token} Runbook` }],
		});

		await page.goto(appUrl('overview'));
		const box = page.getByTestId('overview-search').getByRole('textbox');
		await expect(box).toBeVisible({ timeout: 10000 });

		await box.fill(token);
		const result = page.getByRole('option', { name: new RegExp(`${token} Runbook`) });
		await expect(result).toBeVisible();
		await result.click();

		await expect(page).toHaveURL(space.url('page', space.page(`${token} Runbook`).name));
	});
});
