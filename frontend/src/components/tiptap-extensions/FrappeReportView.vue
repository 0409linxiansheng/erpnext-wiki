<template>
	<NodeViewWrapper
		class="frappe-report-block my-4 overflow-hidden rounded-8 border border-outline-gray-2"
		:class="{ 'opacity-70': loading }"
	>
		<div
			class="flex items-center justify-between gap-3 border-b border-outline-gray-2 bg-surface-gray-1 px-3 py-2"
		>
			<div class="flex min-w-0 items-center gap-2 text-sm text-ink-gray-7">
				<span class="lucide-table-2 size-4 shrink-0 text-ink-gray-5" aria-hidden="true" />
				<span class="truncate font-medium">{{ report || __('ERPNext report') }}</span>
				<span v-if="total" class="shrink-0 text-xs text-ink-gray-4">{{ total }} 行</span>
			</div>
			<Button variant="ghost" size="sm" :loading="loading" :aria-label="__('Refresh')" @click="reload">
				<span class="lucide-refresh-cw size-3.5" aria-hidden="true" />
			</Button>
		</div>

		<p v-if="error" class="px-3 py-4 text-sm text-ink-red-3">{{ error }}</p>

		<div v-else class="overflow-x-auto">
			<table class="w-full text-sm">
				<thead>
					<tr class="bg-surface-gray-1 text-left text-xs text-ink-gray-5">
						<th
							v-for="column in columns"
							:key="column.fieldname || column.label"
							class="whitespace-nowrap px-3 py-2 font-medium"
						>
							{{ column.label }}
						</th>
					</tr>
				</thead>
				<tbody>
					<tr
						v-for="(row, index) in rows"
						:key="index"
						class="border-t border-outline-gray-1"
					>
						<td
							v-for="(cell, cellIndex) in row"
							:key="cellIndex"
							class="whitespace-nowrap px-3 py-2 text-ink-gray-7"
						>
							{{ cell }}
						</td>
					</tr>
				</tbody>
			</table>
			<p v-if="!rows.length && !loading" class="px-3 py-4 text-sm text-ink-gray-5">
				{{ __('No rows for the current filters.') }}
			</p>
			<p v-if="truncated" class="px-3 py-2 text-xs text-ink-gray-4">
				{{ __('Showing the first {0} rows.').replace('{0}', rows.length) }}
			</p>
		</div>
	</NodeViewWrapper>
</template>

<script setup>
import { Button, createResource } from 'frappe-ui';
import { NodeViewWrapper } from '@tiptap/vue-3';
import { computed, onMounted, ref, watch } from 'vue';

const props = defineProps({
	node: { type: Object, required: true },
});

const rows = ref([]);
const columns = ref([]);
const total = ref(0);
const truncated = ref(false);
const error = ref('');
const loading = ref(false);

const config = computed(() => {
	try {
		return JSON.parse(props.node.attrs.config || '{}');
	} catch {
		return {};
	}
});
const report = computed(() => config.value.report || '');
const filters = computed(() => config.value.filters || {});

const snippet = createResource({
	url: 'wiki.api.embed.report_snippet',
	makeParams: () => ({ report: report.value, filters: filters.value, limit: config.value.limit || 50 }),
});

async function load() {
	if (!report.value) return;
	loading.value = true;
	error.value = '';
	try {
		const data = await snippet.fetch();
		columns.value = data?.columns || [];
		rows.value = data?.rows || [];
		total.value = data?.total || 0;
		truncated.value = Boolean(data?.truncated);
	} catch (err) {
		error.value = err?.messages?.[0] || __('Could not load this report.');
	} finally {
		loading.value = false;
	}
}

function reload() {
	snippet.reset?.();
	load();
}

onMounted(load);
watch(() => props.node.attrs.config, load);
</script>
