import { telemetryPlugin } from '@framework/ui/telemetry/index.ts';
import { createApp, watchEffect } from 'vue';

import App from './App.vue';
import router from './router';
import { initSocket } from './socket';
import { pinia } from './stores';
import { useSessionStore } from './stores/session';
import { useUserStore } from './stores/user';

import { resolveDayjsLocale } from './lib/dayjsLocale';
import { trackPageviews } from './telemetry';
import translationPlugin, { loadTranslations } from './translation';

import {
	Badge,
	Button,
	Dialog,
	ErrorMessage,
	FormControl,
	TextInput,
	dayjs,
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
//
// dayjs needs the same treatment: `relativeTime` is extended but no locale is
// selected, so `fromNow()` would stay English on a zh site. Load and select the
// locale for the current language before mount, alongside the gettext catalog.
async function loadDayjsLocale() {
	const locale = resolveDayjsLocale(window.frappe?.boot?.lang);
	if (!locale || locale === 'en') {
		dayjs.locale('en');
		return;
	}
	try {
		await import(`dayjs/locale/${locale}`);
		dayjs.locale(locale);
	} catch {
		// A missing locale leaves the English default; a relative timestamp is not
		// worth blanking the app over.
		dayjs.locale('en');
	}
}

Promise.all([loadTranslations(), loadDayjsLocale()]).finally(() => app.mount('#app'));
