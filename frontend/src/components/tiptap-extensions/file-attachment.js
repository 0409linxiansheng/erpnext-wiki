/**
 * TipTap file-attachment extension.
 *
 * The "everything else" block for `![name](url)`: an uploaded file that is not an
 * image, video or PDF. Renders by type — audio gets a native player, text/code gets
 * an inline preview, and anything else a download card. It shares image syntax with
 * the image/video/pdf nodes and is disambiguated by the URL's extension, exactly
 * like the server renderer (wiki/wiki/markdown.py), so editor and reader agree.
 */

import { Node, mergeAttributes } from '@tiptap/core';
import { VueNodeViewRenderer } from '@tiptap/vue-3';
import FileBlockView from './FileBlockView.vue';
import { isAttachmentUrl } from './media-urls.js';

export { isAttachmentUrl } from './media-urls.js';

export const FileAttachment = Node.create({
	name: 'fileAttachment',

	group: 'block',

	atom: true,

	draggable: true,

	addOptions() {
		return {
			HTMLAttributes: {},
		};
	},

	addAttributes() {
		return {
			src: {
				default: '',
			},
			filename: {
				default: '',
			},
			// Transient editor-only state for the upload lifecycle, mirroring the
			// PDF/image nodes: rendered: false keeps these out of the serialized
			// HTML, and renderMarkdown ignores them.
			loading: {
				default: false,
				rendered: false,
			},
			uploadId: {
				default: null,
				rendered: false,
			},
			error: {
				default: null,
				rendered: false,
			},
		};
	},

	parseHTML() {
		return [
			{
				tag: 'div[data-type="file-attachment"]',
				getAttrs: (dom) => ({
					src: dom.getAttribute('data-src') || '',
					filename: dom.getAttribute('data-filename') || '',
				}),
			},
		];
	},

	renderHTML({ node, HTMLAttributes }) {
		const attrs = mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
			'data-type': 'file-attachment',
			'data-src': node.attrs.src,
			'data-filename': node.attrs.filename || '',
		});

		return ['div', attrs];
	},

	addNodeView() {
		return VueNodeViewRenderer(FileBlockView);
	},

	addCommands() {
		return {
			setFileAttachment:
				(attributes) =>
				({ commands }) =>
					commands.insertContent({ type: this.name, attrs: attributes }),

			// Open a file picker and hand the chosen file to WikiEditor (which owns
			// the optimistic insert + upload flow) via a custom DOM event — the same
			// pattern as pdf-block's selectAndUploadPdf.
			selectAndUploadFile: () => () => {
				const input = document.createElement('input');
				input.type = 'file';
				input.onchange = (event) => {
					const target = event.target;
					if (target?.files?.length) {
						document.dispatchEvent(
							new CustomEvent('wiki-editor-upload-file', {
								detail: { file: target.files[0] },
							}),
						);
					}
				};
				input.click();
				return true;
			},
		};
	},

	markdownTokenizer: {
		name: 'fileAttachment',
		level: 'block',

		start(src) {
			return src.indexOf('![');
		},

		tokenize(src) {
			const imagePattern =
				/^!\[([^\]]*)\]\(((?:[^()"]|\([^()"]*\))+?)(?:\s+"([^"]*)")?\)/;
			const match = imagePattern.exec(src);

			if (!match) return undefined;

			const filename = match[1];
			const url = (match[2] || '').trim();

			// Only claim non-image/video/pdf URLs with a file extension; image and
			// video/pdf tokenizers run for their own types, and an extensionless URL
			// stays an image.
			if (!isAttachmentUrl(url)) return undefined;

			return { type: 'fileAttachment', raw: match[0], filename, src: url };
		},
	},

	parseMarkdown(token) {
		return {
			type: 'fileAttachment',
			attrs: {
				src: token.src || token.href || '',
				filename: token.filename || token.text || '',
			},
		};
	},

	renderMarkdown(node) {
		if (node.attrs?.loading) return '';

		const src = node.attrs?.src || '';
		if (!src) return '';

		const filename = node.attrs?.filename || '';
		// No trailing newline: the markdown serializer inserts the block separator,
		// and appending one here doubles the gap and breaks the idempotent round-trip
		// (same contract as pdf-block.js).
		return `![${filename}](${src})`;
	},
});

export default FileAttachment;
