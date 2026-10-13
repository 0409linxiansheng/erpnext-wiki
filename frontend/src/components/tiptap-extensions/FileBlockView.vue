<script setup>
import { NodeViewWrapper } from '@tiptap/vue-3';
import { computed, ref, watch } from 'vue';
import { getFileKind } from './media-urls.js';

const props = defineProps({
	node: { type: Object, required: true },
	updateAttributes: { type: Function, required: true },
	selected: { type: Boolean, default: false },
});

const src = computed(() => props.node.attrs.src || '');
const filename = computed(() => props.node.attrs.filename || '');
const loading = computed(() => props.node.attrs.loading);
const error = computed(() => props.node.attrs.error);

// One source of truth with the server renderer: the URL's extension decides the
// kind, so a round-trip through markdown (which carries no MIME) renders the same.
const kind = computed(() => getFileKind(src.value));

const textContent = ref('');
const textLoading = ref(false);

watch(
	[src, kind],
	([url, fileKind]) => {
		if (fileKind !== 'text' || !url) {
			textContent.value = '';
			return;
		}
		textLoading.value = true;
		fetch(url)
			.then((response) => {
				if (!response.ok) throw new Error(String(response.status));
				return response.text();
			})
			.then((text) => {
				textContent.value = text;
			})
			.catch(() => {
				textContent.value = '';
			})
			.finally(() => {
				textLoading.value = false;
			});
	},
	{ immediate: true },
);
</script>

<template>
	<NodeViewWrapper
		class="file-block-wrapper"
		:class="{ 'is-selected': selected }"
		contenteditable="false"
	>
		<div v-if="loading" class="file-placeholder">
			<span class="lucide-loader-circle animate-spin" aria-hidden="true" />
			<span>{{ __('Uploading') }} {{ filename }}…</span>
		</div>

		<div v-else-if="error" class="file-placeholder file-error">
			<span class="lucide-triangle-alert" aria-hidden="true" />
			<span>{{ error }}</span>
		</div>

		<template v-else-if="src">
			<figure v-if="kind === 'audio'" class="file-audio">
				<audio controls preload="metadata" :src="src" />
				<figcaption>
					<span class="file-name">{{ filename }}</span>
					<a :href="src" download target="_blank" rel="noopener">{{ __('Download') }}</a>
				</figcaption>
			</figure>

			<figure v-else-if="kind === 'text'" class="file-text">
				<pre class="file-text-code"><code>{{ textContent }}</code></pre>
				<figcaption>
					<span class="file-name">{{ filename }}</span>
					<a :href="src" download target="_blank" rel="noopener">{{ __('Download') }}</a>
				</figcaption>
			</figure>

			<a v-else class="file-card" :href="src" download target="_blank" rel="noopener">
				<span class="lucide-file-text" aria-hidden="true" />
				<span class="file-name">{{ filename }}</span>
				<span class="file-download-hint">{{ __('Download') }}</span>
			</a>
		</template>
	</NodeViewWrapper>
</template>

<style scoped>
.file-block-wrapper {
	margin: 0.5rem 0;
}
.file-placeholder {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	padding: 0.75rem 1rem;
	border: 1px dashed var(--outline-gray-2, #e5e7eb);
	border-radius: 0.5rem;
	color: var(--ink-gray-5, #6b7280);
	font-size: 0.875rem;
}
.file-error {
	color: var(--ink-red-6, #dc2626);
	border-color: var(--ink-red-3, #fca5a5);
}
.file-audio,
.file-text {
	margin: 0;
}
.file-audio audio {
	width: 100%;
}
.file-audio figcaption,
.file-text figcaption {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 1rem;
	margin-top: 0.25rem;
	font-size: 0.75rem;
	color: var(--ink-gray-5, #6b7280);
}
.file-text-code {
	overflow: auto;
	max-height: 24rem;
	padding: 0.75rem 1rem;
	background: var(--surface-gray-1, #f9fafb);
	border: 1px solid var(--outline-gray-2, #e5e7eb);
	border-radius: 0.5rem;
	font-size: 0.8125rem;
	white-space: pre;
}
.file-name {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
.file-card {
	display: flex;
	align-items: center;
	gap: 0.75rem;
	padding: 0.75rem 1rem;
	border: 1px solid var(--outline-gray-2, #e5e7eb);
	border-radius: 0.5rem;
	color: var(--ink-gray-8, #1f2937);
	text-decoration: none;
}
.file-card:hover {
	background: var(--surface-gray-1, #f9fafb);
}
.file-card .file-name {
	flex: 1;
}
.file-download-hint {
	font-size: 0.75rem;
	color: var(--ink-gray-5, #6b7280);
}
</style>
