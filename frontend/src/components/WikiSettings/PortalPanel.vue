<template>
	<div class="flex flex-col gap-4">
		<SettingsRow
			:title="__('Heading')"
			:description="__('Shown at the top of the public portal. Blank uses the built-in default.')"
		>
			<TextInput
				v-model="draft.title"
				class="w-56"
				:placeholder="__('Documentation')"
				data-testid="portal-heading"
			/>
		</SettingsRow>

		<SettingsRow
			:title="__('Subheading')"
			:description="__('One line under the heading.')"
		>
			<TextInput v-model="draft.subtitle" class="w-56" />
		</SettingsRow>

		<SettingsRow
			:title="__('Logo')"
			:description="__('Shown above the heading.')"
		>
			<div class="flex items-center gap-2">
				<img
					v-if="draft.logo"
					:src="draft.logo"
					class="h-8 w-auto object-contain"
					alt=""
				/>
				<Button variant="subtle" :loading="uploading" @click="pickFile">
					{{ draft.logo ? __('Replace') : __('Upload') }}
				</Button>
				<Button v-if="draft.logo" variant="ghost" @click="draft.logo = ''">
					{{ __('Remove') }}
				</Button>
			</div>
			<!-- Reset on change so re-picking the same file fires again. -->
			<input
				ref="fileInput"
				type="file"
				accept="image/*"
				class="hidden"
				@change="handleFileChange"
			/>
		</SettingsRow>

		<SettingsRow
			:title="__('Accent colour')"
			:description="__('Tints the heading and the card accents.')"
		>
			<Select v-model="draft.accent_color" :options="ACCENTS" class="w-32" />
		</SettingsRow>

		<SettingsRow
			:title="__('Footer text')"
			:description="__('A single line at the bottom. Blank hides it.')"
		>
			<TextInput v-model="draft.footer_text" class="w-56" />
		</SettingsRow>

		<SettingsRow
			:title="__('List every public space')"
			:description="__('Off shows only the featured spaces below.')"
		>
			<Switch v-model="draft.show_all_spaces" />
		</SettingsRow>

		<div class="flex flex-col gap-3 border-t border-outline-gray-1 pt-4">
			<div class="flex flex-col gap-1">
				<span class="text-sm font-medium text-ink-gray-8">{{ __('Featured spaces') }}</span>
				<span class="text-p-sm text-ink-gray-5">
					{{
						__(
							'The order here is the order on the portal. Only public spaces can be featured — publish one first.',
						)
					}}
				</span>
			</div>

			<div class="flex items-center gap-2">
				<Combobox
					v-model="selectedSpace"
					:options="spaceOptions"
					:placeholder="__('Add a public space')"
					:empty-text="__('No public spaces yet')"
					class="w-64"
				/>
				<Button variant="subtle" :disabled="!selectedSpace" @click="addFeatured">
					{{ __('Add') }}
				</Button>
			</div>

			<ul
				v-if="draft.featured_spaces.length"
				class="overflow-hidden rounded-6 border border-outline-gray-2"
				data-testid="portal-featured-list"
			>
				<li
					v-for="(name, index) in draft.featured_spaces"
					:key="name"
					class="flex items-center gap-1 border-b border-outline-gray-1 px-3 py-2 last:border-b-0"
				>
					<span class="min-w-0 flex-1 truncate text-sm text-ink-gray-8">
						{{ labelFor(name) }}
					</span>
					<Button
						variant="ghost"
						icon="lucide-chevron-up"
						:disabled="index === 0"
						@click="move(index, -1)"
					/>
					<Button
						variant="ghost"
						icon="lucide-chevron-down"
						:disabled="index === draft.featured_spaces.length - 1"
						@click="move(index, 1)"
					/>
					<Button
						variant="ghost"
						icon="lucide-x"
						@click="draft.featured_spaces.splice(index, 1)"
					/>
				</li>
			</ul>
			<p v-else class="text-p-sm text-ink-gray-5">{{ __('No featured spaces yet.') }}</p>
		</div>

		<div class="flex items-center justify-end gap-2 border-t border-outline-gray-1 pt-3">
			<Badge v-if="isDirty" theme="amber" size="sm">{{ __('Unsaved changes') }}</Badge>
			<Button
				variant="solid"
				:disabled="!isDirty"
				:loading="saving"
				data-testid="portal-save"
				@click="save"
			>
				{{ __('Save') }}
			</Button>
		</div>
	</div>
</template>

<script setup>
import {
	Badge,
	Button,
	Combobox,
	Select,
	SettingsRow,
	Switch,
	TextInput,
	createResource,
	toast,
	useFileUpload,
} from 'frappe-ui';
import { computed, onMounted, reactive, ref, watch } from 'vue';

// The settings dialog hands every tab its `Wiki Settings` resource; the portal has
// its own single, so this panel takes the prop only to consume it.
defineProps({
	settings: { type: Object, required: false, default: null },
});

const ACCENTS = ['', 'gray', 'blue', 'green', 'amber', 'red', 'violet'];

const settings = createResource({ url: 'wiki.api.wiki_portal.get_portal_settings' });
const saveResource = createResource({ url: 'wiki.api.wiki_portal.update_portal_settings' });

const draft = reactive({
	title: '',
	subtitle: '',
	logo: '',
	accent_color: '',
	footer_text: '',
	show_all_spaces: true,
	featured_spaces: [],
});

// The saved state, as a serialized snapshot: several fields plus an ordered list
// make a field-by-field dirty check more code than it is worth.
let saved = '';
const snapshot = () => JSON.stringify(draft);
const isDirty = computed(() => snapshot() !== saved);

function apply(data) {
	draft.title = data.title || '';
	draft.subtitle = data.subtitle || '';
	draft.logo = data.logo || '';
	draft.accent_color = data.accent_color || '';
	draft.footer_text = data.footer_text || '';
	draft.show_all_spaces = Boolean(data.show_all_spaces);
	draft.featured_spaces = [...(data.featured_spaces || [])];
	saved = snapshot();
}

watch(
	() => settings.data,
	(data) => {
		if (data) apply(data);
	},
	{ immediate: true },
);

onMounted(() => settings.fetch());

const spaceOptions = computed(() =>
	(settings.data?.public_spaces || []).map((space) => ({
		label: space.space_name || space.name,
		value: space.name,
	})),
);

const selectedSpace = ref(null);

function labelFor(name) {
	return spaceOptions.value.find((option) => option.value === name)?.label || name;
}

function addFeatured() {
	const name = selectedSpace.value;
	if (name && !draft.featured_spaces.includes(name)) draft.featured_spaces.push(name);
	selectedSpace.value = null;
}

function move(index, step) {
	const target = index + step;
	if (target < 0 || target >= draft.featured_spaces.length) return;

	const [row] = draft.featured_spaces.splice(index, 1);
	draft.featured_spaces.splice(target, 0, row);
}

const uploading = ref(false);
const fileInput = ref(null);
const fileUploader = useFileUpload();

function pickFile() {
	fileInput.value?.click();
}

async function handleFileChange(event) {
	const file = event.target.files?.[0];
	event.target.value = '';
	if (!file) return;

	uploading.value = true;
	try {
		// Public on purpose: the portal is an anonymous surface.
		const result = await fileUploader.upload(file, {
			private: false,
			upload_endpoint: '/api/method/wiki.api.upload_wiki_asset',
		});
		draft.logo = result.file_url;
	} catch {
		toast.error(__('Failed to upload the logo'));
	} finally {
		uploading.value = false;
	}
}

const saving = ref(false);

async function save() {
	saving.value = true;
	try {
		const updated = await saveResource.submit({
			title: draft.title,
			subtitle: draft.subtitle,
			logo: draft.logo,
			accent_color: draft.accent_color,
			footer_text: draft.footer_text,
			show_all_spaces: draft.show_all_spaces ? 1 : 0,
			featured_spaces: JSON.stringify(draft.featured_spaces),
		});
		// The server may drop a space that is no longer public; adopt its answer.
		if (updated) apply(updated);
		toast.success(__('Portal updated'));
	} catch (error) {
		toast.error(error.messages?.[0] || __('Failed to update the portal'));
	} finally {
		saving.value = false;
	}
}
</script>
