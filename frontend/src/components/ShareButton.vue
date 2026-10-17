<template>
	<Tooltip :text="__('Share')">
		<Button variant="ghost" :aria-label="__('Share')" @click="openDialog">
			<span class="lucide-link size-4" aria-hidden="true" />
		</Button>
	</Tooltip>

	<Dialog v-model:open="open" size="sm">
		<template #title>
			<h3 class="text-2xl-semibold text-ink-gray-9">{{ __('Share this page') }}</h3>
		</template>
		<template #default>
			<div class="space-y-4">
				<div class="flex items-start justify-between gap-4">
					<div class="min-w-0">
						<p class="text-base-medium text-ink-gray-8">{{ __('Public link') }}</p>
						<p class="mt-0.5 text-p-sm text-ink-gray-5">
							{{ __('Anyone with the link can read this page without signing in.') }}
						</p>
					</div>
					<Switch
						:model-value="enabled"
						:disabled="busy"
						:aria-label="__('Public link')"
						@update:model-value="toggle"
					/>
				</div>

				<div v-if="url" class="flex items-center gap-2">
					<TextInput :model-value="url" readonly class="flex-1" />
					<Button variant="outline" @click="copy">
						{{ copied ? __('Copied') : __('Copy') }}
					</Button>
				</div>

				<p v-if="url" class="text-p-sm text-ink-gray-5">
					{{ __('Rotating the link stops every copy of the old one from working.') }}
				</p>

				<div v-if="url" class="flex justify-end">
					<Button variant="ghost" :loading="busy" @click="rotate">
						{{ __('Rotate link') }}
					</Button>
				</div>

				<ErrorMessage :message="error" />
			</div>
		</template>
		<template #actions="{ close }">
			<Button variant="subtle" @click="close">{{ __('Done') }}</Button>
		</template>
	</Dialog>
</template>

<script setup>
import { Button, Dialog, ErrorMessage, Switch, TextInput, Tooltip, createResource } from 'frappe-ui';
import { ref } from 'vue';

const props = defineProps({
	pageId: { type: String, required: true },
});

const open = ref(false);
const enabled = ref(false);
const url = ref('');
const error = ref('');
const busy = ref(false);
const copied = ref(false);

const state = createResource({
	url: 'wiki.api.share.get_share_state',
	makeParams: () => ({ docname: props.pageId }),
});

const update = createResource({
	url: 'wiki.api.share.update_sharing',
	onError: (err) => {
		error.value = err?.messages?.[0] || __('Could not update sharing.');
		busy.value = false;
	},
});

const rotateLink = createResource({
	url: 'wiki.api.share.rotate_share_link',
	onError: (err) => {
		error.value = err?.messages?.[0] || __('Could not rotate the link.');
		busy.value = false;
	},
});

function apply(data) {
	enabled.value = Boolean(data?.enabled);
	url.value = data?.url || '';
	busy.value = false;
}

async function openDialog() {
	open.value = true;
	error.value = '';
	try {
		apply(await state.fetch());
	} catch (err) {
		error.value = err?.messages?.[0] || __('Could not load sharing settings.');
	}
}

async function toggle(value) {
	busy.value = true;
	error.value = '';
	try {
		apply(await update.submit({ docname: props.pageId, enabled: value ? 1 : 0 }));
	} catch {
		// onError already surfaced a message; keep the dialog on its last known state.
		enabled.value = Boolean(value) === false;
	}
}

async function rotate() {
	busy.value = true;
	error.value = '';
	copied.value = false;
	try {
		apply(await rotateLink.submit({ docname: props.pageId }));
	} catch {
		busy.value = false;
	}
}

async function copy() {
	try {
		await navigator.clipboard.writeText(url.value);
		copied.value = true;
		setTimeout(() => (copied.value = false), 1500);
	} catch {
		error.value = __('Could not copy the link. Select it and copy manually.');
	}
}
</script>
