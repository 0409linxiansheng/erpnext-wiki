import type { APIRequestContext } from '@playwright/test';
import { expect, test } from '../fixtures';
import { createDoc, deleteDoc, getList } from '../helpers/frappe';
import { createDraftAndOpenEditor } from '../helpers/wiki';

/**
 * Snippets (Alexandrie port, spec 02).
 *
 * A snippet is text inserted at the cursor, so the proof is: the stored markdown
 * ends up in the editor, parsed by the same rules a paste obeys.
 *
 * The library is per-user and real data, so every snippet these tests create is
 * removed again in `afterEach` — the site is not a scratch pad. Seeding goes
 * through the suite's own `createDoc` so the CSRF token is carried.
 */

const PREFIX = 'e2e-snippet';

function createSnippet(request: APIRequestContext, title: string, content: string) {
	return createDoc<{ name: string }>(request, 'Wiki Snippet', { title, content });
}

async function removeSnippets(request: APIRequestContext) {
	const rows = await getList<{ name: string }>(request, 'Wiki Snippet', {
		fields: ['name'],
		filters: { title: ['like', `${PREFIX}%`] },
		limit: 0,
	});

	for (const row of rows) {
		await deleteDoc(request, 'Wiki Snippet', row.name);
	}
}

async function openPicker(page: import('@playwright/test').Page) {
	await page.keyboard.type('/snippet');
	await page
		.locator('.slash-commands-list')
		.getByText('Snippet', { exact: true })
		.click();
	await expect(page.getByText('Insert snippet')).toBeVisible();
}

test.describe('snippets', () => {
	test.afterEach(async ({ request }) => {
		await removeSnippets(request);
	});

	test('the slash menu inserts a stored snippet as markdown', async ({ page, wiki, request }) => {
		await createSnippet(request, `${PREFIX} signature`, 'Best,\n\nAda\n');

		const editor = await createDraftAndOpenEditor(page, await wiki.space(), `snip-${Date.now()}`);

		await editor.click();
		await openPicker(page);
		await page.getByText(`${PREFIX} signature`, { exact: true }).click();

		await expect(editor).toContainText('Best,');
		await expect(editor).toContainText('Ada');

		// The trigger text is gone: the command's range was replaced, not appended to.
		await expect(editor).not.toContainText('/snippet');
	});

	test('a snippet created in the picker is immediately insertable', async ({ page, wiki }) => {
		const editor = await createDraftAndOpenEditor(
			page,
			await wiki.space(),
			`snip-new-${Date.now()}`,
		);

		await editor.click();
		await openPicker(page);

		const title = `${PREFIX} closing`;
		// The create form sits behind a toggle, and the placeholders are exact: the
		// page behind the dialog also has a "Page title" input.
		await page.getByRole('button', { name: 'New snippet' }).click();
		await page.getByPlaceholder('Snippet title', { exact: true }).fill(title);
		await page.getByPlaceholder('Snippet content', { exact: true }).fill('Thanks,\n\nAda');
		await page.getByRole('button', { name: 'Create' }).click();

		// Creating reloads the library, so the new snippet is in the list without a
		// reopen — that is the point of the reload.
		await page.getByText(title, { exact: true }).click();

		await expect(editor).toContainText('Thanks,');
	});

	test('a snippet is renamed and deleted from the picker', async ({ page, wiki, request }) => {
		await createSnippet(request, `${PREFIX} draft`, 'First version');

		const editor = await createDraftAndOpenEditor(
			page,
			await wiki.space(),
			`snip-edit-${Date.now()}`,
		);

		await editor.click();
		await openPicker(page);

		await page.getByRole('button', { name: 'Edit snippet' }).first().click();
		await page.getByPlaceholder('Snippet title', { exact: true }).fill(`${PREFIX} final`);
		await page.getByRole('button', { name: 'Save' }).click();
		await expect(page.getByText(`${PREFIX} final`, { exact: true })).toBeVisible();

		// Deleting is two clicks on purpose, so the second one has to be the one that
		// actually removes it.
		await page.getByRole('button', { name: 'Edit snippet' }).first().click();
		await page.getByRole('button', { name: 'Delete' }).click();
		await page.getByRole('button', { name: 'Confirm delete' }).click();

		// Assert against the server, not the list: a row disappearing from the dialog
		// would also happen if the reload simply failed.
		await expect
			.poll(async () => {
				const rows = await getList<{ name: string }>(request, 'Wiki Snippet', {
					fields: ['name'],
					filters: { title: `${PREFIX} final` },
					limit: 0,
				});
				return rows.length;
			})
			.toBe(0);
	});
});
