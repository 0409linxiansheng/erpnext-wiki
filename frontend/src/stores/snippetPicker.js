import { defineStore } from 'pinia';
import { ref } from 'vue';

/**
 * Who wants the snippet picker, and where the text should land.
 *
 * The slash command runs inside a Tiptap extension, which cannot render a Vue
 * dialog. So the command hands over the editor and the range it wants replaced,
 * and `WikiEditor.vue` renders the dialog from this store — the same division of
 * labour as the command palette, without threading props through the editor.
 */
export const useSnippetPickerStore = defineStore('snippetPicker', () => {
	const isOpen = ref(false);
	let editor = null;
	let range = null;

	function open(currentEditor, currentRange) {
		editor = currentEditor;
		range = currentRange;
		isOpen.value = true;
	}

	function close() {
		isOpen.value = false;
		editor = null;
		range = null;
	}

	/**
	 * Insert the snippet's stored markdown where the slash command was typed.
	 *
	 * The content goes in as *markdown*, through the same path a paste takes, so
	 * a snippet containing `$…$`, a callout or a fence obeys the round-trip rules
	 * that are already under test — rather than needing a second insertion syntax
	 * of its own.
	 */
	function insert(content) {
		if (!editor || !content) {
			close();
			return false;
		}

		const chain = editor.chain().focus();
		if (range) chain.deleteRange(range);
		chain.insertContent(content, { contentType: 'markdown' }).run();
		close();
		return true;
	}

	return { isOpen, open, close, insert };
});
