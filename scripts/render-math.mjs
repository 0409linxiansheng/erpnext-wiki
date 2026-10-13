#!/usr/bin/env node
/**
 * Server-side TeX → SVG, for the print flavour of a wiki page.
 *
 * Why this exists: the print format goes through wkhtmltopdf, which runs no
 * JavaScript, so the reader's client-side KaTeX hydration never happens and a
 * formula prints as its raw TeX source. MathJax's SVG output is self-contained —
 * every glyph is a path inside the `<svg>` — so QtWebKit draws it with no fonts
 * and no stylesheet. KaTeX cannot do this: its output is HTML plus a stylesheet
 * plus web fonts, which is exactly what is fragile in a print engine.
 *
 * Uses `mathjax-full/js/*` rather than the single-file `es5/tex-svg.js` bundle:
 * the bundle hard-requires `xmldom-sre`, which only the 3.x speech-rule-engine
 * provides, and mathjax-full depends on 4.x. The `js/` tree is CommonJS and has
 * no `exports` map, so it is requireable from an `.mjs` through createRequire.
 *
 * Protocol: one JSON object on stdin, one on stdout, so a page with many
 * formulas costs one process instead of one process per formula.
 *
 *   in : {"items": [{"key": "…", "tex": "…", "display": true|false}]}
 *   out: {"svg": {"…": "<svg …>", …}}   // a key is absent when it failed
 *
 * A formula that fails to render is not an error: the caller keeps the raw TeX,
 * which is readable, where throwing would cost the whole page.
 *
 * See specs/alexandrie_port/01-editor-math-and-containers.md (Phase 5).
 */

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const { mathjax } = require('mathjax-full/js/mathjax.js');
const { TeX } = require('mathjax-full/js/input/tex.js');
const { SVG } = require('mathjax-full/js/output/svg.js');
const { liteAdaptor } = require('mathjax-full/js/adaptors/liteAdaptor.js');
const { RegisterHTMLHandler } = require('mathjax-full/js/handlers/html.js');
const { AllPackages } = require('mathjax-full/js/input/tex/AllPackages.js');

const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);

// The `html` extension is what defines \href, \style, \class and friends, and
// with it loaded \href{javascript:…} becomes a real <a href> in the SVG — the
// print HTML is previewed in a browser, so that is an XSS vector. The reader
// already refuses it (KaTeX runs with trust: false); dropping the extension here
// makes the server agree, and the formula degrades to visible error text.
const SAFE_PACKAGES = AllPackages.filter(
	(name) => name !== 'html' && name !== 'htmlCssColor',
);

const texInput = new TeX({ packages: SAFE_PACKAGES });
// `fontCache: 'local'` puts the glyph paths inside each SVG, so a printed formula
// carries everything it needs.
const svgOutput = new SVG({ fontCache: 'local' });
const document = mathjax.document('', { InputJax: texInput, OutputJax: svgOutput });

function readStdin() {
	return new Promise((resolve, reject) => {
		let data = '';
		process.stdin.setEncoding('utf8');
		process.stdin.on('data', (chunk) => {
			data += chunk;
		});
		process.stdin.on('end', () => resolve(data));
		process.stdin.on('error', reject);
	});
}

async function main() {
	let payload;
	try {
		payload = JSON.parse(await readStdin());
	} catch (error) {
		process.stderr.write(`render-math: bad input: ${error.message}\n`);
		process.stdout.write('{"svg":{}}');
		return;
	}

	const svg = {};
	for (const item of payload.items ?? []) {
		try {
			const node = document.convert(item.tex, {
				display: !!item.display,
				em: 16,
				ex: 8,
				containerWidth: 80 * 16,
			});
			svg[item.key] = adaptor.outerHTML(node);
		} catch (error) {
			process.stderr.write(`render-math: ${item.key}: ${error.message}\n`);
		}
	}

	process.stdout.write(JSON.stringify({ svg }));
}

main().catch((error) => {
	process.stderr.write(`render-math: ${error?.stack ?? error}\n`);
	process.stdout.write('{"svg":{}}');
});
