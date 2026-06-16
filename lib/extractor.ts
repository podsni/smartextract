import { Readability } from "@mozilla/readability";
import TurndownService from "turndown";
// @ts-ignore - plugin-gfm might not have types in some environments
import { gfm } from "turndown-plugin-gfm";
import DOMPurify from "dompurify";
import {
  cleanDocumentForExtraction,
  removeDuplicateTextBlocks,
} from "./content-cleaner";
import { analyzeExtractionQuality } from "./extraction-analysis";
import { normalizeExtractionOptions } from "./extraction-options";
import { extractPageMetadata } from "./metadata";
import type { ExtractionOptions, ExtractionResult } from "./types";
import { DEFAULT_TEMPLATE } from "./types";

const sanitizeHtml = (html: string): string => {
  if (typeof DOMPurify.sanitize === "function") {
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [
        "p",
        "br",
        "b",
        "i",
        "strong",
        "em",
        "a",
        "img",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "ul",
        "ol",
        "li",
        "blockquote",
        "pre",
        "code",
        "table",
        "thead",
        "tbody",
        "tr",
        "th",
        "td",
        "figure",
        "figcaption",
        "picture",
        "source",
        "hr",
        "s",
        "del",
        "sup",
        "sub",
        "mark",
      ],
      ALLOWED_ATTR: [
        "href",
        "src",
        "alt",
        "title",
        "data-src",
        "data-srcset",
        "srcset",
        "class",
        "id",
        "cite",
      ],
      ALLOW_DATA_ATTR: false,
    });
  }
  return html;
};

const isDocumentNode = (value: Document | HTMLElement): value is Document => {
  return value.nodeType === 9;
};

/**
 * Resolve lazy-loaded image src: try data-src, data-srcset, srcset before src.
 */
function resolveImgSrc(el: HTMLElement, baseUrl: string): string | null {
  const raw =
    el.getAttribute("data-src") ||
    el.getAttribute("data-srcset")?.split(",")[0]?.trim().split(" ")[0] ||
    el.getAttribute("srcset")?.split(",")[0]?.trim().split(" ")[0] ||
    el.getAttribute("src");
  if (!raw || raw.startsWith("data:")) return null;
  try {
    return new URL(raw, baseUrl).href;
  } catch {
    return raw;
  }
}

/**
 * Post-process markdown to clean up common turndown artifacts.
 */
function cleanMarkdown(md: string): string {
  return (
    md
      // Collapse 3+ blank lines → 2
      .replace(/\n{3,}/g, "\n\n")
      // Remove empty links []() or [](#...)
      .replace(/\[([^\]]*)\]\(#[^)]*\)/g, "$1")
      .replace(/\[\]\([^)]+\)/g, "")
      // Remove zero-width / non-printable characters
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F​‌‍﻿]/g, "")
      // Fix double-escaped backslashes from turndown
      .replace(/\\([*_`[\]()#>|~])/g, "$1")
      // Remove lines that are ONLY punctuation / single chars (turndown artifacts)
      .replace(/^[|\\-]{1,3}$/gm, "")
      // Trim trailing whitespace per line
      .replace(/[ \t]+$/gm, "")
      .trim()
  );
}

/**
 * Replaces template variables with actual data.
 * Variables: {{title}}, {{author}}, {{url}}, {{date}}, {{published}}, {{site}}, {{content}}
 */
function applyTemplate(
  template: string,
  data: {
    title: string;
    author: string;
    url: string;
    date: string;
    published: string;
    siteName: string;
    content: string;
  },
): string {
  return template
    .replace(/{{title}}/g, data.title)
    .replace(/{{author}}/g, data.author)
    .replace(/{{url}}/g, data.url)
    .replace(/{{date}}/g, data.date)
    .replace(/{{published}}/g, data.published)
    .replace(/{{site}}/g, data.siteName)
    .replace(/{{content}}/g, data.content);
}

/**
 * Build TurndownService with full rule set for clean GFM output.
 */
function buildTurndown(
  url: string,
  includeImages: boolean,
  includeLinks: boolean,
): TurndownService {
  const td = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
    hr: "---",
  });

  try {
    td.use(gfm);
  } catch {
    // fallback if gfm plugin fails
  }

  // figure → extract img + figcaption
  td.addRule("figure", {
    filter: "figure",
    replacement: (_content, node) => {
      if (!includeImages) return "";
      const el = node as HTMLElement;
      const img = el.querySelector("img");
      const caption = el.querySelector("figcaption")?.textContent?.trim() ?? "";
      if (!img) return caption ? `\n\n_${caption}_\n\n` : "";
      const src = resolveImgSrc(img as HTMLElement, url);
      if (!src) return caption ? `\n\n_${caption}_\n\n` : "";
      const alt = img.getAttribute("alt")?.trim() || caption;
      return caption
        ? `\n\n![${alt}](${src})\n_${caption}_\n\n`
        : `\n\n![${alt}](${src})\n\n`;
    },
  });

  // blockquote — keep clean, trim attribution lines
  td.addRule("blockquote", {
    filter: "blockquote",
    replacement: (content) => {
      const trimmed = content.trim();
      if (!trimmed) return "";
      return (
        "\n\n" +
        trimmed
          .split("\n")
          .map((line) => `> ${line}`)
          .join("\n") +
        "\n\n"
      );
    },
  });

  // Drop images entirely when disabled
  if (!includeImages) {
    td.addRule("drop-images", {
      filter: ["img", "picture", "source"],
      replacement: () => "",
    });
  } else {
    // Resolve lazy-loaded images
    td.addRule("lazy-img", {
      filter: "img",
      replacement: (_content, node) => {
        const el = node as HTMLElement;
        const src = resolveImgSrc(el, url);
        if (!src) return "";
        const alt = el.getAttribute("alt")?.trim() ?? "";
        return `![${alt}](${src})`;
      },
    });
  }

  // Links — plain text when disabled, absolute href when enabled
  if (!includeLinks) {
    td.addRule("plain-links", {
      filter: "a",
      replacement: (content) => content,
    });
  } else {
    td.addRule("absolute-links", {
      filter: "a",
      replacement: (content, node) => {
        const el = node as HTMLElement;
        const href = el.getAttribute("href");
        if (!href || href.startsWith("#") || href.startsWith("javascript:")) {
          return content;
        }
        try {
          return `[${content}](${new URL(href, url).href})`;
        } catch {
          return `[${content}](${href})`;
        }
      },
    });
  }

  return td;
}

/**
 * Core extraction function — handles full page, selection, and element modes.
 */
export async function extractPageContent(
  doc: Document | HTMLElement,
  url: string,
  isSelection: boolean = false,
  customTemplate?: string,
  options?: Partial<ExtractionOptions>,
): Promise<ExtractionResult | null> {
  const opts = normalizeExtractionOptions(options);
  const metadata = isDocumentNode(doc)
    ? extractPageMetadata(doc, url)
    : undefined;

  let title = "";
  let textContent = "";
  let cleanHtml = "";
  let siteName = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  })();
  let byline = "";
  let excerpt = "";
  let publishedTime = metadata?.publishedTime ?? "";

  if (isSelection && !isDocumentNode(doc)) {
    // Selection or element pick — just sanitize and convert
    title = `Selection from ${siteName}`;
    cleanHtml = sanitizeHtml((doc as HTMLElement).innerHTML);
    textContent = (doc as HTMLElement).innerText ?? doc.textContent ?? "";
  } else {
    const clone = (doc as Document).cloneNode(true) as Document;

    if (opts.mode !== "raw") {
      cleanDocumentForExtraction(clone);
    }

    const article =
      opts.mode === "article"
        ? (() => {
            try {
              return new Readability(clone, {
                keepClasses: false,
                charThreshold: 20,
              }).parse();
            } catch {
              return null;
            }
          })()
        : null;

    if (article) {
      title = article.title?.trim() || "";
      cleanHtml = sanitizeHtml(article.content || "");
      textContent = article.textContent || "";
      siteName = article.siteName?.trim() || siteName;
      byline = article.byline?.trim() || "";
      excerpt = article.excerpt?.trim() || "";
      publishedTime = publishedTime || "";
    } else {
      // Fallback: prefer <main> / <article> over full <body>
      const fallback =
        clone.querySelector("main") ??
        clone.querySelector('[role="main"]') ??
        clone.querySelector("article") ??
        clone.body ??
        clone.documentElement;
      title = clone.title?.trim() || siteName;
      cleanHtml = sanitizeHtml((fallback as HTMLElement).innerHTML || "");
      textContent = fallback.textContent || "";
    }

    if (!textContent.trim()) return null;
  }

  const td = buildTurndown(url, opts.includeImages, opts.includeLinks);
  const rawMarkdown = td.turndown(cleanHtml);
  const markdownBody = cleanMarkdown(rawMarkdown);

  const cleanedMarkdownBody = opts.removeDuplicates
    ? removeDuplicateTextBlocks(markdownBody)
    : markdownBody;

  const cleanedText = opts.removeDuplicates
    ? removeDuplicateTextBlocks(textContent.replace(/\n{3,}/g, "\n\n").trim())
    : textContent.replace(/\n{3,}/g, "\n\n").trim();

  const dateStr = new Date().toLocaleString("id-ID", {
    dateStyle: "long",
    timeStyle: "short",
  });
  const author = byline || metadata?.author || "Unknown Author";

  const templateData = {
    title,
    author,
    url,
    date: dateStr,
    published: publishedTime || dateStr,
    siteName,
    content: cleanedMarkdownBody,
  };

  const finalMd = isSelection
    ? cleanedMarkdownBody
    : applyTemplate(customTemplate || DEFAULT_TEMPLATE, templateData);

  const finalTxt = isSelection
    ? cleanedText
    : applyTemplate(customTemplate || DEFAULT_TEMPLATE, {
        ...templateData,
        content: cleanedText,
      });

  const analysis = analyzeExtractionQuality({
    content: finalMd,
    textContent: finalTxt,
    metadata: opts.includeMetadata ? metadata : undefined,
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
    metadata: opts.includeMetadata ? metadata : undefined,
    analysis,
  };
}
