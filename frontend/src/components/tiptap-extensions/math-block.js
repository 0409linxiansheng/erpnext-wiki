/**
 * Block maths (`$$…$$`).
 *
 * A thin `.extend()` of the official `BlockMath`: the node, its KaTeX DOM node
 * view and `insertBlockMath` / `deleteBlockMath` / `updateBlockMath` are reused.
 * Only the markdown tokenizer (whole-line anchored, see math-markdown.js) and
 * the stock input rule (which expects `$$$…$$$`) are replaced.
 */

import { InputRule } from '@tiptap/core';
import { BlockMath } from '@tiptap/extension-mathematics';
import { blockMathMarkdownTokenizer } from './math-markdown.js';

export const WikiBlockMath = BlockMath.extend({
	markdownTokenizer: blockMathMarkdownTokenizer,

	addInputRules() {
		return [
			new InputRule({
				// `$$x$$` on a line of its own — the whole textblock, so an
				// anchored match is the right trigger. The replacement swaps the
				// host paragraph for the atom when the schema allows it (mirrors
				// the official rule), so the block does not sit inside an empty
				// paragraph.
				find: /^\$\$([^$\n]+)\$\$$/,
				handler: ({ state, range, match }) => {
					const { tr } = state;
					const $from = state.doc.resolve(range.from);
					const node = this.type.create({ latex: match[1] });
					const consumesHostTextblock =
						$from.depth > 0 &&
						$from.parent.isTextblock &&
						range.from === $from.start() &&
						range.to === $from.end();
					const canReplaceHostTextblock =
						consumesHostTextblock &&
						$from
							.node(-1)
							.canReplaceWith($from.index(-1), $from.indexAfter(-1), this.type);
					const replacement = canReplaceHostTextblock
						? { from: $from.before(), to: $from.after() }
						: range;
					tr.replaceWith(replacement.from, replacement.to, node);
				},
			}),
		];
	},
});

export default WikiBlockMath;