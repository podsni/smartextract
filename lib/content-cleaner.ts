// Selectors for noise elements common across modern news/blog sites
const NOISE_SELECTORS = [
  // Navigation & chrome
  "nav",
  "header",
  "footer",
  "[role='navigation']",
  "[role='banner']",
  "[role='contentinfo']",
  "[role='complementary']",

  // Ads & tracking
  "script",
  "style",
  "noscript",
  "iframe",
  ".ads",
  ".ad",
  ".advertisement",
  "[class*='advert']",
  "[id*='advert']",
  "[class*='-ad-']",
  "[id*='-ad-']",
  "[aria-label*='advertisement' i]",
  "[data-ad]",
  "[data-ad-slot]",
  "ins.adsbygoogle",

  // Social / sharing
  ".social-share",
  ".share",
  "[class*='share']",
  "[class*='social']",
  "[aria-label*='share' i]",

  // Comments
  ".comments",
  ".comment",
  "#comments",
  "[id*='comment']",
  "[class*='comment']",
  "disqus_thread",

  // Newsletter / subscribe prompts
  ".newsletter",
  ".newsletter-signup",
  "[class*='newsletter']",
  "[class*='subscribe']",
  "[class*='signup']",
  "[class*='sign-up']",
  "[id*='newsletter']",
  "[id*='subscribe']",

  // Cookie banners
  ".cookie",
  ".cookie-banner",
  "[class*='cookie']",
  "[id*='cookie']",
  "[class*='consent']",
  "[id*='consent']",
  "[class*='gdpr']",

  // Modals & overlays
  ".modal",
  "[class*='modal']",
  "[class*='overlay']",
  "[class*='paywall']",
  "[class*='gate']",
  "[class*='wall']",

  // Sidebars & recirculation
  "aside",
  "[role='complementary']",
  "[class*='sidebar']",
  "[class*='recirculation']",
  "[class*='related']",
  "[class*='recommended']",
  "[class*='trending']",
  "[class*='popular']",
  "[class*='more-stories']",
  "[class*='more-articles']",
  "[class*='also-read']",
  "[class*='read-next']",
  "[class*='read-more']",
  "[class*='you-might']",

  // Promos / banners
  "[class*='promo']",
  "[class*='banner']",
  "[class*='sticky']",
  "[class*='fixed-bar']",
  "[class*='announcement']",
  "[class*='notification']",
  "[class*='alert-bar']",

  // Author boxes & bios (outside article body)
  "[class*='author-bio']",
  "[class*='author-box']",

  // Tags / topics nav below article
  "[class*='tag-list']",
  "[class*='topics']",

  // Skip-to links & hidden accessibility elements that leak text
  ".skip-link",
  "[class*='skip-nav']",

  // Embedded app shells that produce garbage text
  "[class*='app-download']",
  "[class*='app-promo']",

  // Print / share toolbars
  "[class*='toolbar']",
  "[class*='tools']",
  "[class*='utility-bar']",
];

// Attribute-based noise patterns (on any element)
const NOISE_ATTRS: Array<[string, RegExp]> = [
  ["aria-hidden", /^true$/i],
  ["data-nosnippet", /.*/],
];

export function cleanDocumentForExtraction(root: Document | HTMLElement): void {
  // Remove by selector
  root.querySelectorAll(NOISE_SELECTORS.join(",")).forEach((el) => {
    el.remove();
  });

  // Remove elements with noise attributes
  NOISE_ATTRS.forEach(([attr, pattern]) => {
    root.querySelectorAll(`[${attr}]`).forEach((el) => {
      const val = el.getAttribute(attr) ?? "";
      if (pattern.test(val)) el.remove();
    });
  });

  // Strip empty block elements that clutter turndown output
  const EMPTY_BLOCKS = ["p", "div", "section", "span"];
  root.querySelectorAll(EMPTY_BLOCKS.join(",")).forEach((el) => {
    if (!(el.textContent ?? "").trim() && !el.querySelector("img")) {
      el.remove();
    }
  });
}

export function removeDuplicateTextBlocks(text: string): string {
  const seen = new Set<string>();
  return text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter((block) => {
      if (!block) return false;
      const key = block.toLowerCase().replace(/\s+/g, " ");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join("\n\n");
}
