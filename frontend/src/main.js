import { telemetryPlugin } from '@framework/ui/telemetry/index.ts';
import { createApp, watchEffect } from 'vue';

import App from './App.vue';
import router from './router';
import { initSocket } from './socket';
import { pinia } from './stores';
import { useSessionStore } from './stores/session';
import { useUserStore } from './stores/user';

import { trackPageviews } from './telemetry';
import translationPlugin, { loadTranslations } from './translation';

import {
	Badge,
	Button,
	Dialog,
	ErrorMessage,
	FormControl,
	TextInput,
	frappeRequest,
	resourcesPlugin,
	setConfig,
} from 'frappe-ui';

import './index.css';
import './wiki-editor-content.css';
// KaTeX markup (the maths node view's output) is unstyled without its own sheet.
import 'katex/dist/katex.min.css';

const globalComponents = {
	Button,
	TextInput,
	FormControl,
	ErrorMessage,
	Dialog,
	Badge,
};

const app = createApp(App);

setConfig('resourceFetcher', frappeRequest);

app.use(pinia);

const userStore = useUserStore();
if (!userStore.data) userStore.fetch().catch(() => {});

app.use(router);
app.use(translationPlugin);
app.use(resourcesPlugin);

// Telemetry is for signed-in app users; the Jinja reader sends nothing.
const session = useSessionStore();
let telemetryStarted = false;
watchEffect(() => {
	if (!session.isLoggedIn || telemetryStarted) return;
	telemetryStarted = true;
	app.use(telemetryPlugin, { app_name: 'wiki' });
	trackPageviews(router);
});

const socket = initSocket();
app.config.globalProperties.$socket = socket;

for (const key in globalComponents) {
	app.component(key, globalComponents[key]);
}

// The catalog has to be in place before the first render, not after it: see
// loadTranslations(). `finally` keeps a failed fetch from blanking the app.
loadTranslations().finally(() => app.mount('#app'));
