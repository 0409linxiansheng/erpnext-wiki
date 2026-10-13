(function () {
  // `trust: false` is the security-relevant one: maths source is untrusted,
  // author-supplied content, so `\href{javascript:...}` must never become a link.
  // `throwOnError: false` keeps an invalid formula on screen as its source.
  const KATEX_OPTIONS = { throwOnError: false, strict: false, trust: false };

  // katex.render() replaces the element's content with its own markup, so the
  // original TeX must be stashed the first time to stay re-renderable. The
  // server emits the escaped TeX as the element's text; capture it first.
  function renderInto(katex, el) {
    let source = el.getAttribute("data-math-src");
    if (source === null) {
      source = (el.textContent || "").trim();
      el.setAttribute("data-math-src", source);
    }
    if (!source) return;

    const displayMode = el.classList.contains("math-block");
    try {
      katex.render(source, el, { ...KATEX_OPTIONS, displayMode });
    } catch (error) {
      console.error("Failed to render maths:", error);
    }
  }

  async function renderWikiMath(root) {
    const scope = root || document;
    if (!scope.querySelectorAll) return;

    const content =
      scope.id === "wiki-content" ? scope : scope.querySelector("#wiki-content");
    if (!content) return;

    const formulas = Array.from(
      content.querySelectorAll(".math-inline, .math-block"),
    );
    // No maths on the page: never fetch KaTeX.
    if (!formulas.length) return;

    try {
      const katex = await window.wikiGetKatex();
      for (const el of formulas) renderInto(katex, el);
    } catch (error) {
      console.error("Failed to load KaTeX:", error);
    }
  }

  document.addEventListener("DOMContentLoaded", () => renderWikiMath(document));
  window.renderWikiMath = renderWikiMath;
})();