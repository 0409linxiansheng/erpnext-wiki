export default function translationPlugin(app) {
	app.config.globalProperties.__ = translate;
	window.__ = translate;
}

function format(message, replace) {
	return message.replace(/{(\d+)}/g, (match, number) =>
		typeof replace[number] !== 'undefined' ? replace[number] : match,
	);
}

function translate(message, replace, context = null) {
	const translatedMessages = window.translatedMessages || {};
	let translatedMessage = '';

	if (context) {
		const key = `${message}:${context}`;
		if (translatedMessages[key]) {
			translatedMessage = translatedMessages[key];
		}
	}

	if (!translatedMessage) {
		translatedMessage = translatedMessages[message] || message;
	}

	const hasPlaceholders = /{\d+}/.test(message);
	if (!hasPlaceholders) {
		return translatedMessage;
	}

	return format(translatedMessage, replace);
}

/**
 * Fetch the catalogs the SPA renders with, and resolve once they are in place.
 *
 * `translate()` reads a plain object, so a catalog that arrives late never
 * triggers a re-render: every string a component resolves during setup keeps the
 * msgid. On the standalone `/wiki-app` route nothing else sets
 * `window.translatedMessages` (embedded in the Desk, frappe's boot already has),
 * so `main.js` awaits this before mounting. See specs/i18n_chinese_first.md.
 */
async function loadTranslations() {
	if (window.translatedMessages) return;

	try {
		const response = await fetch('/api/method/wiki.api.get_translations', {
			credentials: 'same-origin',
		});
		const payload = await response.json();
		window.translatedMessages = payload.message ?? payload;
	} catch (error) {
		// A missing catalog renders msgids, which is the pre-existing behaviour —
		// it must never stop the app from mounting.
		console.error('wiki: could not load translations', error);
	}
}

export { loadTranslations };
