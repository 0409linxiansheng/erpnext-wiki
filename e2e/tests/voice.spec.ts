import { expect, test } from '../fixtures';
import { createDraftAndOpenEditor } from '../helpers/wiki';

/**
 * Dictation (Alexandrie port, spec 02).
 *
 * A test cannot speak, but it can stand in for the recogniser: the contract the app
 * depends on is "the Web Speech API hands us transcripts", so the suite installs a
 * stub that emits them and asserts the wiring. The other half of the contract is
 * negative — where no API exists, the control must not render at all, and headless
 * Chromium does expose one natively, so that test removes it deliberately rather
 * than hoping.
 */

/** Installs a recogniser that the test drives through `window.__emitSpeech`. */
const WITH_STUB = () => {
	class FakeRecognition {
		continuous = false;
		interimResults = false;
		lang = '';
		onresult: ((event: unknown) => void) | null = null;
		onerror: ((event: unknown) => void) | null = null;
		onend: (() => void) | null = null;

		start() {
			(window as unknown as { __recognition?: unknown }).__recognition = this;
		}

		stop() {
			this.onend?.();
		}
	}

	const scope = window as unknown as Record<string, unknown>;
	scope.SpeechRecognition = FakeRecognition;
	scope.__emitSpeech = (transcript: string, isFinal: boolean) => {
		const recognition = scope.__recognition as FakeRecognition | undefined;
		if (!recognition?.onresult) throw new Error('dictation never started');

		const result = Object.assign([{ transcript }], { isFinal }) as unknown;
		recognition.onresult({ resultIndex: 0, results: [result] });
	};
};

/** Removes the API, so the capability path can be asserted deterministically. */
const WITHOUT_STUB = () => {
	for (const key of ['SpeechRecognition', 'webkitSpeechRecognition']) {
		Object.defineProperty(window, key, { value: undefined, configurable: true });
	}
};

test.describe('dictation', () => {
	test('a transcript lands in the editor, and an interim one is replaced, not duplicated', async ({
		page,
		wiki,
	}) => {
		await page.addInitScript(WITH_STUB);

		const editor = await createDraftAndOpenEditor(
			page,
			await wiki.space(),
			`dictate-${Date.now()}`,
		);

		await page.getByRole('button', { name: 'Dictate' }).click();
		await expect(page.getByRole('button', { name: 'Stop dictation' })).toBeVisible();

		// The recogniser only reports what it heard, so the test says it heard
		// something and then checks where it went.
		await page.evaluate(() => {
			(window as unknown as { __emitSpeech: (t: string, f: boolean) => void }).__emitSpeech(
				'Hello from dictation',
				false,
			);
		});
		await expect(editor).toContainText('Hello from dictation');

		await page.evaluate(() => {
			(window as unknown as { __emitSpeech: (t: string, f: boolean) => void }).__emitSpeech(
				'Hello from dictation.',
				true,
			);
		});
		await expect(editor).toContainText('Hello from dictation.');

		// The interim copy was replaced rather than left behind: one "dictation".
		const text = await editor.innerText();
		expect(text.split('dictation').length - 1).toBe(1);
	});

	test('the control is not rendered where the API is missing', async ({ page, wiki }) => {
		await page.addInitScript(WITHOUT_STUB);

		const editor = await createDraftAndOpenEditor(
			page,
			await wiki.space(),
			`dictate-off-${Date.now()}`,
		);

		// The editor is up, so the absence below is about capability, not a page that
		// never finished loading.
		await expect(editor).toBeVisible();
		await expect(page.getByRole('button', { name: 'Dictate' })).toHaveCount(0);
	});
});
