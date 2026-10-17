<template>
	<!-- Alexandrie-style top bar: identity on the left, one prominent search
	     entry, utility actions on the right. Hidden on mobile, where the shell
	     already owns a bottom nav. -->
	<header
		class="flex h-14 shrink-0 items-center gap-3 border-b border-outline-gray-2 bg-surface-base px-4"
	>
		<router-link
			:to="{ name: 'Overview' }"
			:aria-label="brand.name"
			class="flex items-center gap-2.5"
		>
			<span class="brand-mark" aria-hidden="true">{{ brand.mark }}</span>
			<span class="text-[15px] font-semibold tracking-tight text-ink-gray-9">
				{{ brand.name }}
			</span>
			<span
				class="rounded bg-surface-blue-2 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-blue-9"
			>
				{{ brand.caption }}
			</span>
		</router-link>

		<a
			href="/blog"
			class="ml-1 rounded-6 px-2 py-1 text-sm text-ink-gray-6 hover:bg-surface-gray-2 hover:text-ink-gray-9"
		>
			{{ __('Blog') }}
		</a>

		<button
			type="button"
			class="topbar-search ml-2 lg:ml-4"
			:aria-label="__('Search documents')"
			@click="openPalette"
		>
			<span class="lucide-search size-3.5 shrink-0" aria-hidden="true" />
			<span class="truncate">{{ __('Search documents') }}</span>
			<kbd
				class="ml-auto hidden rounded border border-outline-gray-2 px-1 text-[10px] text-ink-gray-4 sm:inline"
			>
				⌘K
			</kbd>
		</button>

		<div class="ml-auto flex items-center gap-1">
			<button
				type="button"
				class="flex size-8 items-center justify-center rounded-6 text-ink-gray-5 hover:bg-surface-gray-2 hover:text-ink-gray-8"
				:title="resolvedColorScheme === 'dark' ? __('Light mode') : __('Dark mode')"
				:aria-label="resolvedColorScheme === 'dark' ? __('Light mode') : __('Dark mode')"
				@click="toggleColorScheme"
			>
				<span
					:class="resolvedColorScheme === 'dark' ? 'lucide-sun' : 'lucide-moon'"
					class="size-4"
					aria-hidden="true"
				/>
			</button>

			<button
				type="button"
				class="flex size-8 items-center justify-center rounded-6 text-ink-gray-5 hover:bg-surface-gray-2 hover:text-ink-gray-8"
				:title="__('Settings')"
				:aria-label="__('Settings')"
				@click="openSettings()"
			>
				<span class="lucide-settings size-4" aria-hidden="true" />
			</button>

			<div
				v-if="user?.full_name"
				class="ml-1 flex items-center gap-2 rounded-full border border-outline-gray-2 py-0.5 pl-0.5 pr-2.5"
			>
				<img
					v-if="user.user_image"
					:src="user.user_image"
					:alt="user.full_name"
					class="size-6 rounded-full object-cover"
				/>
				<span
					v-else
					class="flex size-6 items-center justify-center rounded-full bg-surface-gray-3 text-[11px] font-medium text-ink-gray-7"
				>
					{{ initials }}
				</span>
				<span class="max-w-40 truncate text-xs text-ink-gray-7">{{ user.full_name }}</span>
			</div>
		</div>
	</header>
</template>

<script setup>
import { useColorScheme } from 'frappe-ui';
import { computed } from 'vue';
import { brand } from '../brand';
import { useCommandPalette } from '../composables/useCommandPalette';
import { useWikiSettings } from '../composables/useWikiSettings';
import { useUserStore } from '../stores/user';

const { toggle: openPalette } = useCommandPalette();
const { resolvedColorScheme, toggleColorScheme } = useColorScheme();
const { open: openSettings } = useWikiSettings();
const userStore = useUserStore();

const user = computed(() => userStore.data);
const initials = computed(() => {
	const name = user.value?.full_name || user.value?.email || '?';
	return name.trim().charAt(0).toUpperCase();
});
</script>
