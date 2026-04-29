# Smart Extract Polish Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve Smart Extract so the popup is cleaner, more responsive, easier to use, and safer to extend while preserving existing extraction and AI-provider behavior.

**Architecture:** Keep the extension MV3/WXT architecture unchanged. Refactor the popup into small presentational components and pure helper functions, add tests around extracted logic, then improve responsive styling and user-facing workflow states. Avoid new dependencies and avoid broad permission changes.

**Tech Stack:** WXT, React 19, TypeScript, Tailwind CSS v4, browser extension APIs, oxlint, oxfmt, tsgo.

---

### Task 1: Add popup helper tests for filename and stats behavior

**Files:**

- Create: `lib/popup-utils.ts`
- Create: `lib/popup-utils.test.ts`
- Modify later: `entrypoints/popup/App.tsx`

**Step 1: Write the failing tests**

Create `lib/popup-utils.test.ts`:

```ts
import { describe, expect, it } from "bun:test";
import { buildDownloadFilename, getReadingStats } from "./popup-utils";

describe("popup utils", () => {
  it("builds safe markdown filenames", () => {
    expect(buildDownloadFilename("Hello: World/AI", "MD")).toBe(
      "hello_world_ai.md",
    );
  });

  it("falls back when title has no usable characters", () => {
    expect(buildDownloadFilename("!!!", "TXT")).toBe("smart_extract.txt");
  });

  it("counts words and estimated reading time", () => {
    expect(getReadingStats("satu dua tiga empat lima")).toEqual({
      words: 5,
      time: 1,
    });
  });

  it("returns zero stats for empty content", () => {
    expect(getReadingStats("   ")).toEqual({ words: 0, time: 0 });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test lib/popup-utils.test.ts`

Expected: FAIL because `lib/popup-utils.ts` does not exist.

**Step 3: Write minimal implementation**

Create `lib/popup-utils.ts`:

```ts
import type { OutputFormat } from "./types";

export function getReadingStats(text: string): { words: number; time: number } {
  const trimmed = text.trim();
  if (!trimmed) return { words: 0, time: 0 };

  const words = trimmed.split(/\s+/).length;
  return { words, time: Math.max(1, Math.ceil(words / 200)) };
}

export function buildDownloadFilename(
  title: string,
  format: OutputFormat,
): string {
  const base = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);

  return `${base || "smart_extract"}.${format.toLowerCase()}`;
}
```

**Step 4: Run test to verify it passes**

Run: `bun test lib/popup-utils.test.ts`

Expected: PASS.

**Step 5: Commit**

Only commit if user asks for commits.

---

### Task 2: Use popup helpers in the popup

**Files:**

- Modify: `entrypoints/popup/App.tsx:1-1546`
- Modify: `lib/popup-utils.ts`
- Test: `lib/popup-utils.test.ts`

**Step 1: Update imports**

In `entrypoints/popup/App.tsx`, add:

```ts
import { buildDownloadFilename, getReadingStats } from "@/lib/popup-utils";
```

**Step 2: Replace inline stats calculation**

Replace the `stats` `useMemo` body around `entrypoints/popup/App.tsx:622-629` with:

```ts
const stats = useMemo(() => {
  return getReadingStats(extractedData?.textContent ?? "");
}, [extractedData]);
```

**Step 3: Replace filename sanitizing**

Replace this line around `entrypoints/popup/App.tsx:837`:

```ts
a.download = `${extractedData.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.${format.toLowerCase()}`;
```

with:

```ts
a.download = buildDownloadFilename(extractedData.title, format);
```

**Step 4: Run checks**

Run: `bun test lib/popup-utils.test.ts && bun run typecheck`

Expected: PASS.

---

### Task 3: Make popup sizing responsive and less cramped

**Files:**

- Modify: `entrypoints/popup/App.css:13-22`
- Modify: `entrypoints/popup/App.tsx:842,1267,1317,1483-1486`

**Step 1: Update popup shell CSS**

Change `entrypoints/popup/App.css` body block to:

```css
body {
  width: min(460px, 100vw);
  min-width: 360px;
  min-height: 520px;
  max-height: 680px;
  margin: 0;
  font-family:
    Inter,
    system-ui,
    -apple-system,
    sans-serif;
}

#root {
  min-height: 520px;
}
```

**Step 2: Replace fixed min-width classes**

In `entrypoints/popup/App.tsx`, replace both root class fragments:

```tsx
min-w-[420px]
```

with:

```tsx
w-full min-w-0
```

**Step 3: Improve content height behavior**

Replace main content class around `entrypoints/popup/App.tsx:1317`:

```tsx
className = "flex-1 p-5 overflow-y-auto min-h-[440px]";
```

with:

```tsx
className = "flex-1 p-4 sm:p-5 overflow-y-auto min-h-[420px]";
```

Replace preview textarea height around `entrypoints/popup/App.tsx:1485`:

```tsx
h - 80;
```

with:

```tsx
h-[min(20rem,42vh)] min-h-56
```

**Step 4: Run formatting and typecheck**

Run: `bun run fmt && bun run typecheck`

Expected: PASS.

---

### Task 4: Improve primary empty-state actions and accessibility

**Files:**

- Modify: `entrypoints/popup/App.tsx:1318-1352`

**Step 1: Disable action buttons while loading**

Add `disabled={loading}` to the Full Page, Picker, and Selection buttons in the empty state.

**Step 2: Add clearer Indonesian labels**

Change empty state copy:

```tsx
Instant Extraction
Professional tool to extract and process web content with AI.
```

to:

```tsx
Ekstrak Konten Sekali Klik
Ambil artikel, pilihan teks, atau bagian halaman lalu kirim ke AI favoritmu.
```

Change button labels:

```tsx
Full Page
Picker
Selection
```

to:

```tsx
Ekstrak Halaman
Pilih Bagian
Teks Dipilih
```

**Step 3: Add titles and aria-labels**

Add to the buttons:

```tsx
title="Ekstrak seluruh halaman"
aria-label="Ekstrak seluruh halaman aktif"
```

```tsx
title="Pilih bagian halaman secara visual"
aria-label="Pilih bagian halaman secara visual"
```

```tsx
title="Ekstrak teks yang sedang dipilih"
aria-label="Ekstrak teks yang sedang dipilih"
```

Use accurate wording without adding extra behavior.

**Step 4: Run checks**

Run: `bun run typecheck && bun run lint`

Expected: PASS.

---

### Task 5: Add result action bar that is visible without hover

**Files:**

- Modify: `entrypoints/popup/App.tsx:1481-1519`

**Step 1: Keep floating actions visible on touch/small screens**

Replace the action container class around `entrypoints/popup/App.tsx:1492`:

```tsx
className =
  "absolute top-4 right-4 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0";
```

with:

```tsx
className =
  "absolute top-4 right-4 flex flex-col gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all duration-300 sm:translate-x-2 sm:group-hover:translate-x-0";
```

**Step 2: Add a compact helper line above preview**

Before the preview textarea, add:

```tsx
<div className="mb-2 flex items-center justify-between gap-2 text-[10px] font-semibold text-slate-500">
  <span>Preview {format === "MD" ? "Markdown" : "Plain Text"}</span>
  <span>{copied ? "Tersalin" : "Copy, download, atau kirim ke AI"}</span>
</div>
```

**Step 3: Run checks**

Run: `bun run typecheck && bun run lint`

Expected: PASS.

---

### Task 6: Add extraction cache controls in settings

**Files:**

- Modify: `entrypoints/popup/App.tsx:842-1262`
- Test manually: popup settings screen

**Step 1: Add a clear cache handler**

Near `handleClearHistory`, add:

```ts
const handleClearExtractionCache = () => {
  setExtractionCache({});
  setServedFromCache(false);
};
```

**Step 2: Add settings UI section**

In the settings main area, after AI Configuration section, add:

```tsx
<section className="bg-white/70 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
  <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
    <Database className="w-4 h-4" />
    <h2 className="text-xs font-bold uppercase tracking-wider">
      Cache Ekstraksi
    </h2>
  </div>
  <p className="text-[10px] text-slate-500 leading-relaxed">
    Cache mempercepat ekstraksi ulang halaman yang sama. Hapus cache jika konten
    situs sudah berubah.
  </p>
  <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 px-3 py-2">
    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">
      {Object.keys(extractionCache).length} halaman tersimpan
    </span>
    <button
      type="button"
      onClick={handleClearExtractionCache}
      disabled={Object.keys(extractionCache).length === 0}
      className="px-3 py-1.5 rounded-lg bg-red-50 text-red-600 disabled:bg-slate-100 disabled:text-slate-400 text-[10px] font-bold"
    >
      Hapus Cache
    </button>
  </div>
</section>
```

**Step 3: Run checks**

Run: `bun run typecheck && bun run lint`

Expected: PASS.

---

### Task 7: Improve extractor resilience for non-article pages

**Files:**

- Modify: `lib/extractor.ts:41-70`
- Create or modify: `lib/extractor.test.ts`

**Step 1: Write failing tests**

Create `lib/extractor.test.ts` with jsdom-based tests:

```ts
import { describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { extractPageContent } from "./extractor";

describe("extractPageContent", () => {
  it("extracts readable fallback content when Readability cannot parse", async () => {
    const dom = new JSDOM(
      `<!doctype html><html><head><title>Docs Page</title></head><body><main><h1>Docs Page</h1><p>Important setup instructions for users.</p></main></body></html>`,
      {
        url: "https://example.com/docs",
      },
    );

    const result = await extractPageContent(
      dom.window.document,
      "https://example.com/docs",
    );

    expect(result?.title).toContain("Docs Page");
    expect(result?.content).toContain("Important setup instructions");
  });
});
```

**Step 2: Run test to verify current behavior**

Run: `bun test lib/extractor.test.ts`

Expected: either FAIL or expose current fallback weakness.

**Step 3: Add fallback extraction**

In `lib/extractor.ts`, after `const article = reader.parse();`, replace:

```ts
if (!article) return null;

title = article.title || "";
cleanHtml = DOMPurify.sanitize(article.content || "");
textContent = article.textContent || "";
siteName = article.siteName || siteName;
byline = article.byline || "";
excerpt = article.excerpt || "";
```

with:

```ts
if (article) {
  title = article.title || "";
  cleanHtml = DOMPurify.sanitize(article.content || "");
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
  cleanHtml = DOMPurify.sanitize(fallbackRoot.innerHTML || "");
  textContent = fallbackRoot.textContent || "";
}

if (!textContent.trim()) return null;
```

**Step 4: Run tests**

Run: `bun test lib/extractor.test.ts lib/extraction-cache.test.ts lib/history-utils.test.ts lib/ai-prompts.test.ts`

Expected: PASS.

---

### Task 8: Final quality gate and manual extension check

**Files:**

- No source changes unless checks reveal issues.

**Step 1: Run full automated checks**

Run: `bun run check`

Expected: PASS.

**Step 2: Build extension**

Run: `bun run build`

Expected: PASS and WXT build output created.

**Step 3: Manual UI check**

Run: `bun run dev`

Then load the extension in the browser via the WXT dev flow and verify:

1. Popup opens without horizontal overflow.
2. Empty state shows Indonesian labels clearly.
3. Full-page extraction works on a normal article page.
4. Selection extraction shows a useful error if no text is selected.
5. Result preview actions are visible and usable.
6. Copy changes helper text to `Tersalin`.
7. Settings page scrolls cleanly.
8. Cache count appears and `Hapus Cache` clears it.
9. AI provider settings still save.
10. Ask AI still opens the selected provider URL.

**Step 4: Report results**

Summarize changed files, automated check results, and any manual UI checks that could not be completed.
