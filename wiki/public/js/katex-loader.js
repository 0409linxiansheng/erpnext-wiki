(function () {
  // The vendored bundle is served with far-future `immutable` caching, so the
  // bare path would keep serving the previously fetched copy after a version
  // bump. Bump this alongside the files in vendor/katex/.
  const KATEX_VERSION = "0.16.22";
  const base = "/assets/wiki/js/vendor/katex/";
  const defaultScriptUrl = base + "katex.min.js?v=" + KATEX_VERSION;
  const defaultStyleUrl = base + "katex.min.css?v=" + KATEX_VERSION;

  // KaTeX's stylesheet is only useful with KaTeX loaded, so it rides along with
  // the script rather than being a <link> in the layout — a page with no maths
  // never pays for it. The stylesheet's own font URLs are relative
  // (`fonts/KaTeX_*.woff2`) and resolve under vendor/katex/.
  function ensureStylesheet(url) {
    if (document.querySelector("link[data-wiki-katex]")) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = url;
    link.setAttribute("data-wiki-katex", "");
    document.head.appendChild(link);
  }

  window.__wikiKatexPromise = window.__wikiKatexPromise || null;

  window.wikiGetKatex = function (options) {
    const scriptUrl = options?.assetUrl || defaultScriptUrl;
    const styleUrl = options?.styleUrl || defaultStyleUrl;

    if (window.katex) {
      ensureStylesheet(styleUrl);
      return Promise.resolve(window.katex);
    }

    if (!window.__wikiKatexPromise) {
      window.__wikiKatexPromise = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = scriptUrl;
        script.onload = () => resolve(window.katex);
        script.onerror = () =>
          reject(new Error("Unable to load local KaTeX asset"));
        document.head.appendChild(script);
      }).then((katex) => {
        if (!katex) {
          throw new Error("Local KaTeX asset did not expose window.katex");
        }
        ensureStylesheet(styleUrl);
        return katex;
      });
    }

    return window.__wikiKatexPromise;
  };
})();