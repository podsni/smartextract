# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**SmartExtract** is a Chrome extension built with WXT that extracts web content into clean Markdown (GFM) or Plain Text. It uses Mozilla's Readability algorithm for article extraction and Turndown for HTML-to-Markdown conversion.

## Development Commands

### Core Development

```bash
bun install              # Install dependencies
bun run dev              # Start dev mode (auto-opens Chrome with extension loaded)
bun run dev:firefox      # Dev mode for Firefox
bun run build            # Production build (output: .output/chrome-mv3/)
bun run build:firefox    # Build for Firefox
bun run zip              # Package extension for distribution
```

### Quality Gates

```bash
bun run typecheck        # Fast type-checking with tsgo
bun run lint             # Lint with oxlint
bun run lint:fix         # Auto-fix linting issues
bun run fmt              # Format code with oxfmt
bun run fmt:check        # Check formatting without changes
bun run check            # Run all quality checks (typecheck + lint + fmt:check)
bun run fix              # Auto-fix lint and format issues
```

### Testing

```bash
bun test                 # Run all tests (uses bun:test)
bun test lib/extractor.test.ts  # Run single test file
```

## Architecture

### Entry Points

**Content Scripts** (`entrypoints/*.content.ts`):

- `content.ts` - Main content script injected into `<all_urls>`. Handles:
  - Full page extraction via `extractContent` message
  - Selection extraction via `extractSelection` message
  - Visual element picker via `startInspector` message (interactive hover + click)
- `claude.content.ts`, `chatgpt.content.ts`, `gemini.content.ts`, `grok.content.ts`, `aistudio.content.ts` - AI provider-specific content scripts for file upload integration

**Popup** (`entrypoints/popup/`):

- `App.tsx` - Main popup UI (70KB+, complex state management)
- React 19 + Tailwind CSS v4 + Lucide icons
- Manages extraction modes, history, settings, AI upload workflow

**Background** (`entrypoints/background.ts`):

- Minimal background service worker

### Core Libraries (`lib/`)

**Extraction Pipeline**:

1. `extractor.ts` - Core extraction engine
   - `extractPageContent()` - Main function handling full page, selection, and picker modes
   - Uses Readability for article mode, falls back to `<main>`, `<article>`, or `<body>`
   - Applies custom templates via `applyTemplate()`
   - Three extraction modes: `article` (Readability), `clean` (cleaned HTML), `raw` (minimal processing)
2. `content-cleaner.ts` - Pre-processing utilities
   - `cleanDocumentForExtraction()` - Removes scripts, ads, nav elements
   - `removeDuplicateTextBlocks()` - Deduplication logic

3. `extraction-analysis.ts` - Post-extraction quality scoring
   - `analyzeExtractionQuality()` - Returns score, level (good/medium/poor), issues, recommendations
   - Detects noise patterns (ads, cookies, subscribe prompts)

4. `extraction-options.ts` - Extraction configuration
   - `ExtractionOptions` interface: mode, includeImages, includeLinks, includeMetadata, removeDuplicates
   - `normalizeExtractionOptions()` - Merges with defaults

5. `metadata.ts` - OpenGraph/meta tag extraction
   - `extractPageMetadata()` - Returns title, description, author, publishedTime, canonicalUrl, siteName

**Supporting Infrastructure**:

- `messaging.ts` - Type-safe extension messaging via `@webext-core/messaging`
  - Schema: `extractContent`, `extractSelection`, `startInspector`
- `types.ts` - Central type definitions and constants
  - `ExtractionResult`, `ExtractionOptions`, `HistoryEntry`, `UserSettings`
  - `DEFAULT_TEMPLATE`, `AI_PROVIDER_URLS`
- `history-db.ts` - IndexedDB wrapper for extraction history
- `history-utils.ts`, `popup-utils.ts` - UI helper functions
- `ai-prompts.ts` - AI provider prompt generation
- `local-state.ts` - Local storage utilities
- `extraction-cache.ts` - Caching layer for repeated extractions

### Key Dependencies

- **@mozilla/readability** - Article extraction (Firefox algorithm)
- **turndown** + **turndown-plugin-gfm** - HTML → Markdown conversion with GFM support
- **dompurify** - XSS protection via HTML sanitization
- **@webext-core/messaging** - Type-safe cross-context messaging
- **WXT** - Extension framework with Vite integration
- **Bun** - Runtime and package manager

## Code Conventions

- **Language**: TypeScript (type annotations required, no TSX in lib/)
- **Testing**: Bun's built-in test runner with JSDOM for DOM simulation
- **Formatting**: oxfmt (auto-run via lint-staged on commit)
- **Linting**: oxlint (stricter than ESLint, faster)
- **UI Comments**: Mix of English and Indonesian (preserve existing language per file)

## Extraction Flow

1. User triggers extraction (full page / selection / visual picker) from popup
2. Popup sends message to content script via `@webext-core/messaging`
3. Content script:
   - Clones document/element
   - Runs `cleanDocumentForExtraction()` if not raw mode
   - Applies Readability (article mode) or uses fallback selector
   - Sanitizes HTML with DOMPurify
   - Converts to Markdown with Turndown + GFM plugin
   - Applies custom template (full page only; selections get raw content)
   - Analyzes quality with `analyzeExtractionQuality()`
4. Result returned to popup
5. Popup stores in IndexedDB history and updates UI

## Visual Picker Implementation

The visual picker (`startInspector` in `content.ts`) works by:

- Adding `mousemove` listener that highlights elements with blue outline
- On click: extracts that element, copies to clipboard, shows toast notification
- ESC key cancels picker mode
- Uses high z-index (9999999+) to ensure visibility
- Stores last extraction in `browser.storage.local`

## AI Provider Integration

AI provider content scripts inject file upload capabilities into:

- ChatGPT (chatgpt.com)
- Claude (claude.ai)
- Gemini (gemini.google.com)
- Grok (grok.com)
- AI Studio (aistudio.google.com)

Each detects upload UI elements and automates file attachment workflow.

## Testing Strategy

Tests use JSDOM to simulate browser DOM without actual browser instance:

```typescript
const dom = new JSDOM(`<html>...</html>`, { url: "https://example.com" });
const result = await extractPageContent(
  dom.window.document,
  "https://example.com",
);
```

Test coverage focuses on:

- Readability fallback scenarios
- Extraction mode variations (article/clean/raw)
- Option flags (includeImages, includeLinks, removeDuplicates)
- Quality analysis scoring
- Edge cases (empty content, malformed HTML)

## Build Output

- Development: `.wxt/` (temp build artifacts)
- Production: `.output/chrome-mv3/` (ready to load in Chrome)
- Manifest V3 only (no V2 support)

## Pre-commit Hooks

Husky + lint-staged automatically runs on commit:

- `oxlint --fix` on JS/TS files
- `oxfmt` on all supported files

## Performance Notes

- **Fast tooling**: tsgo (TypeScript native), oxlint (Rust-based), oxfmt (Rust-based), Bun (Zig/C++ runtime)
- **No hot reload lag**: WXT + Vite provide instant updates
- **Readability clones document**: Prevents page mutation but costs memory
- **Template application**: Only on full page extraction (selections skip for speed)
