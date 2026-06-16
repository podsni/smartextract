# Extraction Analysis Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a non-AI extraction health analysis that scores extracted content, detects quality issues, and recommends better extraction settings.

**Architecture:** Implement analysis as pure helpers in `lib/extraction-analysis.ts` so it is deterministic and easy to test. Store the latest analysis inside `ExtractionResult` for cache/history reuse, and show a compact health panel in the popup result card. Keep recommendations local and actionable: switch mode, disable images, keep links, remove duplicates, or use manual clean tools.

**Tech Stack:** TypeScript, Bun tests, WXT, React 19, Tailwind CSS.

---

### Task 1: Add extraction analysis helper

**Files:**

- Modify: `lib/types.ts`
- Create: `lib/extraction-analysis.ts`
- Create: `lib/extraction-analysis.test.ts`

**Step 1: Write failing tests**

Create `lib/extraction-analysis.test.ts`:

```ts
import { describe, expect, it } from "bun:test";
import { analyzeExtractionQuality } from "./extraction-analysis";

describe("analyzeExtractionQuality", () => {
  it("scores rich article content as good", () => {
    const text = Array.from({ length: 260 }, (_, index) => `word${index}`).join(
      " ",
    );

    const analysis = analyzeExtractionQuality({
      content: `# Article\n\n${text}`,
      textContent: text,
      metadata: {
        title: "Good Article",
        description: "Useful description",
        author: "Author",
        publishedTime: "2026-04-29",
        canonicalUrl: "https://example.com/article",
        siteName: "Example",
      },
    });

    expect(analysis.level).toBe("good");
    expect(analysis.score).toBeGreaterThanOrEqual(80);
  });

  it("detects short and noisy content", () => {
    const analysis = analyzeExtractionQuality({
      content: "Subscribe now cookie advertisement",
      textContent: "Subscribe now cookie advertisement",
    });

    expect(analysis.level).toBe("poor");
    expect(analysis.issues).toContain("Konten terlalu pendek");
    expect(analysis.issues).toContain("Konten masih mengandung noise");
    expect(analysis.recommendations).toContain("Coba mode Clean Page");
  });

  it("detects link-heavy extraction", () => {
    const content = Array.from(
      { length: 30 },
      (_, index) => `[Link ${index}](https://example.com/${index})`,
    ).join("\n");

    const analysis = analyzeExtractionQuality({
      content,
      textContent: "Link heavy content with useful words ".repeat(20),
    });

    expect(analysis.issues).toContain("Terlalu banyak link");
    expect(analysis.recommendations).toContain("Matikan Pertahankan link");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test lib/extraction-analysis.test.ts`

Expected: FAIL because `lib/extraction-analysis.ts` does not exist.

**Step 3: Add types**

In `lib/types.ts`, add:

```ts
export type ExtractionQualityLevel = "good" | "medium" | "poor";

export interface ExtractionAnalysis {
  score: number;
  level: ExtractionQualityLevel;
  issues: string[];
  recommendations: string[];
  linkCount: number;
  imageCount: number;
  duplicateBlockCount: number;
  noiseCount: number;
}
```

Add optional field to `ExtractionResult`:

```ts
analysis?: ExtractionAnalysis;
```

**Step 4: Implement helper**

Create `lib/extraction-analysis.ts`:

```ts
import type { ExtractionAnalysis, ExtractionMetadata } from "./types";

interface AnalyzeInput {
  content: string;
  textContent: string;
  metadata?: ExtractionMetadata;
}

const NOISE_WORDS = [
  "subscribe",
  "cookie",
  "advertisement",
  "newsletter",
  "sign up",
  "share this",
];

function countMatches(text: string, pattern: RegExp): number {
  return text.match(pattern)?.length ?? 0;
}

function countDuplicateBlocks(text: string): number {
  const seen = new Set<string>();
  let duplicates = 0;

  text
    .split(/\n{2,}/)
    .map((block) => block.trim().toLowerCase().replace(/\s+/g, " "))
    .filter(Boolean)
    .forEach((block) => {
      if (seen.has(block)) duplicates += 1;
      else seen.add(block);
    });

  return duplicates;
}

export function analyzeExtractionQuality(
  input: AnalyzeInput,
): ExtractionAnalysis {
  const text = input.textContent.trim();
  const content = input.content.trim();
  const words = text ? text.split(/\s+/).length : 0;
  const linkCount = countMatches(content, /\[[^\]]+\]\([^)]+\)/g);
  const imageCount = countMatches(content, /!\[[^\]]*\]\([^)]+\)/g);
  const duplicateBlockCount = countDuplicateBlocks(text);
  const lowerText = text.toLowerCase();
  const noiseCount = NOISE_WORDS.filter((word) =>
    lowerText.includes(word),
  ).length;
  const issues: string[] = [];
  const recommendations: string[] = [];
  let score = 100;

  if (words < 80) {
    issues.push("Konten terlalu pendek");
    recommendations.push("Coba mode Raw");
    score -= 35;
  }

  if (noiseCount > 0) {
    issues.push("Konten masih mengandung noise");
    recommendations.push("Coba mode Clean Page");
    score -= Math.min(25, noiseCount * 10);
  }

  if (linkCount > Math.max(10, words / 20)) {
    issues.push("Terlalu banyak link");
    recommendations.push("Matikan Pertahankan link");
    score -= 15;
  }

  if (imageCount > 8) {
    issues.push("Terlalu banyak gambar");
    recommendations.push("Matikan Sertakan gambar");
    score -= 10;
  }

  if (duplicateBlockCount > 0) {
    issues.push("Ada blok teks duplikat");
    recommendations.push("Aktifkan Hapus duplikat");
    score -= Math.min(20, duplicateBlockCount * 8);
  }

  if (!input.metadata?.description && !input.metadata?.author) {
    issues.push("Metadata kurang lengkap");
    score -= 5;
  }

  const normalizedScore = Math.max(0, Math.min(100, score));
  const level =
    normalizedScore >= 80 ? "good" : normalizedScore >= 50 ? "medium" : "poor";

  return {
    score: normalizedScore,
    level,
    issues,
    recommendations: Array.from(new Set(recommendations)),
    linkCount,
    imageCount,
    duplicateBlockCount,
    noiseCount,
  };
}
```

**Step 5: Run tests**

Run: `bun test lib/extraction-analysis.test.ts`

Expected: PASS.

---

### Task 2: Attach analysis to extraction results

**Files:**

- Modify: `lib/extractor.ts`
- Modify: `lib/extractor.test.ts`
- Test: `lib/extraction-analysis.test.ts`

**Step 1: Add failing test**

Extend `lib/extractor.test.ts`:

```ts
it("attaches quality analysis to extraction results", async () => {
  const dom = new JSDOM(
    `<!doctype html><html><head><title>Analysis</title></head><body><main><p>Subscribe now cookie advertisement</p></main></body></html>`,
    { url: "https://example.com/analysis" },
  );

  const result = await extractPageContent(
    dom.window.document,
    "https://example.com/analysis",
    false,
    undefined,
    { mode: "raw" },
  );

  expect(result?.analysis?.level).toBe("poor");
  expect(result?.analysis?.issues).toContain("Konten masih mengandung noise");
});
```

**Step 2: Run test to verify it fails**

Run: `bun test lib/extractor.test.ts`

Expected: FAIL because `analysis` is undefined.

**Step 3: Wire helper into extractor**

In `lib/extractor.ts`, import:

```ts
import { analyzeExtractionQuality } from "./extraction-analysis";
```

Before return, compute:

```ts
const analysis = analyzeExtractionQuality({
  content: finalMd,
  textContent: finalTxt,
  metadata: extractionOptions.includeMetadata ? metadata : undefined,
});
```

Add to returned object:

```ts
analysis,
```

**Step 4: Run tests**

Run: `bun test lib/extractor.test.ts lib/extraction-analysis.test.ts`

Expected: PASS.

---

### Task 3: Preserve analysis through history restore

**Files:**

- Modify: `lib/types.ts`
- Modify: `lib/history-utils.ts`
- Modify: `lib/history-utils.test.ts`
- Modify: `entrypoints/popup/App.tsx`

**Step 1: Add failing history test**

Extend `lib/history-utils.test.ts` with an extraction result containing `analysis`, then assert `createHistoryEntry(...).analysis` equals it.

**Step 2: Run test to verify it fails**

Run: `bun test lib/history-utils.test.ts`

Expected: FAIL because `HistoryEntry` does not store analysis.

**Step 3: Add history field**

In `lib/types.ts`, add to `HistoryEntry`:

```ts
analysis?: ExtractionAnalysis;
metadata?: ExtractionMetadata;
```

In `lib/history-utils.ts`, add fields in `createHistoryEntry`:

```ts
analysis: data.analysis,
metadata: data.metadata,
```

In `entrypoints/popup/App.tsx`, update `handleRestoreHistory` result object to include:

```ts
analysis: entry.analysis,
metadata: entry.metadata,
```

**Step 4: Run tests**

Run: `bun test lib/history-utils.test.ts`

Expected: PASS.

---

### Task 4: Add Extraction Health panel to popup

**Files:**

- Modify: `entrypoints/popup/App.tsx`

**Step 1: Add display helpers**

Near `stats`, add:

```ts
const analysisTheme = useMemo(() => {
  const level = extractedData?.analysis?.level;
  if (level === "good")
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300";
  if (level === "medium")
    return "border-amber-200 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300";
  return "border-red-200 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300";
}, [extractedData?.analysis?.level]);
```

**Step 2: Add UI below metadata card**

After the metadata card in result view, render when `extractedData.analysis` exists:

```tsx
{
  extractedData.analysis && (
    <section className={`rounded-2xl border p-3 ${analysisTheme}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider">
            Extraction Health
          </p>
          <p className="mt-1 text-xs font-bold capitalize">
            {extractedData.analysis.level} • {extractedData.analysis.score}/100
          </p>
        </div>
        <div className="text-right text-[10px] font-semibold opacity-80">
          <p>{extractedData.analysis.linkCount} links</p>
          <p>{extractedData.analysis.imageCount} images</p>
        </div>
      </div>
      {extractedData.analysis.issues.length > 0 && (
        <div className="mt-3 space-y-1 text-[10px] font-semibold">
          {extractedData.analysis.issues.slice(0, 3).map((issue) => (
            <p key={issue}>• {issue}</p>
          ))}
        </div>
      )}
      {extractedData.analysis.recommendations.length > 0 && (
        <div className="mt-3 rounded-xl bg-white/60 px-3 py-2 text-[10px] font-bold text-slate-700 dark:bg-slate-950/30 dark:text-slate-200">
          Saran:{" "}
          {extractedData.analysis.recommendations.slice(0, 2).join(" · ")}
        </div>
      )}
    </section>
  );
}
```

**Step 3: Run checks**

Run: `bun run typecheck && bun run lint`

Expected: PASS.

---

### Task 5: Final verification

**Files:**

- No source changes unless checks fail.

**Step 1: Run focused tests**

Run: `bun test lib/extraction-analysis.test.ts lib/extractor.test.ts lib/history-utils.test.ts`

Expected: PASS.

**Step 2: Run full checks**

Run: `bun run check`

Expected: PASS.

**Step 3: Build extension**

Run: `bun run build`

Expected: PASS.

**Step 4: Manual check note**

If browser UI is not manually opened, report that manual UI verification was not completed.
