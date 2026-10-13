import { expect, test } from '../fixtures';
import { appUrl } from '../helpers/routes';

/**
 * Kanban task board (Alexandrie port, spec 04): a space's tasks in four status
 * columns, inline create, and drag-to-move between columns.
 */

test.describe('Kanban task board', () => {
	test('creates a task and drags it to Done', async ({ page, wiki }) => {
		const token = `Kanban${Date.now().toString(36)}`;
		const space = await wiki.space({ space_name: `${token} Space` });

		await page.goto(appUrl('spaces', space.name, 'tasks'));

		const backlog = page.locator('section[data-column="Backlog"]');
		await expect(backlog).toBeVisible({ timeout: 10000 });

		// Inline create in the Backlog column.
		await backlog.getByRole('button', { name: 'Add a task' }).click();
		await backlog.getByPlaceholder('Task title').fill(`${token} ship it`);
		await backlog.getByRole('button', { name: 'Add' }).click();

		const card = backlog.locator('.kanban-card', { hasText: `${token} ship it` });
		await expect(card).toBeVisible();

		// Drag the card into Done; the board writes status and reloads.
		const done = page.locator('section[data-column="Done"]');
		await card.dragTo(done);
		await expect(done.locator('.kanban-card', { hasText: `${token} ship it` })).toBeVisible();
	});

	test('deletes a task from the board', async ({ page, wiki }) => {
		const token = `KanbanDel${Date.now().toString(36)}`;
		const space = await wiki.space({ space_name: `${token} Space` });

		await page.goto(appUrl('spaces', space.name, 'tasks'));

		const backlog = page.locator('section[data-column="Backlog"]');
		await expect(backlog).toBeVisible({ timeout: 10000 });

		await backlog.getByRole('button', { name: 'Add a task' }).click();
		await backlog.getByPlaceholder('Task title').fill(`${token} gone soon`);
		await backlog.getByRole('button', { name: 'Add' }).click();

		const card = backlog.locator('.kanban-card', { hasText: `${token} gone soon` });
		await expect(card).toBeVisible();

		await card.getByRole('button', { name: 'Delete task' }).click();
		await expect(card).toHaveCount(0);
	});
});
