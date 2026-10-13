import { onBeforeUnmount, ref } from 'vue';

/**
 * Dictation through the browser's Web Speech API.
 *
 * Deliberately browser-only: no server transcription, no third-party key, and no
 * audio of ours to store. The trade-off is availability — the API exists in
 * Chromium and Safari and refuses to work without a secure context, which is why
 * the caller renders nothing at all when this reports `supported: false` rather
 * than showing a button that cannot work.
 *
 * The composable only reports transcripts; whoever owns the editor decides what to
 * do with them.
 */

/** Speech recognition wants a region ("zh-CN"), and a bare code is the common case. */
function recognitionLanguage() {
	const lang = globalThis.frappe?.boot?.lang;
	if (!lang) return '';

	return lang === 'zh' ? 'zh-CN' : lang;
}

export function useSpeechToText({ onResult, onEnd } = {}) {
	const Recognition =
		typeof window === 'undefined'
			? null
			: window.SpeechRecognition || window.webkitSpeechRecognition;

	const supported = !!Recognition;
	const listening = ref(false);
	const error = ref('');

	let recognition = null;

	function stop() {
		listening.value = false;
		try {
			recognition?.stop();
		} catch {
			// Already stopped, or never started: nothing to do either way.
		}
	}

	function start() {
		if (!supported || listening.value) return;

		error.value = '';
		recognition = new Recognition();
		recognition.continuous = true;
		recognition.interimResults = true;
		const lang = recognitionLanguage();
		if (lang) recognition.lang = lang;

		recognition.onresult = (event) => {
			let interim = '';
			for (let index = event.resultIndex; index < event.results.length; index++) {
				const result = event.results[index];
				const transcript = result[0]?.transcript ?? '';
				if (result.isFinal) {
					onResult?.(transcript.trim(), true);
				} else {
					interim += transcript;
				}
			}
			if (interim.trim()) onResult?.(interim.trim(), false);
		};

		recognition.onerror = (event) => {
			// A denied microphone lands here, and has to leave the editor untouched.
			error.value = event?.error || 'unknown';
			listening.value = false;
		};

		recognition.onend = () => {
			listening.value = false;
			onEnd?.();
		};

		try {
			recognition.start();
			listening.value = true;
		} catch (err) {
			error.value = err?.message || 'could not start';
			listening.value = false;
		}
	}

	function toggle() {
		if (listening.value) stop();
		else start();
	}

	onBeforeUnmount(stop);

	return { supported, listening, error, start, stop, toggle };
}
