import { Readability } from "@mozilla/readability";
import TurndownService from "turndown";
// @ts-ignore - plugin-gfm might not have types in some environments
import { gfm } from "turndown-plugin-gfm";
import DOMPurify from "dompurify";
import type { ExtractionResult } from "./types";
import { DEFAULT_TEMPLATE } from "./types";

const sanitizeHtml = (html: string): string => {
  if (typeof DOMPurify.sanitize === "function") {
    return DOMPurify.sanitize(html);
  }

  return html;
};

/**
 * Replaces variables in the template string with actual data.
 */
function applyTemplate(
  template: string,
  data: {
    title: string;
    author: string;
    url: string;
    date: string;
    siteName: string;
    content: string;
  },
): string {
  return template
    .replace(/{{title}}/g, data.title)
    .replace(/{{author}}/g, data.author)
    .replace(/{{url}}/g, data.url)
    .replace(/{{date}}/g, data.date)
    .replace(/{{site}}/g, data.siteName)
    .replace(/{{content}}/g, data.content);
}

/**
 * Core extraction function optimized for universal web compatibility.
 */
export async function extractPageContent(
  doc: Document | HTMLElement,
  url: string,
  isSelection: boolean = false,
  customTemplate?: string,
): Promise<ExtractionResult | null> {
  let title = "";
  let textContent = "";
  let cleanHtml = "";
  let siteName = new URL(url).hostname;
  let byline = "";
  let excerpt = "";

  if (isSelection && doc instanceof HTMLElement) {
    title = `Selection from ${siteName}`;
    cleanHtml = sanitizeHtml(doc.innerHTML);
    textContent = doc.innerText;
  } else {
    const clone = (doc as Document).cloneNode(true) as Document;
    const unwanted = clone.querySelectorAll(
      "nav, footer, .ads, .social-share, .comments, script, style",
    );
    unwanted.forEach((el) => el.remove());

    const reader = new Readability(clone, { keepClasses: false });
    const article = reader.parse();

    if (article) {
      title = article.title || "";
      cleanHtml = sanitizeHtml(article.content || "");
      textContent = article.textContent || "";
      siteName = article.siteName || siteName;
      byline = article.byline || "";
      excerpt = article.excerpt || "";
    } else {
      const fallbackRoot =
        clone.querySelector("main") ??
        clone.querySelector("article") ??
        clone.body ??
        clone.documentElement;
      title = clone.title || siteName;
      cleanHtml = sanitizeHtml(fallbackRoot.innerHTML || "");
      textContent = fallbackRoot.textContent || "";
    }

    if (!textContent.trim()) return null;
  }

  const turndownService = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
    hr: "---",
  });

  try {
    turndownService.use(gfm);
  } catch {
    // Fallback
  }

  turndownService.addRule("absolute-links", {
    filter: (node) => {
      const tag = node.nodeName.toLowerCase();
      return tag === "a" || tag === "img";
    },
    replacement: (content, node) => {
      const el = node as HTMLElement;
      if (el.nodeName === "A") {
        const href = el.getAttribute("href");
        if (href) {
          try {
            const absoluteHref = new URL(href, url).href;
            return `[${content}](${absoluteHref})`;
          } catch {
            return `[${content}](${href})`;
          }
        }
      }
      if (el.nodeName === "IMG") {
        const src = el.getAttribute("src") || el.getAttribute("data-src");
        const alt = el.getAttribute("alt") || "";
        if (src) {
          try {
            const absoluteSrc = new URL(src, url).href;
            return `![${alt}](${absoluteSrc})`;
          } catch {
            return `![${alt}](${src})`;
          }
        }
      }
      return content;
    },
  });

  const markdownBody = turndownService
    .turndown(cleanHtml)
    .replace(/\n{3,}/g, "\n\n");
  const dateStr = new Date().toLocaleString();
  const author = byline || "Unknown Author";

  const templateData = {
    title,
    author,
    url,
    date: dateStr,
    siteName,
    content: markdownBody,
  };

  // Logic:
  // 1. If Selection: Just content (cleanest).
  // 2. If Full Page: Use custom template OR default template.
  const finalMd = isSelection
    ? markdownBody
    : applyTemplate(customTemplate || DEFAULT_TEMPLATE, templateData);

  const finalTxt = isSelection
    ? textContent.replace(/\n{3,}/g, "\n\n").trim()
    : applyTemplate(customTemplate || DEFAULT_TEMPLATE, {
        ...templateData,
        content: textContent,
      });

  return {
    title,
    byline,
    dir: "ltr",
    content: finalMd,
    textContent: finalTxt,
    length: textContent.length,
    excerpt,
    siteName,
    url,
  };
}
