<template>
	<Dialog v-model:open="show" size="md">
		<template #title>
			<h3 class="text-2xl-semibold text-ink-gray-9">{{ __('Insert snippet') }}</h3>
		</template>

		<!-- frappe-ui's Dialog takes the body through the default slot and the footer
		     through #actions; anything else silently renders nowhere. -->
		<template #default>
			<div class="flex flex-col gap-3">
				<FormControl
					ref="searchInput"
					v-model="query"
					type="text"
					:placeholder="__('Search snippets…')"
					@keydown.down.prevent="move(1)"
					@keydown.up.prevent="move(-1)"
					@keydown.enter.prevent="chooseSelected()"
				/>

				<div
					v-if="visible.length"
					class="max-h-72 overflow-y-auto rounded-6 border border-outline-gray-1"
				>
					<button
						v-for="(snippet, index) in visible"
						:key="snippet.name"
						type="button"
						class="flex w-full flex-col gap-0.5 px-2.5 py-2 text-left"
						:class="index === selected ? 'bg-surface-gray-2' : ''"
						@click="choose(snippet)"
						@mouseover="selected = index"
					>
						<span class="text-sm text-ink-gray-9">{{ snippet.title }}</span>
						<span class="truncate text-xs text-ink-gray-5">
							{{ previewLine(snippet.content) }}
						</span>
					</button>
				</div>

				<p v-else class="px-1 py-2 text-sm text-ink-gray-5">
					{{ query ? __('No snippets match') : __('No snippets yet') }}
				</p>

				<!-- Creating one belongs here: a picker that can only pick from an empty
				     library is a dead end. Editing and deleting are Phase 3. -->
				<div v-if="creating" class="flex flex-col gap-2 border-t border-outline-gray-1 pt-3">
					<FormControl v-model="draftTitle" type="text" :placeholder="__('Snippet title')" />
					<FormControl
						v-model="draftContent"
						type="textarea"
						:placeholder="__('Snippet content')"
					/>
				</div>
			</div>
		</template>

		<template #actions="{ close }">
			<div class="flex justify-end gap-2">
				<Button v-if="!creating" variant="outline" @click="creating = true">
					{{ __('New snippet') }}
				</Button>
				<Button
					v-if="creating"
					variant="solid"
					:disabled="!canCreate"
					:loading="createSnippet.loading"
					@click="create()"
				>
					{{ __('Create') }}
				</Button>
				<Button variant="subtle" @click="close()">{{ __('Close') }}</Button>
			</div>
		</template>
	</Dialog>
</template>

<script setup>
import { filterSnippets, previewLine } from '@/lib/snippetFilter';
import { useSnippetPickerStore } from '@/stores/snippetPicker';
import { createListResource, createResource, toast } from 'frappe-ui';
import { computed, nextTick, ref, watch } from 'vue';

const picker = useSnippetPickerStore();

// `auto` fetches once per editor; creating a snippet reloads it, so the picker
// never shows a library that is one edit behind.
const snippets = createListResource({
	doctype: 'Wiki Snippet',
	fields: ['name', 'title', 'keywords', 'content'],
	orderBy: 'title asc',
	pageLength: 100,
	auto: true,
});

const query = ref('');
const selected = ref(0);
const creating = ref(false);
const draftTitle = ref('');
const draftContent = ref('');
const searchInput = ref(null);

const show = computed({
	get: () => picker.isOpen,
	set: (open) => {
		if (!open) picker.close();
	},
});

const visible = computed(() => filterSnippets(snippets.data || [], query.value));

// A new query means a new first row, and the arrow keys have to agree with what
// is on screen.
watch(visible, () => {
	selected.value = 0;
});

watch(
	() => picker.isOpen,
	(open) => {
		if (!open) return;
		query.value = '';
		selected.value = 0;
		creating.value = false;
		nextTick(() => searchInput.value?.el?.focus?.());
	},
);

function move(step) {
	if (!visible.value.length) return;
	selected.value = (selected.value + step + visible.value.length) % visible.value.length;
}

function choose(snippet) {
	picker.insert(snippet.content);
}

function chooseSelected() {
	if (creating.value) return;
	const snippet = visible.value[selected.value];
	if (snippet) choose(snippet);
}

const canCreate = computed(() => !!draftTitle.value.trim() && !!draftContent.value.trim());

const createSnippet = createResource({ url: 'frappe.client.insert' });

async function create() {
	if (!canCreate.value) return;

	try {
		await createSnippet.submit({
			doc: JSON.stringify({
				doctype: 'Wiki Snippet',
				title: draftTitle.value.trim(),
				content: draftContent.value,
			}),
		});
		draftTitle.value = '';
		draftContent.value = '';
		creating.value = false;
		await snippets.reload();
		toast.success(__('Snippet created'));
	} catch (error) {
		toast.error(error.messages?.[0] || __('Could not create the snippet'));
	}
}
</script>
