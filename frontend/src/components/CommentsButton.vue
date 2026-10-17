<template>
	<Tooltip :text="__('Comments')">
		<Button variant="ghost" :aria-label="__('Comments')" @click="openDialog">
			<span class="lucide-message-square size-4" aria-hidden="true" />
		</Button>
	</Tooltip>

	<Dialog v-model:open="open" size="md">
		<template #title>
			<h3 class="text-2xl-semibold text-ink-gray-9">{{ __('Comments') }}</h3>
		</template>
		<template #default>
			<div class="flex max-h-[60vh] flex-col gap-4">
				<div class="min-h-12 flex-1 space-y-3 overflow-y-auto pr-1">
					<p v-if="!comments.length" class="text-p-sm text-ink-gray-5">
						{{ __('No comments yet. Start the discussion.') }}
					</p>
					<div
						v-for="comment in comments"
						:key="comment.name"
						class="rounded-8 border border-outline-gray-2 p-3"
					>
						<div class="mb-1 flex items-baseline justify-between gap-3">
							<span class="text-sm font-medium text-ink-gray-8">
								{{ comment.author_name }}
							</span>
							<span class="text-xs text-ink-gray-4">{{ comment.created }}</span>
						</div>
						<!-- Stored html-escaped, so rendering it as HTML is safe and shows
						     the characters the author typed. -->
						<p class="whitespace-pre-wrap break-words text-ink-gray-7" v-html="comment.content" />
					</div>
				</div>

				<FormControl
					v-model="draft"
					type="textarea"
					:rows="3"
					:placeholder="__('Write a comment. Use @name@example.com to notify someone.')"
				/>
				<ErrorMessage :message="error" />
			</div>
		</template>
		<template #actions="{ close }">
			<Button variant="outline" @click="close">{{ __('Close') }}</Button>
			<Button variant="solid" :loading="sending" :disabled="!draft.trim()" @click="send">
				{{ __('Comment') }}
			</Button>
		</template>
	</Dialog>
</template>

<script setup>
import { Button, Dialog, ErrorMessage, FormControl, Tooltip, createResource } from 'frappe-ui';
import { ref } from 'vue';

const props = defineProps({
	pageId: { type: String, required: true },
});

const open = ref(false);
const comments = ref([]);
const draft = ref('');
const sending = ref(false);
const error = ref('');

const list = createResource({
	url: 'wiki.api.comments.list_comments',
	makeParams: () => ({ docname: props.pageId }),
});

const add = createResource({
	url: 'wiki.api.comments.add_comment',
	onError: (err) => {
		error.value = err?.messages?.[0] || __('Could not post the comment.');
		sending.value = false;
	},
});

async function openDialog() {
	open.value = true;
	error.value = '';
	try {
		comments.value = await list.fetch();
	} catch (err) {
		error.value = err?.messages?.[0] || __('Could not load comments.');
	}
}

async function send() {
	const text = draft.value.trim();
	if (!text) return;
	sending.value = true;
	error.value = '';
	try {
		const created = await add.submit({ docname: props.pageId, content: text });
		if (created) comments.value.push(created);
		draft.value = '';
	} catch {
		// onError already showed the reason; keep the draft so nothing is lost.
	} finally {
		sending.value = false;
	}
}
</script>
