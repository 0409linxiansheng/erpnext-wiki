/**
 * TipTap Frappe Report Block
 *
 * Embeds a live ERPNext report inside a page. Stored as one HTML block in the
 * markdown so it round-trips without a fenced-code tokenizer fighting the
 * editor's code block:
 *
 *   <div data-type="frappe-report-block" data-config='{"report":"Stock Balance"}'></div>
 *
 * The rows are fetched from `wiki.api.embed.report_snippet` at render time, as
 * the reader, so the report's own permissions apply.
 */

import { Node, mergeAttributes } from '@tiptap/core';
import { VueNodeViewRenderer } from '@tiptap/vue-3';
import FrappeReportView from './FrappeReportView.vue';

const BLOCK_RE =
	/^<div\b[^>]*data-type=["']frappe-report-block["'][^>]*>(?:\s*<\/div>)?\s*/i;

function configFromHtml(html) {
	const match = /data-config=["']([^"']*)["']/i.exec(html);
	if (!match) return '{}';
	try {
		return decodeHtmlEntities(match[1]);
	} catch {
		return '{}';
	}
}

function decodeHtmlEntities(value) {
	return value
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&amp;/g, '&');
}

function escapeAttr(value) {
	return String(value ?? '')
		.replace(/&/g, '&amp;')
		.replace(/"/g, '&quot;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

export const FrappeReportBlock = Node.create({
	name: 'frappeReportBlock',

	group: 'block',
	atom: true,
	draggable: true,

	addAttributes() {
		return {
			config: { default: '{}' },
		};
	},

	parseHTML() {
		return [
			{
				tag: 'div[data-type="frappe-report-block"]',
				getAttrs: (dom) => ({ config: dom.getAttribute('data-config') || '{}' }),
			},
		];
	},

	renderHTML({ node, HTMLAttributes }) {
		return [
			'div',
			mergeAttributes(HTMLAttributes, {
				'data-type': 'frappe-report-block',
				'data-config': node.attrs.config,
				class: 'frappe-report-block',
			}),
		];
	},

	addNodeView() {
		return VueNodeViewRenderer(FrappeReportView);
	},

	addCommands() {
		return {
			setFrappeReport:
				(attributes = {}) =>
				({ commands }) => {
					const config = typeof attributes === 'string' ? attributes : JSON.stringify(attributes);
					return commands.insertContent({
						type: this.name,
						attrs: { config },
					});
				},
		};
	},

	markdownTokenizer: {
		name: 'frappeReportBlock',
		level: 'block',

		start(src) {
			const index = src.search(/<div\b[^>]*data-type=["']frappe-report-block["']/i);
			return index < 0 ? undefined : index;
		},

		tokenize(src) {
			const match = BLOCK_RE.exec(src);
			if (!match) return undefined;
			return {
				type: 'frappeReportBlock',
				raw: match[0],
				config: configFromHtml(match[0]),
			};
		},
	},

	parseMarkdown(token) {
		return {
			type: 'frappeReportBlock',
			attrs: { config: token.config || '{}' },
		};
	},

	renderMarkdown(node) {
		return `<div data-type="frappe-report-block" data-config="${escapeAttr(node.attrs.config)}"></div>`;
	},
});

export default FrappeReportBlock;
