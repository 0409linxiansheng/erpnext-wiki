/**
 * Inline maths (`$…$`).
 *
 * A thin `.extend()` of the official `InlineMath`: the node, its KaTeX DOM node
 * view and `insertInlineMath` / `deleteInlineMath` / `updateInlineMath` are all
 * reused. Only two things are replaced — the too-loose markdown tokenizer and
 * the stock input rule (which expects `$$…$$`) — both so the editor agrees with
 * `mdit_py_plugins.dollarmath` about what is maths. See math-markdown.js.
 */

import { InputRule } from '@tiptap/core';
import { InlineMath } from '@tiptap/extension-mathematics';
import { inlineMathMarkdownTokenizer } from './math-markdown.js';

export const WikiInlineMath = InlineMath.extend({
	markdownTokenizer: inlineMathMarkdownTokenizer,

	addInputRules() {
		return [
			new InputRule({
				// Anchored at the cursor so only the run just typed converts.
				find: /(?<!\$)\$(?!\s)([^$\n]*?[^\s$])\$(?![\d$])$/,
				handler: ({ state, range, match }) => {
					const { tr } = state;
					tr.replaceWith(
						range.from,
						range.to,
						this.type.create({ latex: match[1] }),
					);
				},
			}),
		];
	},
});

export default WikiInlineMath;