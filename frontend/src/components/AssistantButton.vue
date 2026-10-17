<template>
	<button
		type="button"
		class="fixed bottom-6 right-6 z-40 flex h-11 items-center gap-2 rounded-full bg-surface-gray-10 px-4 text-sm font-medium text-ink-base shadow-lg transition-colors hover:bg-surface-gray-9"
		@click="open = true"
	>
		<span class="lucide-sparkles size-4" aria-hidden="true" />
		{{ __('Ask') }}
	</button>

	<Dialog v-model:open="open" size="md">
		<template #title>
			<h3 class="text-2xl-semibold text-ink-gray-9">{{ __('Ask the knowledge base') }}</h3>
		</template>
		<template #default>
			<div class="flex flex-col gap-4">
				<FormControl
					v-model="question"
					type="textarea"
					:rows="3"
					:placeholder="__('例如：报销流程是什么？')"
					@keydown.ctrl.enter="send"
				/>

				<div
					v-if="answer"
					class="rounded-8 border border-outline-gray-2 bg-surface-gray-1 p-3"
				>
					<p class="whitespace-pre-wrap text-ink-gray-8">{{ answer }}</p>
					<p v-if="mode === 'search'" class="mt-2 text-xs text-ink-gray-4">
						{{ __('Retrieval only — add a model key in the site config for a written answer.') }}
					</p>
				</div>

				<div v-if="sources.length">
					<p class="mb-1 text-xs text-ink-gray-5">{{ __('Sources') }}</p>
					<ul class="space-y-1">
						<li v-for="(source, index) in sources" :key="source.name">
							<a
								:href="source.url"
								class="text-sm text-ink-blue-link hover:underline"
								@click="open = false"
							>
								{{ index + 1 }}. {{ source.title }}
							</a>
						</li>
					</ul>
				</div>

				<ErrorMessage :message="error" />
			</div>
		</template>
		<template #actions="{ close }">
			<Button variant="outline" @click="close">{{ __('Close') }}</Button>
			<Button
				variant="solid"
				:loading="asking"
				:disabled="!question.trim()"
				@click="send"
			>
				{{ __('Ask') }}
			</Button>
		</template>
	</Dialog>
</template>

<script setup>
import { Button, Dialog, ErrorMessage, FormControl, createResource } from 'frappe-ui';
import { ref } from 'vue';

const open = ref(false);
const question = ref('');
const answer = ref('');
const mode = ref('');
const sources = ref([]);
const asking = ref(false);
const error = ref('');

const ask = createResource({
	url: 'wiki.api.ai.ask',
	onError: (err) => {
		error.value = err?.messages?.[0] || __('Could not answer that.');
		asking.value = false;
	},
});

async function send() {
	const text = question.value.trim();
	if (!text) return;
	asking.value = true;
	error.value = '';
	try {
		const result = await ask.submit({ question: text });
		answer.value = result?.answer || '';
		mode.value = result?.mode || '';
		sources.value = result?.sources || [];
	} catch {
		// onError already explained; keep the question so it can be retried.
	} finally {
		asking.value = false;
	}
}
</script>
