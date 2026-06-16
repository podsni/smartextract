# Context Menu Extraction - Design

**Date:** 2026-06-16

## Summary

Add right-click context menu for content extraction with auto-copy + toast + history saving.

## Menu Items

1. **📄 Extract Full Page** — always visible (`contexts: ["page", "frame"]`)
2. **✂️ Extract Selection** — only when text selected (`contexts: ["selection"]`)
3. **🎯 Extract This Element** — on any element (`contexts: ["all"]`)

## Flow

```
User right-click → Context Menu Item
                       ↓
           Background Script (contextMenus.onClicked)
                       ↓
           sendMessage('contextMenuExtract', {type}, tab.id)
                       ↓
           Content Script → extractPageContent()
                       ↓
           Result back to Background
                       ↓
     Background: 1) clipboard.writeText(result.content)
                 2) saveToHistory(result, history-db.ts)
                 3) sendMessage('showToast', msg, tab.id)
                       ↓
           Content Script → showToast()
```

## Changes

| File                        | Change                                              |
| --------------------------- | --------------------------------------------------- |
| `wxt.config.ts`             | Add `contextMenus`, `clipboardWrite` permissions    |
| `lib/messaging.ts`          | Add `contextMenuExtract`, `showToast` message types |
| `entrypoints/background.ts` | Full rewrite — menu setup + click handler           |
| `entrypoints/content.ts`    | Add `contextMenuExtract` + `showToast` handlers     |

## Error Handling

- Extraction fails → toast "❌ Failed to extract"
- Clipboard fails → toast "⚠️ Saved to history (clipboard failed)"
- Tab closed → graceful skip

## UX

- Toast colors: green success, red error, amber warning
- Loading toast if extraction >500ms
- Result saved to IndexedDB history always (even if clipboard fails)
