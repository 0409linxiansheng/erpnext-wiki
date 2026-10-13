<template>
	<Dialog v-model:open="show" size="md">
		<template #title>
			<h3 class="text-2xl-semibold text-ink-gray-9">
				{{ formMode ? __('Snippet') : __('Insert snippet') }}
			</h3>
		</template>

		<!-- frappe-ui's Dialog takes the body through the default slot and the footer
		     through #actions; anything else silently renders nowhere. -->
		<template #default>
			<div class="flex flex-col gap-3">
				<template v-if="!formMode">
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
						<div
							v-for="(snippet, index) in visible"
							:key="snippet.name"
							class="group flex items-center"
							:class="index === selected ? 'bg-surface-gray-2' : ''"
						>
							<button
								type="button"
								class="flex flex-1 flex-col gap-0.5 px-2.5 py-2 text-left"
								@click="choose(snippet)"
								@mouseover="selected = index"
							>
								<span class="text-sm text-ink-gray-9">{{ snippet.title }}</span>
								<span class="truncate text-xs text-ink-gray-5">
									{{ previewLine(snippet.content) }}
								</span>
							</button>
							<!-- Editing sits on the row it edits: a separate manager screen for
							     three fields would be more chrome than the data deserves. -->
							<Button
								variant="ghost"
								icon="lucide-pencil"
								:label="__('Edit snippet')"
								class="mr-1 opacity-0 group-hover:opacity-100 focus:opacity-100"
								@click="startEdit(snippet)"
							/>
						</div>
					</div>

					<p v-else class="px-1 py-2 text-sm text-ink-gray-5">
						{{ query ? __('No snippets match') : __('No snippets yet') }}
					</p>
				</template>

				<div v-else class="flex flex-col gap-2">
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
				<template v-if="!formMode">
					<Button variant="outline" @click="startCreate()">{{ __('New snippet') }}</Button>
					<Button variant="subtle" @click="close()">{{ __('Close') }}</Button>
				</template>

				<template v-else>
					<Button v-if="editing" variant="outline" theme="red" @click="remove()">
						{{ confirmingDelete ? __('Confirm delete') : __('Delete') }}
					</Button>
					<Button variant="subtle" @click="cancelForm()">{{ __('Cancel') }}</Button>
					<Button
						variant="solid"
						:disabled="!canSave"
						:loading="saveResource.loading || createSnippetResource.loading"
						@click="save()"
					>
						{{ editing ? __('Save') : __('Create') }}
					</Button>
				</template>
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

// `auto` fetches once per editor; every write reloads it, so the picker never
// shows a library that is one edit behind.
const snippets = createListResource({
	doctype: 'Wiki Snippet',
	fields: ['name', 'title', 'keywords', 'content'],
	orderBy: 'title asc',
	pageLength: 100,
	auto: true,
});

const query = ref('');
const selected = ref(0);
const editing = ref(null);
const draftTitle = ref('');
const draftContent = ref('');
const confirmingDelete = ref(false);
const searchInput = ref(null);

const creating = ref(false);
const formMode = computed(() => editing.value !== null || creating.value);
const canSave = computed(() => !!draftTitle.value.trim() && !!draftContent.value.trim());

const show = computed({
	get: () => picker.isOpen,
	set: (open) => {
		if (!open) picker.close();
	},
});

const visible = computed(() => filterSnippets(snippets.data || [], query.value));

// A new query means a new first row, and the arrow keys have to agree with what is
// on screen.
watch(visible, () => {
	selected.value = 0;
});

watch(
	() => picker.isOpen,
	(open) => {
		if (!open) return;
		query.value = '';
		selected.value = 0;
		resetForm();
		nextTick(() => searchInput.value?.el?.focus?.());
	},
);

function resetForm() {
	editing.value = null;
	creating.value = false;
	draftTitle.value = '';
	draftContent.value = '';
	confirmingDelete.value = false;
}

function startCreate() {
	resetForm();
	creating.value = true;
}

function startEdit(snippet) {
	resetForm();
	editing.value = snippet;
	draftTitle.value = snippet.title || '';
	draftContent.value = snippet.content || '';
}

function cancelForm() {
	resetForm();
	nextTick(() => searchInput.value?.el?.focus?.());
}

function move(step) {
	if (!visible.value.length) return;
	selected.value = (selected.value + step + visible.value.length) % visible.value.length;
}

function choose(snippet) {
	picker.insert(snippet.content);
}

function chooseSelected() {
	if (formMode.value) return;
	const snippet = visible.value[selected.value];
	if (snippet) choose(snippet);
}

/** The body of a write, shared by create and edit. */
function payload() {
	return {
		title: draftTitle.value.trim(),
		content: draftContent.value,
	};
}

const createSnippetResource = createResource({ url: 'frappe.client.insert' });
const saveResource = createResource({ url: 'frappe.client.set_value' });
const deleteResource = createResource({ url: 'frappe.client.delete' });

async function save() {
	if (!canSave.value) return;

	try {
		if (editing.value) {
			await saveResource.submit({
				doctype: 'Wiki Snippet',
				name: editing.value.name,
				fieldname: JSON.stringify(payload()),
			});
			toast.success(__('Snippet updated'));
		} else {
			await createSnippetResource.submit({
				doc: JSON.stringify({ doctype: 'Wiki Snippet', ...payload() }),
			});
			toast.success(__('Snippet created'));
		}
		resetForm();
		await snippets.reload();
	} catch (error) {
		toast.error(error.messages?.[0] || __('Could not save the snippet'));
	}
}

async function remove() {
	// Two steps rather than a confirmation dialog: deleting a snippet should not
	// cost a trip through another window, but it should not be one click either.
	if (!confirmingDelete.value) {
		confirmingDelete.value = true;
		return;
	}

	try {
		await deleteResource.submit({ doctype: 'Wiki Snippet', name: editing.value.name });
		resetForm();
		await snippets.reload();
		toast.success(__('Snippet deleted'));
	} catch (error) {
		toast.error(error.messages?.[0] || __('Could not delete the snippet'));
	}
}
</script>
