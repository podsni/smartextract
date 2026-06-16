const NOISE_SELECTORS = [
  "nav",
  "footer",
  "script",
  "style",
  "noscript",
  "iframe",
  ".ads",
  ".ad",
  ".advertisement",
  "[aria-label*='advertisement' i]",
  ".social-share",
  ".share",
  ".comments",
  ".comment",
  ".newsletter",
  ".cookie",
  ".cookie-banner",
  ".modal",
  ".related-posts",
  "aside",
];

export function cleanDocumentForExtraction(root: Document | HTMLElement): void {
  root.querySelectorAll(NOISE_SELECTORS.join(",")).forEach((element) => {
    element.remove();
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
