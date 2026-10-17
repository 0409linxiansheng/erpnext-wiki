<template>
	<Tooltip :text="__('Download as Markdown')">
		<a
			:href="url"
			download
			class="flex size-8 items-center justify-center rounded-6 text-ink-gray-5 hover:bg-surface-gray-2 hover:text-ink-gray-8"
			:aria-label="__('Download as Markdown')"
		>
			<span class="lucide-download size-4" aria-hidden="true" />
		</a>
	</Tooltip>
</template>

<script setup>
import { Tooltip } from 'frappe-ui';
import { computed } from 'vue';

const props = defineProps({
	pageId: { type: String, required: true },
});

const url = computed(
	() => `/api/method/wiki.api.export.page_markdown?docname=${encodeURIComponent(props.pageId)}`,
);
</script>
