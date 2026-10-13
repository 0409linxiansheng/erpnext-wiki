import { expect, test } from '../fixtures';
import { createDraftAndOpenEditor } from '../helpers/wiki';

/**
 * Covers the LaTeX maths feature (Alexandrie port, spec
 * `alexandrie_port/01-editor-math-and-containers.md`): the editor nodes (parse +
 * live KaTeX preview + markdown round-trip), the slash entry point, and the
 * public server-rendered reader, where the escaped TeX is hydrated to KaTeX
 * markup in the browser.
 *
 * The storage format is the plain `$…$` / `$$…$$` the editor types — the same
 * delimiters mdit_py_plugins.dollarmath reads server-side.
 */
const INLINE_MATH = 'Euler: $E = mc^2$ done.\n';
const BLOCK_MATH =
	'$$\n\\int_{-\\infty}^{\\infty} e^{-x^2}\\,dx = \\sqrt{\\pi}\n$$\n';
const MULTI_MATH = `${INLINE_MATH}\n${BLOCK_MATH}`;

declare global {
	interface Window {
		wikiEditor: {
			commands: {
				setContent: (
					content: string,
					options?: { contentType?: string },
				) => void;
				focus: () => void;
			};
			getMarkdown: () => string;
			getJSON: () => {
				type: string;
				content?: {
					type: string;
					attrs?: Record<string, unknown>;
					content?: { type: string }[];
				}[];
			};
		};
	}
}

test.describe('LaTeX maths', () => {
	test('parses inline and block maths into nodes and previews them with KaTeX', async ({
		page,
		wiki,
	}) => {
		await createDraftAndOpenEditor(
			page,
			await wiki.space(),
			`math-edit-${Date.now()}`,
		);

		const types = await page.evaluate((md) => {
			window.wikiEditor.commands.setContent(md, { contentType: 'markdown' });
			type JsonNode = { type?: string; content?: JsonNode[] };
			const collect = (node: JsonNode | undefined, found: string[] = []): string[] => {
				if (node && typeof node === 'object') {
					if (typeof node.type === 'string' && node.type !== 'doc') found.push(node.type);
					for (const child of node.content ?? []) collect(child, found);
				}
				return found;
			};
			return collect(window.wikiEditor.getJSON() as JsonNode);
		}, MULTI_MATH);

		// Two distinct node types, not a paragraph holding literal dollars.
		expect(types).toContain('inlineMath');
		expect(types).toContain('blockMath');

		// Each node view renders real KaTeX markup.
		await expect(
			page
				.locator(
					'.tiptap-mathematics-render[data-type="inline-math"] .katex',
				)
				.first(),
		).toBeVisible({ timeout: 10000 });
		await expect(
			page
				.locator(
					'.tiptap-mathematics-render[data-type="block-math"] .katex',
				)
				.first(),
		).toBeVisible({ timeout: 10000 });
	});

	test('round-trips inline and block maths without drift', async ({
		page,
		wiki,
	}) => {
		await createDraftAndOpenEditor(
			page,
			await wiki.space(),
			`math-roundtrip-${Date.now()}`,
		);

		const { md1, md2 } = await page.evaluate((md) => {
			window.wikiEditor.commands.setContent(md, { contentType: 'markdown' });
			const md1 = window.wikiEditor.getMarkdown();
			// Re-parse the serialized markdown and re-serialize — the cycle that
			// would expose escaping or blank-line drift.
			window.wikiEditor.commands.setContent(md1, { contentType: 'markdown' });
			const md2 = window.wikiEditor.getMarkdown();
			return { md1, md2 };
		}, MULTI_MATH);

		expect(md1).toContain('$E = mc^2$');
		expect(md1).toContain('$$');
		// Serialization is idempotent — a second round-trip must not drift.
		expect(md2).toBe(md1);
	});

	test('currency and a code span are not mistaken for maths', async ({
		page,
		wiki,
	}) => {
		await createDraftAndOpenEditor(
			page,
			await wiki.space(),
			`math-negative-${Date.now()}`,
		);

		const types = await page.evaluate(() => {
			window.wikiEditor.commands.setContent(
				'It costs $5 and $6 today.\n\n`$x$`\n',
				{ contentType: 'markdown' },
			);
			type JsonNode = { type?: string; content?: JsonNode[] };
			const collect = (node: JsonNode | undefined, found: string[] = []): string[] => {
				if (node && typeof node === 'object') {
					if (typeof node.type === 'string' && node.type !== 'doc') found.push(node.type);
					for (const child of node.content ?? []) collect(child, found);
				}
				return found;
			};
			return collect(window.wikiEditor.getJSON() as JsonNode);
		});

		expect(types).not.toContain('inlineMath');
		expect(types).not.toContain('blockMath');
	});

	test('the slash menu inserts a display formula', async ({ page, wiki }) => {
		const editor = await createDraftAndOpenEditor(
			page,
			await wiki.space(),
			`math-slash-${Date.now()}`,
		);

		await editor.click();
		await page.keyboard.type('/math');

		const menu = page.locator('.slash-commands-list');
		await expect(menu.getByText('Math', { exact: true })).toBeVisible({
			timeout: 5000,
		});

		// 点按比 Enter 稳：Enter 走 suggestion 的 onKeyDown，菜单刚渲染出来时那次按键会丢，
		// 结果就是公式没插进去、菜单还开着（曾经跑出过这个假失败）。
		await menu.getByText('Math', { exact: true }).click();

		// The command must insert a populated block-math node (the extension
		// refuses an empty body) and the node view must render it.
		await expect(
			page
				.locator(
					'.tiptap-mathematics-render[data-type="block-math"] .katex',
				)
				.first(),
		).toBeVisible({ timeout: 5000 });
	});

	test('renders as KaTeX on the public page and never trusts hostile TeX', async ({
		page,
		wiki,
	}) => {
		const space = await wiki.space({
			pages: [
				{ title: 'Math Page', content: MULTI_MATH },
				{
					title: 'Hostile Math',
					content: '$$\n\\href{javascript:alert(1)}{x}\n$$\n',
				},
			],
		});

		const doc = space.page('Math Page');
		await page.goto(`/${doc.route}`);
		await page.waitForLoadState('networkidle');

		// Server escapes the TeX into .math-inline / .math-block; katex-renderer.js
		// lazy-loads KaTeX and hydrates each into .katex.
		await expect(page.locator('#wiki-content .math-inline .katex').first()).toBeVisible(
			{ timeout: 15000 },
		);
		await expect(page.locator('#wiki-content .math-block .katex').first()).toBeVisible(
			{ timeout: 15000 },
		);

		// KaTeX runs with `trust: false`, so `\href{javascript:…}` is refused and
		// the source is shown as an error instead of becoming a live link.
		const hostile = space.page('Hostile Math');
		await page.goto(`/${hostile.route}`);
		await page.waitForLoadState('networkidle');

		await expect(page.locator('#wiki-content .math-block').first()).toBeAttached();
		expect(
			await page.locator('#wiki-content a[href^="javascript"]').count(),
		).toBe(0);
	});
});