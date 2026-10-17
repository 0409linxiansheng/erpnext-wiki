/**
 * TipTap Slash Commands Extension
 *
 * Provides "/" command menu for inserting elements.
 * Limited to Markdown-supported features.
 *
 * Items follow frappe-ui's CommandItem shape ({ title, icon, group, command })
 * so the menu renders like the frappe-ui/Gameplan slash menu: consecutive
 * items with the same `group` render under one section header, and `icon` is
 * a lucide CSS class (frappe-ui icon convention).
 */

import { Extension } from '@tiptap/core';
import { translate as __ } from '../../translation.js';
import Suggestion from '@tiptap/suggestion';
import { useSnippetPickerStore } from '../../stores/snippetPicker.js';
import { DEFAULT_BLOCK_MATH_LATEX } from './math-markdown.js';

/**
 * Build the menu.
 *
 * `__()` has to wrap each label where the label is written, or
 * `bench generate-pot-file` never sees the string. It cannot run while this module
 * is imported, though: `translationPlugin` installs the catalog later, and an
 * eagerly built array would freeze English into a Chinese site. Hence a builder,
 * called the first time the menu opens.
 *
 * Each entry's `keywords` stay in the source language, so "mermaid" and "snippet"
 * still find their commands after the labels turn Chinese.
 */
function buildCommands() {
	return [
	{
		title: __('Heading 1'),
		icon: 'lucide-heading-1',
		group: __('Text'),
		command: ({ editor, range }) => {
			editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run();
		},
	},
	{
		title: __('Heading 2'),
		icon: 'lucide-heading-2',
		group: __('Text'),
		command: ({ editor, range }) => {
			editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run();
		},
	},
	{
		title: __('Heading 3'),
		icon: 'lucide-heading-3',
		group: __('Text'),
		command: ({ editor, range }) => {
			editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run();
		},
	},
	{
		title: __('Blockquote'),
		icon: 'lucide-quote',
		group: __('Text'),
		command: ({ editor, range }) => {
			editor.chain().focus().deleteRange(range).toggleBlockquote().run();
		},
	},
	{
		title: __('Code Block'),
		icon: 'lucide-code',
		group: __('Text'),
		command: ({ editor, range }) => {
			editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
		},
	},
	{
		title: __('Bullet List'),
		icon: 'lucide-list',
		group: __('Lists'),
		command: ({ editor, range }) => {
			editor.chain().focus().deleteRange(range).toggleBulletList().run();
		},
	},
	{
		title: __('Numbered List'),
		icon: 'lucide-list-ordered',
		group: __('Lists'),
		command: ({ editor, range }) => {
			editor.chain().focus().deleteRange(range).toggleOrderedList().run();
		},
	},
	{
		title: __('Task List'),
		icon: 'lucide-list-checks',
		group: __('Lists'),
		command: ({ editor, range }) => {
			editor.chain().focus().deleteRange(range).toggleTaskList().run();
		},
	},
	{
		title: __('Image'),
		icon: 'lucide-image',
		group: __('Media'),
		command: ({ editor, range }) => {
			// Delete the slash command text first
			editor.chain().focus().deleteRange(range).run();
			// Dispatch a custom event that WikiEditor will listen for
			const event = new CustomEvent('wiki-editor-upload-image', {
				bubbles: true,
				detail: { editor },
			});
			document.dispatchEvent(event);
		},
	},
	{
		title: __('Video'),
		icon: 'lucide-video',
		group: __('Media'),
		command: ({ editor, range }) => {
			editor.chain().focus().deleteRange(range).selectAndUploadVideo().run();
		},
	},
	{
		title: __('PDF'),
		icon: 'lucide-file-text',
		group: __('Media'),
		command: ({ editor, range }) => {
			editor.chain().focus().deleteRange(range).selectAndUploadPdf().run();
		},
	},
	{
		title: __('Table'),
		icon: 'lucide-table',
		group: __('Insert'),
		command: ({ editor, range }) => {
			editor
				.chain()
				.focus()
				.deleteRange(range)
				.insertTable({ rows: 3, cols: 3, withHeaderRow: true })
				.run();
		},
	},
	{
		title: __('Embed'),
		icon: 'lucide-app-window',
		group: __('Insert'),
		command: ({ editor, range }) => {
			editor.chain().focus().deleteRange(range).insertIframePlaceholder().run();
		},
	},
	{
		title: __('ERPNext Data'),
		icon: 'lucide-table-2',
		group: __('Insert'),
		keywords: ['report', '报表', '数据', 'table'],
		command: ({ editor, range }) => {
			const report = window.prompt(
				__('Report name, exactly as it appears in ERPNext'),
				'',
			);
			if (!report || !report.trim()) return;
			editor
				.chain()
				.focus()
				.deleteRange(range)
				.setFrappeReport({ report: report.trim() })
				.run();
		},
	},
	{
		title: __('Diagram'),
		icon: 'lucide-network',
		group: __('Insert'),
		// Longtime users still reach for the engine's name.
		keywords: ['mermaid'],
		command: ({ editor, range }) => {
			editor.chain().focus().deleteRange(range).setMermaid({}).run();
		},
	},
	{
		title: __('Math'),
		icon: 'lucide-sigma',
		group: __('Insert'),
		keywords: ['latex', 'formula', 'equation', 'katex', 'tex'],
		// A display formula: `insertBlockMath` refuses an empty body, so the
		// template body is the only way the command can insert anything.
		command: ({ editor, range }) => {
			editor
				.chain()
				.focus()
				.deleteRange(range)
				// `insertBlockMath` falls back to `editor.state.selection.from`, which is
				// the live state — the `deleteRange` above only exists in this chain's
				// transaction, so the fallback resolves a pre-delete position that the
				// shortened document no longer has (RangeError: Position 6 out of range).
				// Pass the deletion point explicitly instead.
				.insertBlockMath({ latex: DEFAULT_BLOCK_MATH_LATEX, pos: range.from })
				.run();
		},
	},
	{
		title: __('Link to Page'),
		icon: 'lucide-file-symlink',
		group: __('Insert'),
		keywords: ['linkpage', 'wiki link'],
		// Typing the picker's own trigger opens it (see page-links.js).
		command: ({ editor, range }) => {
			editor.chain().focus().deleteRange(range).insertContent('[[').run();
		},
	},
	{
		title: __('Horizontal Rule'),
		icon: 'lucide-minus',
		group: __('Insert'),
		command: ({ editor, range }) => {
			editor.chain().focus().deleteRange(range).setHorizontalRule().run();
		},
	},
	{
		title: __('Snippet'),
		icon: 'lucide-scissors',
		group: __('Insert'),
		keywords: ['snippet', 'reusable', 'template', 'fragment'],
		// The picker is a Vue dialog, which a Tiptap command cannot render: it hands
		// the editor and the range it wants replaced to a store instead.
		command: ({ editor, range }) => {
			useSnippetPickerStore().open(editor, range);
		},
	},
	{
		title: __('Note'),
		icon: 'lucide-info',
		group: __('Callouts'),
		command: ({ editor, range }) => {
			editor
				.chain()
				.focus()
				.deleteRange(range)
				.setCallout({ type: 'note' })
				.run();
		},
	},
	{
		title: __('Tip'),
		icon: 'lucide-lightbulb',
		group: __('Callouts'),
		command: ({ editor, range }) => {
			editor
				.chain()
				.focus()
				.deleteRange(range)
				.setCallout({ type: 'tip' })
				.run();
		},
	},
	{
		title: __('Warning'),
		icon: 'lucide-triangle-alert',
		group: __('Callouts'),
		command: ({ editor, range }) => {
			editor
				.chain()
				.focus()
				.deleteRange(range)
				.setCallout({ type: 'caution' })
				.run();
		},
	},
	{
		title: __('Danger'),
		icon: 'lucide-octagon-alert',
		group: __('Callouts'),
		command: ({ editor, range }) => {
			editor
				.chain()
				.focus()
				.deleteRange(range)
				.setCallout({ type: 'danger' })
				.run();
		},
	},
	];
}

let built = null;

/** The menu's items, translated. `WikiEditor.vue` hands these to the suggestion. */
export function slashCommands() {
	if (!built) built = buildCommands();
	return built;
}

/**
 * Filter commands by search query. Matches the title, the group header
 * ("call" finds every callout), and any legacy keywords ("mermaid" → Diagram).
 */
export function filterCommands(query) {
	if (!query) return slashCommands();

	const lowerQuery = query.toLowerCase();
	return slashCommands().filter((cmd) =>
		[cmd.title, cmd.group, ...(cmd.keywords || [])].some((text) =>
			text?.toLowerCase().includes(lowerQuery),
		),
	);
}

/**
 * Slash Commands Extension
 */
export const SlashCommands = Extension.create({
	name: 'slashCommands',

	addOptions() {
		return {
			suggestion: {
				char: '/',
				startOfLine: false,
				command: ({ editor, range, props }) => {
					props.command({ editor, range });
				},
			},
		};
	},

	addProseMirrorPlugins() {
		return [
			Suggestion({
				editor: this.editor,
				...this.options.suggestion,
			}),
		];
	},
});

export default SlashCommands;
