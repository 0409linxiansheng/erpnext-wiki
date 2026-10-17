<template>
	<Tooltip :text="__('Page access')">
		<Button variant="ghost" :aria-label="__('Page access')" @click="openDialog">
			<span class="lucide-shield size-4" aria-hidden="true" />
		</Button>
	</Tooltip>

	<Dialog v-model:open="open" size="md">
		<template #title>
			<h3 class="text-2xl-semibold text-ink-gray-9">{{ __('Page access') }}</h3>
		</template>
		<template #default>
			<div class="space-y-5">
				<p v-if="!canEdit" class="text-p-sm text-ink-gray-5">
					{{ __('Only wiki managers can change who can read this page.') }}
				</p>

				<div class="flex flex-col gap-1.5">
					<label class="text-sm text-ink-gray-7">{{ __('Who can read it') }}</label>
					<Select
						:model-value="mode"
						:options="modeOptions"
						:disabled="!canEdit"
						:aria-label="__('Who can read it')"
						@update:model-value="mode = $event"
					/>
				</div>

				<div
					v-if="mode === 'Restricted'"
					class="flex flex-col gap-4 rounded-8 border border-outline-gray-2 p-3"
				>
					<div class="flex flex-col gap-1.5">
						<label class="text-sm text-ink-gray-7">{{ __('Roles') }}</label>
						<MultiSelect
							v-model="selectedRoles"
							:options="roleOptions"
							:disabled="!canEdit"
							:placeholder="__('Choose roles')"
							:aria-label="__('Roles')"
						/>
					</div>

					<div class="flex flex-col gap-1.5">
						<label class="text-sm text-ink-gray-7">{{ __('People') }}</label>
						<MultiSelect
							v-model="selectedUsers"
							:options="userOptions"
							:disabled="!canEdit"
							:placeholder="__('Choose people')"
							:aria-label="__('People')"
						/>
					</div>

					<div class="flex flex-col gap-1.5">
						<label class="text-sm text-ink-gray-7">{{ __('Level') }}</label>
						<Select
							v-model="level"
							:options="levelOptions"
							:disabled="!canEdit"
							:aria-label="__('Level')"
						/>
					</div>

					<p class="text-p-sm text-ink-gray-5">
						{{ __('Child pages inherit this list. Wiki managers always keep access.') }}
					</p>
				</div>

				<ErrorMessage :message="error" />
			</div>
		</template>
		<template #actions="{ close }">
			<Button variant="outline" @click="close">{{ __('Cancel') }}</Button>
			<Button
				variant="solid"
				:loading="saving"
				:disabled="!canSave"
				@click="save(close)"
			>
				{{ __('Save') }}
			</Button>
		</template>
	</Dialog>
</template>

<script setup>
import {
	Button,
	Dialog,
	ErrorMessage,
	MultiSelect,
	Select,
	Tooltip,
	createListResource,
	createResource,
} from 'frappe-ui';
import { computed, ref } from 'vue';

const props = defineProps({
	pageId: { type: String, required: true },
});

const LEVEL_RANK = { Read: 1, Write: 2, Admin: 3 };
const modeOptions = [
	{ label: __('Inherit the space'), value: 'Inherit' },
	{ label: __('Only the people and roles below'), value: 'Restricted' },
];
const levelOptions = [
	{ label: __('Read only'), value: 'Read' },
	{ label: __('Read and edit'), value: 'Write' },
	{ label: __('Read, edit and manage access'), value: 'Admin' },
];

const open = ref(false);
const mode = ref('Inherit');
const level = ref('Read');
const selectedRoles = ref([]);
const selectedUsers = ref([]);
const canEdit = ref(false);
const saving = ref(false);
const error = ref('');

const roles = createListResource({
	doctype: 'Role',
	fields: ['name'],
	pageLength: 999,
	auto: false,
});
const users = createListResource({
	doctype: 'User',
	fields: ['name', 'full_name'],
	filters: { enabled: 1 },
	pageLength: 999,
	auto: false,
});

const roleOptions = computed(() => (roles.data || []).map((r) => ({ label: r.name, value: r.name })));
const userOptions = computed(() =>
	(users.data || [])
		.filter((u) => u.name !== 'Administrator' && u.name !== 'Guest')
		.map((u) => ({ label: u.full_name || u.name, value: u.name })),
);

const canSave = computed(
	() => canEdit.value && (mode.value === 'Inherit' || selectedRoles.value.length || selectedUsers.value.length),
);

const state = createResource({
	url: 'wiki.api.access.get_page_access',
	makeParams: () => ({ docname: props.pageId }),
});

const saveRequest = createResource({
	url: 'wiki.api.access.update_page_access',
	onError: (err) => {
		error.value = err?.messages?.[0] || __('Could not save access.');
		saving.value = false;
	},
});

function apply(data) {
	mode.value = data?.mode || 'Inherit';
	canEdit.value = Boolean(data?.can_edit);
	selectedRoles.value = [];
	selectedUsers.value = [];
	let strongest = 'Read';
	for (const entry of data?.entries || []) {
		if (entry.subject_type === 'Role') selectedRoles.value.push(entry.role);
		else selectedUsers.value.push(entry.user);
		if ((LEVEL_RANK[entry.level] || 0) > (LEVEL_RANK[strongest] || 0)) strongest = entry.level;
	}
	level.value = strongest;
}

async function openDialog() {
	open.value = true;
	error.value = '';
	roles.fetch();
	users.fetch();
	try {
		apply(await state.fetch());
	} catch (err) {
		error.value = err?.messages?.[0] || __('Could not load page access.');
	}
}

function buildEntries() {
	const entries = [];
	for (const role of selectedRoles.value) {
		entries.push({ subject_type: 'Role', role, level: level.value });
	}
	for (const user of selectedUsers.value) {
		entries.push({ subject_type: 'User', user, level: level.value });
	}
	return entries;
}

async function save(close) {
	saving.value = true;
	error.value = '';
	try {
		apply(await saveRequest.submit({ docname: props.pageId, mode: mode.value, entries: buildEntries() }));
		close();
	} catch {
		// onError surfaced the reason; keep the dialog open with the draft intact.
	} finally {
		saving.value = false;
	}
}
</script>
