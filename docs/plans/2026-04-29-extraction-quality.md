# Extraction Quality Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve non-AI extraction quality with selectable extraction modes, stronger content cleaning, richer metadata, better table/code output, and manual cleanup tools.

**Architecture:** Keep all extraction local inside content scripts and popup state. Add pure extraction/cleanup helpers in `lib/extraction-options.ts` and `lib/content-cleaner.ts`, pass extraction options through `lib/messaging.ts`, and expose small controls in `entrypoints/popup/App.tsx`. Preserve current default behavior as `article` mode so existing users are not surprised.

**Tech Stack:** WXT, React 19, TypeScript, Bun tests, jsdom, Readability, Turndown/GFM, DOMPurify, Tailwind CSS.

---

### Task 1: Add extraction option types and default settings

**Files:**

- Modify: `lib/types.ts`
- Create: `lib/extraction-options.ts`
- Create: `lib/extraction-options.test.ts`

**Step 1: Write failing tests**

Create `lib/extraction-options.test.ts`:

```ts
import { describe, expect, it } from "bun:test";
import {
  DEFAULT_EXTRACTION_OPTIONS,
  normalizeExtractionOptions,
} from "./extraction-options";

describe("extraction options", () => {
  it("keeps defaults when no options are provided", () => {
    expect(normalizeExtractionOptions()).toEqual(DEFAULT_EXTRACTION_OPTIONS);
  });

  it("accepts a supported mode", () => {
    expect(normalizeExtractionOptions({ mode: "clean" }).mode).toBe("clean");
  });

  it("falls back from invalid mode", () => {
    expect(normalizeExtractionOptions({ mode: "bad" as any }).mode).toBe(
      "article",
    );
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test lib/extraction-options.test.ts`

Expected: FAIL because `lib/extraction-options.ts` does not exist.

**Step 3: Add types**

In `lib/types.ts`, add near output types:

```ts
export type ExtractionMode = "article" | "clean" | "raw";

export interface ExtractionOptions {
  mode: ExtractionMode;
  includeImages: boolean;
  includeLinks: boolean;
  includeMetadata: boolean;
  removeDuplicates: boolean;
}
```

**Step 4: Implement defaults and normalizer**

Create `lib/extraction-options.ts`:

```ts
import type { ExtractionMode, ExtractionOptions } from "./types";

export const DEFAULT_EXTRACTION_OPTIONS: ExtractionOptions = {
  mode: "article",
  includeImages: true,
  includeLinks: true,
  includeMetadata: true,
  removeDuplicates: true,
};

const MODES = new Set<ExtractionMode>(["article", "clean", "raw"]);

export function normalizeExtractionOptions(
  options?: Partial<ExtractionOptions>,
): ExtractionOptions {
  const mode = MODES.has(options?.mode as ExtractionMode)
    ? (options!.mode as ExtractionMode)
    : DEFAULT_EXTRACTION_OPTIONS.mode;

  return {
    ...DEFAULT_EXTRACTION_OPTIONS,
    ...options,
    mode,
    includeImages:
      typeof options?.includeImages === "boolean"
        ? options.includeImages
        : DEFAULT_EXTRACTION_OPTIONS.includeImages,
    includeLinks:
      typeof options?.includeLinks === "boolean"
        ? options.includeLinks
        : DEFAULT_EXTRACTION_OPTIONS.includeLinks,
    includeMetadata:
      typeof options?.includeMetadata === "boolean"
        ? options.includeMetadata
        : DEFAULT_EXTRACTION_OPTIONS.includeMetadata,
    removeDuplicates:
      typeof options?.removeDuplicates === "boolean"
        ? options.removeDuplicates
        : DEFAULT_EXTRACTION_OPTIONS.removeDuplicates,
  };
}
```

**Step 5: Run tests**

Run: `bun test lib/extraction-options.test.ts`

Expected: PASS.

---

### Task 2: Add content cleaner helper

**Files:**

- Create: `lib/content-cleaner.ts`
- Create: `lib/content-cleaner.test.ts`
- Modify later: `lib/extractor.ts`

**Step 1: Write failing tests**

Create `lib/content-cleaner.test.ts`:

```ts
import { describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import {
  cleanDocumentForExtraction,
  removeDuplicateTextBlocks,
} from "./content-cleaner";

describe("content cleaner", () => {
  it("removes common noisy page elements", () => {
    const dom = new JSDOM(
      `<body><nav>Menu</nav><main><p>Keep me</p></main><footer>Footer</footer><div class="ads">Ad</div></body>`,
    );

    cleanDocumentForExtraction(dom.window.document);

    expect(dom.window.document.body.textContent).toContain("Keep me");
    expect(dom.window.document.body.textContent).not.toContain("Menu");
    expect(dom.window.document.body.textContent).not.toContain("Footer");
    expect(dom.window.document.body.textContent).not.toContain("Ad");
  });

  it("removes duplicate paragraphs while preserving order", () => {
    expect(removeDuplicateTextBlocks("A\n\nB\n\nA\n\nC")).toBe("A\n\nB\n\nC");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test lib/content-cleaner.test.ts`

Expected: FAIL because helper does not exist.

**Step 3: Implement cleaner**

Create `lib/content-cleaner.ts`:

```ts
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
  const container = root instanceof Document ? root : root.ownerDocument;
  if (!container) return;

  const scope = root instanceof Document ? root : root;
  scope.querySelectorAll(NOISE_SELECTORS.join(",")).forEach((element) => {
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
```

**Step 4: Run tests**

Run: `bun test lib/content-cleaner.test.ts`

Expected: PASS.

---

### Task 3: Enrich extraction metadata

**Files:**

- Modify: `lib/types.ts`
- Create: `lib/metadata.ts`
- Create: `lib/metadata.test.ts`
- Modify later: `lib/extractor.ts`

**Step 1: Write failing tests**

Create `lib/metadata.test.ts`:

```ts
import { describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { extractPageMetadata } from "./metadata";

describe("extractPageMetadata", () => {
  it("reads common meta tags and canonical URL", () => {
    const dom = new JSDOM(
      `<!doctype html><html><head>
      <title>Fallback Title</title>
      <meta property="og:title" content="OG Title">
      <meta name="description" content="Meta description">
      <meta name="author" content="Jane Doe">
      <meta property="article:published_time" content="2026-04-29">
      <link rel="canonical" href="/canonical">
    </head><body></body></html>`,
      { url: "https://example.com/post?x=1" },
    );

    expect(
      extractPageMetadata(dom.window.document, "https://example.com/post?x=1"),
    ).toEqual({
      title: "OG Title",
      description: "Meta description",
      author: "Jane Doe",
      publishedTime: "2026-04-29",
      canonicalUrl: "https://example.com/canonical",
      siteName: "example.com",
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test lib/metadata.test.ts`

Expected: FAIL because helper does not exist.

**Step 3: Add metadata type**

In `lib/types.ts`, add:

```ts
export interface ExtractionMetadata {
  title: string;
  description: string;
  author: string;
  publishedTime: string;
  canonicalUrl: string;
  siteName: string;
}
```

Add optional field to `ExtractionResult`:

```ts
metadata?: ExtractionMetadata;
```

**Step 4: Implement metadata helper**

Create `lib/metadata.ts`:

```ts
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
```

**Step 5: Run tests**

Run: `bun test lib/metadata.test.ts`

Expected: PASS.

---

### Task 4: Wire extraction options into messaging and content script

**Files:**

- Modify: `lib/messaging.ts`
- Modify: `entrypoints/content.ts`
- Modify: `entrypoints/popup/App.tsx`

**Step 1: Update messaging schema**

In `lib/messaging.ts`, import `ExtractionOptions` and change signatures:

```ts
import type { ExtractionOptions, ExtractionResult } from "./types";

export interface ExtractRequest {
  template?: string;
  options?: Partial<ExtractionOptions>;
}

export interface MessagingSchema {
  extractContent(request?: ExtractRequest): ExtractionResult | null;
  extractSelection(request?: ExtractRequest): ExtractionResult | null;
  startInspector(request?: ExtractRequest): void;
}
```

**Step 2: Update content script calls**

In `entrypoints/content.ts`, change all `template?.data` usage to:

```ts
request?.data?.template;
request?.data?.options;
```

and call extractor as:

```ts
return await extractPageContent(
  document,
  window.location.href,
  false,
  request?.data?.template,
  request?.data?.options,
);
```

Repeat for selection and picker.

**Step 3: Update popup sender helper**

In `entrypoints/popup/App.tsx`, import `ExtractionOptions` and create state:

```ts
const [extractionOptions, setExtractionOptions] = useState<ExtractionOptions>(
  DEFAULT_EXTRACTION_OPTIONS,
);
```

Update local draft settings to persist `extractionOptions`.

Change `safeSendMessage` calls to:

```ts
return await sendMessage(
  action,
  { template: customTemplate, options: extractionOptions },
  { tabId },
);
```

**Step 4: Run typecheck**

Run: `bun run typecheck`

Expected: PASS.

---

### Task 5: Apply cleaner, metadata, table/code preservation in extractor

**Files:**

- Modify: `lib/extractor.ts`
- Modify: `lib/extractor.test.ts`
- Test: `lib/content-cleaner.test.ts`, `lib/metadata.test.ts`

**Step 1: Add failing behavior tests**

Extend `lib/extractor.test.ts`:

```ts
it("removes noisy content in clean mode", async () => {
  const dom = new JSDOM(
    `<!doctype html><html><head><title>Clean</title></head><body><main><p>Keep this content.</p><div class="newsletter">Subscribe now</div></main></body></html>`,
    { url: "https://example.com/clean" },
  );

  const result = await extractPageContent(
    dom.window.document,
    "https://example.com/clean",
    false,
    undefined,
    { mode: "clean" },
  );

  expect(result?.content).toContain("Keep this content");
  expect(result?.content).not.toContain("Subscribe now");
});

it("can remove images and links from markdown output", async () => {
  const dom = new JSDOM(
    `<!doctype html><html><head><title>Options</title></head><body><main><p><a href="/docs">Docs</a></p><img src="/x.png" alt="X"></main></body></html>`,
    { url: "https://example.com/options" },
  );

  const result = await extractPageContent(
    dom.window.document,
    "https://example.com/options",
    false,
    undefined,
    { mode: "clean", includeImages: false, includeLinks: false },
  );

  expect(result?.content).toContain("Docs");
  expect(result?.content).not.toContain("](https://example.com/docs)");
  expect(result?.content).not.toContain("![X]");
});
```

**Step 2: Run tests to verify they fail**

Run: `bun test lib/extractor.test.ts`

Expected: FAIL because extractor does not accept options yet.

**Step 3: Update extractor signature and setup**

Change signature in `lib/extractor.ts`:

```ts
import type { ExtractionOptions, ExtractionResult } from "./types";
import { cleanDocumentForExtraction, removeDuplicateTextBlocks } from "./content-cleaner";
import { normalizeExtractionOptions } from "./extraction-options";
import { extractPageMetadata } from "./metadata";

export async function extractPageContent(
  doc: Document | HTMLElement,
  url: string,
  isSelection: boolean = false,
  customTemplate?: string,
  options?: Partial<ExtractionOptions>,
): Promise<ExtractionResult | null> {
  const extractionOptions = normalizeExtractionOptions(options);
```

**Step 4: Apply mode behavior**

Before Readability parse on full document clone:

```ts
if (extractionOptions.mode !== "raw") {
  cleanDocumentForExtraction(clone);
}
```

Use Readability only in `article` mode. In `clean` and fallback modes, choose:

```ts
const fallbackRoot =
  clone.querySelector("main") ??
  clone.querySelector("article") ??
  clone.body ??
  clone.documentElement;
```

**Step 5: Configure turndown link/image rules**

Before absolute link rule, add rules:

```ts
if (!extractionOptions.includeImages) {
  turndownService.addRule("drop-images", {
    filter: "img",
    replacement: () => "",
  });
}

if (!extractionOptions.includeLinks) {
  turndownService.addRule("plain-links", {
    filter: "a",
    replacement: (content) => content,
  });
}
```

Only run absolute link rule for links/images still included.

**Step 6: Add metadata and duplicate cleanup**

For full document extraction, compute:

```ts
const metadata =
  doc instanceof Document ? extractPageMetadata(doc, url) : undefined;
```

After markdown and text are created:

```ts
const cleanedMarkdownBody = extractionOptions.removeDuplicates
  ? removeDuplicateTextBlocks(markdownBody)
  : markdownBody;
const cleanedText = extractionOptions.removeDuplicates
  ? removeDuplicateTextBlocks(textContent)
  : textContent;
```

Use cleaned values in final output and include `metadata` only when `includeMetadata` is true.

**Step 7: Run tests**

Run: `bun test lib/extractor.test.ts lib/content-cleaner.test.ts lib/metadata.test.ts lib/extraction-options.test.ts`

Expected: PASS.

---

### Task 6: Add popup controls for extraction modes and options

**Files:**

- Modify: `entrypoints/popup/App.tsx`
- Modify: `lib/extraction-options.ts`

**Step 1: Add mode options constant**

In `entrypoints/popup/App.tsx`, add near provider options:

```ts
const EXTRACTION_MODE_OPTIONS = [
  {
    id: "article",
    label: "Article",
    description: "Terbaik untuk artikel/blog",
  },
  {
    id: "clean",
    label: "Clean Page",
    description: "Terbaik untuk docs/halaman umum",
  },
  { id: "raw", label: "Raw", description: "Fallback saat situs sulit dibaca" },
] as const;
```

**Step 2: Add mode selector in empty state**

Above extraction buttons, add compact selector:

```tsx
<div className="grid grid-cols-3 gap-1 w-full max-w-[320px] rounded-2xl bg-slate-100 dark:bg-slate-800 p-1">
  {EXTRACTION_MODE_OPTIONS.map((option) => (
    <button
      key={option.id}
      type="button"
      onClick={() =>
        setExtractionOptions((prev) => ({ ...prev, mode: option.id }))
      }
      title={option.description}
      className={`px-2 py-2 rounded-xl text-[10px] font-bold ${
        extractionOptions.mode === option.id
          ? "bg-white dark:bg-slate-700 text-blue-600 shadow-sm"
          : "text-slate-500"
      }`}
    >
      {option.label}
    </button>
  ))}
</div>
```

**Step 3: Add manual cleanup toggles in settings**

Add settings section with toggles:

- Include Images
- Keep Links
- Include Metadata
- Remove Duplicates

Each toggle updates `extractionOptions`.

**Step 4: Run checks**

Run: `bun run typecheck && bun run lint`

Expected: PASS.

---

### Task 7: Add manual clean tools after extraction

**Files:**

- Modify: `lib/popup-utils.ts`
- Modify: `lib/popup-utils.test.ts`
- Modify: `entrypoints/popup/App.tsx`

**Step 1: Add failing tests**

Extend `lib/popup-utils.test.ts`:

```ts
import { cleanExtractedText } from "./popup-utils";

it("removes markdown links when requested", () => {
  expect(cleanExtractedText("Read [Docs](https://example.com)", "links")).toBe(
    "Read Docs",
  );
});

it("removes markdown images when requested", () => {
  expect(cleanExtractedText("![Logo](logo.png)\nText", "images")).toBe("Text");
});
```

**Step 2: Run tests to verify they fail**

Run: `bun test lib/popup-utils.test.ts`

Expected: FAIL because `cleanExtractedText` does not exist.

**Step 3: Implement clean helper**

In `lib/popup-utils.ts`, add:

```ts
export type ManualCleanAction = "links" | "images" | "blankLines";

export function cleanExtractedText(
  content: string,
  action: ManualCleanAction,
): string {
  if (action === "links") {
    return content.replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1").trim();
  }
  if (action === "images") {
    return content.replace(/!\[[^\]]*\]\([^\)]+\)\n?/g, "").trim();
  }
  return content.replace(/\n{3,}/g, "\n\n").trim();
}
```

**Step 4: Add UI buttons**

In result preview section, add buttons:

- `Remove Links`
- `Remove Images`
- `Trim Blank Lines`

Each button updates `extractedData.content` and `extractedData.textContent` based on current format.

**Step 5: Run checks**

Run: `bun test lib/popup-utils.test.ts && bun run typecheck && bun run lint`

Expected: PASS.

---

### Task 8: Final quality gate and manual check

**Files:**

- No source changes unless checks fail.

**Step 1: Run all relevant tests**

Run: `bun test lib/extraction-options.test.ts lib/content-cleaner.test.ts lib/metadata.test.ts lib/extractor.test.ts lib/popup-utils.test.ts`

Expected: PASS.

**Step 2: Run full project checks**

Run: `bun run check`

Expected: PASS.

**Step 3: Build extension**

Run: `bun run build`

Expected: PASS.

**Step 4: Manual extension check**

Run: `bun run dev` and verify in browser:

1. Popup shows extraction mode selector.
2. Article mode still extracts normal article pages.
3. Clean Page mode removes nav/footer/newsletter-like noise.
4. Raw mode returns fallback content on difficult pages.
5. Settings toggles persist across popup reopen.
6. Include Images off removes image markdown.
7. Keep Links off keeps text but removes markdown URL formatting.
8. Metadata remains available in result object and does not break history restore.
9. Manual clean buttons update preview without re-extracting.
10. AI settings from previous work still save and work.

**Step 5: Report results**

Report changed files, test/check/build evidence, and any manual checks not completed.
