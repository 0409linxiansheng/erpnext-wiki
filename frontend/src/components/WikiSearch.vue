<template>
	<div ref="root" class="relative w-full max-w-md">
		<FormControl
			v-model="query"
			type="text"
			:placeholder="__('Search documentation…')"
			@focus="open = true"
			@keydown.down.prevent="move(1)"
			@keydown.up.prevent="move(-1)"
			@keydown.enter.prevent="choose(results[activeIndex])"
			@keydown.escape.prevent="open = false"
		/>

		<div
			role="listbox"
			v-if="open && query.trim().length >= MIN_SERVER_QUERY"
			class="absolute inset-x-0 top-full z-20 mt-1 max-h-96 overflow-y-auto rounded-6 border border-outline-gray-1 bg-surface-white shadow-xl"
		>
			<p v-if="loading" class="px-3 py-2.5 text-sm text-ink-gray-5">
				{{ __('Searching…') }}
			</p>
			<p v-else-if="!results.length" class="px-3 py-2.5 text-sm text-ink-gray-5">
				{{ __('No results') }}
			</p>
			<button
				v-for="(result, index) in results"
				v-else
				:key="result.name"
				type="button"
				role="option"
				:aria-selected="index === activeIndex ? 'true' : 'false'"
				class="flex w-full flex-col gap-0.5 px-3 py-2 text-left"
				:class="index === activeIndex ? 'bg-surface-gray-2' : ''"
				@click="choose(result)"
				@mouseover="activeIndex = index"
			>
				<span class="truncate text-sm text-ink-gray-9">{{ result.title }}</span>
				<span class="truncate text-xs text-ink-gray-5">
					{{ `/${result.route}` }}
				</span>
				<span class="truncate text-xs text-ink-gray-5">{{ result.content }}</span>
			</button>
		</div>
	</div>
</template>

<script setup>
import { createResource } from 'frappe-ui';
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

const MIN_SERVER_QUERY = 2;

const router = useRouter();
const root = ref(null);
const query = ref('');
const open = ref(false);
const activeIndex = ref(0);

// The FTS index highlights matches with `<mark>`; labels render as text, so strip
// the tags rather than show them literally.
function stripMarks(text) {
	return String(text || '').replace(/<\/?mark>/g, '');
}

const search = createResource({
	url: 'wiki.frappe_wiki.doctype.wiki_document.search.search',
});

let submitted = '';

watch(
	query,
	(value) => {
		const q = value.trim();
		if (q.length < MIN_SERVER_QUERY) {
			submitted = '';
			return;
		}
		submitted = q;
		search.submit({ query: q });
	},
);

const loading = computed(() => search.loading);
const results = computed(() =>
	submitted === query.value.trim()
		? (search.data?.results || []).map((result) => ({
				...result,
				title: stripMarks(result.title),
				content: stripMarks(result.content),
			}))
		: [],
);

function move(step) {
	const count = results.value.length;
	if (!count) return;
	activeIndex.value = (activeIndex.value + step + count) % count;
}

function choose(result) {
	if (!result) return;
	open.value = false;
	query.value = '';
	router.push({
		name: 'SpacePage',
		params: { spaceId: result.wiki_space, pageId: result.name },
	});
}
</script>
