import { expect, test } from '../fixtures';
import { createDraftAndOpenEditor } from '../helpers/wiki';

/**
 * File attachments (Alexandrie port, spec 06): a `![name](url)` whose URL is not an
 * image/video/PDF becomes a `fileAttachment` node and renders by type — audio,
 * text/code preview, or a download card — and round-trips through markdown without
 * drift, agreeing with the server renderer.
 */

declare global {
	interface Window {
		wikiEditor: {
			commands: {
				setContent: (content: string, options?: { contentType?: string }) => void;
			};
			getMarkdown: () => string;
			getJSON: () => {
				type: string;
				content?: { type: string; attrs?: Record<string, unknown> }[];
			};
		};
	}
}

test.describe('File attachments', () => {
	test('parses a text-file URL into a fileAttachment node and round-trips it', async ({
		page,
		wiki,
	}) => {
		await createDraftAndOpenEditor(
			page,
			await wiki.space(),
			`file-attach-${Date.now()}`,
		);

		await page.evaluate(() => {
			window.wikiEditor.commands.setContent('![notes](/files/notes.txt)', {
				contentType: 'markdown',
			});
		});

		const json = await page.evaluate(() => {
			const doc = window.wikiEditor.getJSON();
			return doc.content?.find((n) => n.type === 'fileAttachment');
		});
		expect(json?.attrs?.src).toBe('/files/notes.txt');
		expect(json?.attrs?.filename).toBe('notes');

		const markdown = await page.evaluate(() => window.wikiEditor.getMarkdown());
		expect(markdown).toContain('![notes](/files/notes.txt)');
	});

	test('renders an audio file as a native player', async ({ page, wiki }) => {
		await createDraftAndOpenEditor(
			page,
			await wiki.space(),
			`file-audio-${Date.now()}`,
		);

		await page.evaluate(() => {
			window.wikiEditor.commands.setContent('![memo](/files/memo.mp3)', {
				contentType: 'markdown',
			});
		});

		await expect(page.locator('.file-audio audio')).toBeVisible({ timeout: 10000 });
	});

	test('renders a text/code file as a preview block', async ({ page, wiki }) => {
		await createDraftAndOpenEditor(
			page,
			await wiki.space(),
			`file-text-${Date.now()}`,
		);

		await page.evaluate(() => {
			window.wikiEditor.commands.setContent('![config](/files/settings.toml)', {
				contentType: 'markdown',
			});
		});

		await expect(page.locator('.file-text-code')).toBeVisible({ timeout: 10000 });
	});

	test('renders an unknown extension as a download card', async ({ page, wiki }) => {
		await createDraftAndOpenEditor(
			page,
			await wiki.space(),
			`file-zip-${Date.now()}`,
		);

		await page.evaluate(() => {
			window.wikiEditor.commands.setContent('![bundle](/files/export.zip)', {
				contentType: 'markdown',
			});
		});

		await expect(page.locator('.file-card')).toBeVisible({ timeout: 10000 });
	});
});
