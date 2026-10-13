<template>
	<div class="wiki-toolbar" v-if="editor">
		<EditorFixedMenu class="toolbar-group" :editor="editor" :items="toolbarItems" />
		<!-- Dictation is browser-only (Web Speech API), so the control is absent where
		     the API is: a button that cannot work is worse than no button. -->
		<Button
			v-if="dictationSupported"
			variant="ghost"
			class="wiki-dictate"
			:icon="dictating ? 'lucide-mic-off' : 'lucide-mic'"
			:label="dictating ? __('Stop dictation') : __('Dictate')"
			@click="toggleDictation()"
		/>
		<span v-if="dictating && dictationHint" class="wiki-dictation-hint">
			{{ dictationHint }}
		</span>
		<span v-else-if="dictationError" class="wiki-dictation-hint">
			{{ __('Could not start dictation') }}
		</span>
		<input
			ref="imageInput"
			type="file"
			accept="image/*"
			class="hidden"
			@change="handleImageSelect"
		/>
	</div>
</template>

<script setup>
import {
	Blockquote,
	Bold,
	BulletList,
	EditorFixedMenu,
	H1,
	H2,
	H3,
	H4,
	H5,
	H6,
	HorizontalRule,
	InlineCode,
	InsertLink,
	InsertTable,
	Italic,
	OrderedList,
	Redo,
	Separator,
	Strike,
	Undo,
} from 'frappe-ui/editor';
import { ref } from 'vue';

import { useSpeechToText } from '../../composables/useSpeechToText.js';
import {
	DEFAULT_BLOCK_MATH_LATEX,
	DEFAULT_INLINE_MATH_LATEX,
} from './math-markdown.js';

const props = defineProps({
	editor: {
		type: Object,
		required: true,
	},
});

const emit = defineEmits(['uploadImage']);

const imageInput = ref(null);

const dictationHint = ref('');
// The range the interim transcript currently occupies, so the next update replaces
// it instead of appending a second copy.
let interimRange = null;

const {
	supported: dictationSupported,
	listening: dictating,
	error: dictationError,
	toggle: toggleDictation,
} = useSpeechToText({
	onResult: applyDictation,
	onEnd: () => {
		// Whatever interim text is in the document becomes ordinary text the moment
		// dictation stops; there is nothing left to replace.
		interimRange = null;
		dictationHint.value = '';
	},
});

function caretIsAt(position) {
	const { selection } = props.editor.state;
	return selection.empty && selection.from === position;
}

function applyDictation(text, isFinal) {
	const editor = props.editor;
	if (!editor || !text) return;

	// Replace the previous interim text, but only while the caret is still where
	// dictation left it. If the user clicked or typed somewhere else in the meantime,
	// that text is theirs now and appending is the honest thing to do.
	if (interimRange && caretIsAt(interimRange.to)) {
		editor.chain().focus().deleteRange(interimRange).run();
	}
	interimRange = null;

	const from = editor.state.selection.from;
	// A transcript is text, not markup: an explicit text node keeps a dictated "*" or
	// "<" from being parsed as markdown or HTML.
	editor
		.chain()
		.focus()
		.insertContent({ type: 'text', text: isFinal ? `${text} ` : text })
		.run();

	dictationHint.value = isFinal ? '' : text;
	if (!isFinal) interimRange = { from, to: editor.state.selection.from };
}

// Atoms exist only for items whose command lives in frappe-ui's kits; the
// rest (underline, task list via @tiptap/extension-list, code block, PDF block,
// file-input image upload) get hand-rolled MenuItem objects with the same
// shape.
const TaskListItem = {
	icon: 'lucide-list-checks',
	label: __('Task List'),
	action: (editor) => editor.chain().focus().toggleTaskList().run(),
	isActive: (editor) => editor.isActive('taskList'),
};

const UnderlineItem = {
	icon: 'lucide-underline',
	label: __('Underline'),
	action: (editor) => editor.chain().focus().toggleUnderline().run(),
	isActive: (editor) => editor.isActive('underline'),
};

const CodeBlockItem = {
	icon: 'lucide-square-code',
	label: __('Code Block'),
	action: (editor) => editor.chain().focus().toggleCodeBlock().run(),
	isActive: (editor) => editor.isActive('codeBlock'),
};

const InsertImageItem = {
	icon: 'lucide-image',
	label: __('Insert Image'),
	action: () => {
		imageInput.value?.click();
	},
};

const InsertPdfItem = {
	icon: 'lucide-file-text',
	label: __('Insert PDF'),
	action: (editor) => editor.chain().focus().selectAndUploadPdf().run(),
};

// frappe-ui's InsertVideo atom gates on a node named `video`; wiki's video
// node is `videoBlock`, so the atom hides itself and we roll our own.
const InsertVideoItem = {
	icon: 'lucide-video',
	label: __('Insert Video'),
	action: (editor) => editor.chain().focus().selectAndUploadVideo().run(),
};

// Both bodies are non-empty on purpose: `insertInlineMath` / `insertBlockMath`
// return false when handed nothing, so a formula has to come with a template.
const InlineMathItem = {
	icon: 'lucide-sigma',
	label: __('Inline Math'),
	action: (editor) =>
		editor
			.chain()
			.focus()
			.insertInlineMath({ latex: DEFAULT_INLINE_MATH_LATEX })
			.run(),
	isActive: (editor) => editor.isActive('inlineMath'),
};

const BlockMathItem = {
	icon: 'lucide-sigma-square',
	label: __('Block Math'),
	action: (editor) =>
		editor
			.chain()
			.focus()
			.insertBlockMath({ latex: DEFAULT_BLOCK_MATH_LATEX })
			.run(),
	isActive: (editor) => editor.isActive('blockMath'),
};

const HeadingGroup = {
	type: 'group',
	label: __('Heading'),
	items: [H1, H2, H3, H4, H5, H6],
};

const toolbarItems = [
	HeadingGroup,
	Separator,
	Bold,
	Italic,
	UnderlineItem,
	Strike,
	InlineCode,
	Separator,
	BulletList,
	OrderedList,
	TaskListItem,
	Separator,
	Blockquote,
	CodeBlockItem,
	HorizontalRule,
	Separator,
	InsertTable,
	InsertLink,
	InlineMathItem,
	BlockMathItem,
	InsertImageItem,
	InsertVideoItem,
	InsertPdfItem,
	Separator,
	Undo,
	Redo,
];

function handleImageSelect(event) {
	const file = event.target.files?.[0];
	if (file) {
		emit('uploadImage', file);
	}
	// Reset input so same file can be selected again
	event.target.value = '';
}
</script>

<style scoped>
/* 3rem tall with the same gutter as the breadcrumb bar above it: the two
   chromes stack, so an off-by-a-few-pixels row reads as a misprint. The
   height is fixed rather than derived from the buttons so it stays put when
   the toolbar's contents change. */
.wiki-toolbar {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    height: 3rem;
    padding: 0 0.75rem;
    background-color: var(--surface-base, #ffffff);
    border-bottom: 1px solid var(--outline-gray-2, #e5e7eb);
    position: sticky;
    top: 0;
    z-index: 40;
}

@media (min-width: 640px) {
    .wiki-toolbar {
        padding: 0 1.25rem;
    }
}

.hidden {
    display: none;
}

/* On a phone the ~20 buttons can't fit; let the row scroll horizontally
   (keeping it sticky-top) instead of hiding the right-hand actions. */
@media (max-width: 767px) {
    .wiki-toolbar {
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: none; /* Firefox */
    }
    .wiki-toolbar::-webkit-scrollbar {
        display: none; /* Chrome/Safari */
    }
    /* The live transcript is a hint, not document content: it lives here until the
       recogniser marks it final and the editor takes it. */
    .wiki-dictation-hint {
        align-self: center;
        max-width: 14rem;
        overflow: hidden;
        padding: 0 0.5rem;
        font-size: 0.75rem;
        color: var(--ink-gray-5);
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    /* Keep every control at its full size and let them overflow to scroll,
       rather than compressing to fit. */
    .toolbar-group :deep(> *) {
        flex-shrink: 0;
    }
    /* 44x44 minimum touch target. */
    .toolbar-group :deep(button) {
        min-width: 2.75rem;
        min-height: 2.75rem;
    }
}
</style>
