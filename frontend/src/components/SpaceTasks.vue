<template>
	<div class="flex h-full flex-col" data-testid="space-tasks">
		<div class="flex items-center justify-between border-b border-outline-gray-2 px-4 py-3">
			<h2 class="text-lg-semibold text-ink-gray-9">{{ __('Tasks') }}</h2>
			<span class="text-sm text-ink-gray-5">
				{{ __('Drag a card to move it between columns.') }}
			</span>
		</div>

		<div class="grid min-h-0 flex-1 grid-cols-4 gap-3 overflow-auto p-4">
			<section
				v-for="column in columns"
				:key="column"
				:data-column="column"
				class="flex min-h-0 flex-col rounded-6 border border-outline-gray-1 bg-surface-gray-1"
				@dragover.prevent
				@drop="dropOn(column)"
			>
				<header class="flex items-center justify-between px-3 py-2">
					<span class="text-sm font-medium text-ink-gray-7">{{ column }}</span>
					<span class="text-xs tabular-nums text-ink-gray-5">
						{{ tasksIn(column).length }}
					</span>
				</header>

				<div class="flex min-h-0 flex-1 flex-col gap-2 overflow-auto px-2 pb-2">
					<article
						v-for="task in tasksIn(column)"
						:key="task.name"
						class="kanban-card cursor-grab rounded-5 border border-outline-gray-1 bg-surface-white px-3 py-2 shadow-sm"
						draggable="true"
						@dragstart="dragStart(task)"
						@dragend="dragEnd()"
					>
						<p class="text-sm text-ink-gray-8">{{ task.title }}</p>
						<p v-if="task.description" class="mt-1 line-clamp-2 text-xs text-ink-gray-5">
							{{ task.description }}
						</p>
						<div class="mt-2 flex items-center justify-between">
							<Avatar v-if="task.assigned_to" :label="task.assigned_to" size="sm" />
							<Button
								variant="ghost"
								icon="lucide-trash-2"
								class="ml-auto text-ink-gray-4"
								:title="__('Delete task')"
								@click="remove(task)"
							/>
						</div>
					</article>

					<form
						v-if="creating === column"
						class="mt-1 rounded-5 border border-outline-gray-1 bg-surface-white p-2"
						@submit.prevent="create(column)"
					>
						<FormControl
							v-model="draftTitle"
							type="text"
							:placeholder="__('Task title')"
							autofocus
						/>
						<div class="mt-2 flex justify-end gap-2">
							<Button variant="subtle" @click="creating = null">
								{{ __('Cancel') }}
							</Button>
							<Button variant="solid" type="submit" :disabled="!draftTitle.trim()">
								{{ __('Add') }}
							</Button>
						</div>
					</form>
					<Button
						v-else
						variant="ghost"
						class="justify-start text-ink-gray-5"
						@click="startCreate(column)"
					>
						<span class="lucide-plus mr-2 size-3.5" aria-hidden="true" />
						{{ __('Add a task') }}
					</Button>
				</div>
			</section>
		</div>
	</div>
</template>

<script setup>
import { Avatar, Button, FormControl, createListResource, createResource, toast } from 'frappe-ui';
import { computed, ref } from 'vue';

const props = defineProps({
	spaceId: { type: String, required: true },
});

const columns = ['Backlog', 'To Do', 'In Progress', 'Done'];

const tasks = createListResource({
	doctype: 'Wiki Task',
	fields: ['name', 'title', 'status', 'description', 'assigned_to', 'sort_order'],
	filters: { wiki_space: props.spaceId },
	orderBy: 'sort_order asc',
	pageLength: 500,
	auto: true,
});

const creating = ref(null);
const draftTitle = ref('');
let dragged = null;

const tasksIn = (column) => (tasks.data || []).filter((task) => task.status === column);

const insertTask = createResource({ url: 'frappe.client.insert' });
const setValue = createResource({ url: 'frappe.client.set_value' });
const removeResource = createResource({ url: 'frappe.client.delete' });

function startCreate(column) {
	creating.value = column;
	draftTitle.value = '';
}

async function create(column) {
	const title = draftTitle.value.trim();
	if (!title) return;
	try {
		await insertTask.submit({
			doc: JSON.stringify({
				doctype: 'Wiki Task',
				title,
				status: column,
				wiki_space: props.spaceId,
				sort_order: tasksIn(column).length,
			}),
		});
		creating.value = null;
		draftTitle.value = '';
		await tasks.reload();
	} catch (error) {
		toast.error(error.messages?.[0] || __('Could not create the task'));
	}
}

function dragStart(task) {
	dragged = task;
}

function dragEnd() {
	dragged = null;
}

async function dropOn(column) {
	if (!dragged) return;
	if (dragged.status === column) {
		dragged = null;
		return;
	}
	try {
		await setValue.submit({
			doctype: 'Wiki Task',
			name: dragged.name,
			fieldname: JSON.stringify({ status: column }),
		});
		dragged = null;
		await tasks.reload();
	} catch (error) {
		toast.error(error.messages?.[0] || __('Could not move the task'));
		dragged = null;
	}
}

async function remove(task) {
	try {
		await removeResource.submit({ doctype: 'Wiki Task', name: task.name });
		await tasks.reload();
	} catch (error) {
		toast.error(error.messages?.[0] || __('Could not delete the task'));
	}
}
</script>
