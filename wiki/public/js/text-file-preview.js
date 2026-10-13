/**
 * Public-side text/code file preview.
 *
 * Server-rendered `.wiki-text-file-embed` blocks (wiki/wiki/markdown.py) ship with
 * a filename, a download link and an empty <code>. This fetches the file's text
 * into the <code> and highlights it with the same highlight.js the reader already
 * loads for code blocks — the vanilla counterpart to the editor's file node view.
 *
 * Mirrors pdf-viewer.js: lazy, idempotent binding + a MutationObserver so previews
 * are re-hydrated after SPA navigation swaps #wiki-content. Fetches are guarded by
 * the same-origin path (a /files/ upload), and a failure leaves the download-link
 * fallback in place.
 */
(function () {
	// Filename extension -> highlight.js language id. Unmapped or unknown
	// extensions fall back to highlight.js auto-detection.
	const LANGUAGE_BY_EXT = {
		md: 'markdown',
		markdown: 'markdown',
		json: 'json',
		jsonl: 'json',
		yaml: 'yaml',
		yml: 'yaml',
		py: 'python',
		js: 'javascript',
		mjs: 'javascript',
		cjs: 'javascript',
		ts: 'typescript',
		jsx: 'javascript',
		tsx: 'typescript',
		css: 'css',
		scss: 'scss',
		less: 'less',
		html: 'xml',
		htm: 'xml',
		xml: 'xml',
		sh: 'bash',
		bash: 'bash',
		zsh: 'bash',
		fish: 'bash',
		sql: 'sql',
		ini: 'ini',
		toml: 'ini',
		conf: 'ini',
		diff: 'diff',
		patch: 'diff',
		tex: 'latex',
		rst: 'plaintext',
	};

	function languageFor(filename) {
		const name = String(filename || '').toLowerCase();
		const ext = name.includes('.') ? name.split('.').pop() : '';
		return LANGUAGE_BY_EXT[ext] || '';
	}

	function hydrateOne(el) {
		if (el.dataset.hydrated) return;
		el.dataset.hydrated = '1';

		const src = el.getAttribute('data-src');
		const code = el.querySelector('code[data-role="content"]');
		if (!src || !code) return;

		fetch(src)
			.then((response) => {
				if (!response.ok) throw new Error(String(response.status));
				return response.text();
			})
			.then((text) => {
				// textContent escapes by construction — a file containing markup or
				// a script tag renders as text, never as live HTML.
				code.textContent = text;
				code.classList.add('hljs');
				const lang = languageFor(el.getAttribute('data-filename') || src);
				if (lang) code.classList.add(`language-${lang}`);
				if (typeof hljs !== 'undefined') hljs.highlightElement(code);
			})
			.catch(() => {
				// Leave the filename + download link as the fallback.
			});
	}

	function hydrateAll() {
		document.querySelectorAll('[data-type="text-file-block"]').forEach(hydrateOne);
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', hydrateAll);
	} else {
		hydrateAll();
	}

	// SPA navigation swaps #wiki-content; re-hydrate whatever appears.
	new MutationObserver(hydrateAll).observe(document.body, {
		childList: true,
		subtree: true,
	});
})();
