import type { ExtractionMetadata } from "./types";

function getMeta(doc: Document, selector: string): string {
  return doc.querySelector<HTMLMetaElement>(selector)?.content.trim() ?? "";
}

export function extractPageMetadata(
  doc: Document,
  rawUrl: string,
): ExtractionMetadata {
  const url = new URL(rawUrl);
  const canonicalHref = doc
    .querySelector<HTMLLinkElement>('link[rel="canonical"]')
    ?.href.trim();

  return {
    title:
      getMeta(doc, 'meta[property="og:title"]') ||
      getMeta(doc, 'meta[name="twitter:title"]') ||
      doc.title.trim(),
    description:
      getMeta(doc, 'meta[name="description"]') ||
      getMeta(doc, 'meta[property="og:description"]'),
    author:
      getMeta(doc, 'meta[name="author"]') ||
      getMeta(doc, 'meta[property="article:author"]'),
    publishedTime:
      getMeta(doc, 'meta[property="article:published_time"]') ||
      getMeta(doc, 'meta[name="date"]'),
    canonicalUrl: canonicalHref ? new URL(canonicalHref, rawUrl).href : rawUrl,
    siteName: getMeta(doc, 'meta[property="og:site_name"]') || url.hostname,
  };
}
