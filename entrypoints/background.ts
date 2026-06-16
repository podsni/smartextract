import { sendMessage } from "@/lib/messaging";
import { loadHistoryFromDb, saveHistoryToDb } from "@/lib/history-db";
import { createHistoryEntry, insertHistoryEntry } from "@/lib/history-utils";
import type { ExtractionResult } from "@/lib/types";

// Menu IDs — parent + 6 children (md/txt × full/selection/element)
const MENU_PARENT = "smartextract";
const MENU_FULL_MD = "smartextract-full-md";
const MENU_FULL_TXT = "smartextract-full-txt";
const MENU_SELECTION_MD = "smartextract-selection-md";
const MENU_SELECTION_TXT = "smartextract-selection-txt";
const MENU_ELEMENT_MD = "smartextract-element-md";
const MENU_ELEMENT_TXT = "smartextract-element-txt";

function setupContextMenus() {
  browser.contextMenus.removeAll(() => {
    // Parent item — always visible as a grouping label
    browser.contextMenus.create({
      id: MENU_PARENT,
      title: "⚡ SmartExtract",
      contexts: ["all"],
    });

    // Full page
    browser.contextMenus.create({
      id: MENU_FULL_MD,
      parentId: MENU_PARENT,
      title: "📄 Save Page as Markdown (.md)",
      contexts: ["page", "frame"],
    });
    browser.contextMenus.create({
      id: MENU_FULL_TXT,
      parentId: MENU_PARENT,
      title: "📄 Save Page as Plain Text (.txt)",
      contexts: ["page", "frame"],
    });

    // Selection (auto-hidden by Chrome when no text selected)
    browser.contextMenus.create({
      id: MENU_SELECTION_MD,
      parentId: MENU_PARENT,
      title: "✂️ Save Selection as Markdown (.md)",
      contexts: ["selection"],
    });
    browser.contextMenus.create({
      id: MENU_SELECTION_TXT,
      parentId: MENU_PARENT,
      title: "✂️ Save Selection as Plain Text (.txt)",
      contexts: ["selection"],
    });

    // Right-clicked element
    browser.contextMenus.create({
      id: MENU_ELEMENT_MD,
      parentId: MENU_PARENT,
      title: "🎯 Save Element as Markdown (.md)",
      contexts: ["all"],
    });
    browser.contextMenus.create({
      id: MENU_ELEMENT_TXT,
      parentId: MENU_PARENT,
      title: "🎯 Save Element as Plain Text (.txt)",
      contexts: ["all"],
    });
  });
}

async function saveResultToHistory(result: ExtractionResult): Promise<void> {
  try {
    const existing = await loadHistoryFromDb();
    const entry = createHistoryEntry(result, "full", "MD");
    const updated = insertHistoryEntry(existing, entry);
    await saveHistoryToDb(updated);
  } catch (err) {
    console.error("[SmartExtract] Failed to save history:", err);
  }
}

function safeFilename(title: string, ext: string): string {
  const base = (title || "extract")
    // eslint-disable-next-line no-control-regex
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "") // strip illegal chars for filenames
    .replace(/\s+/g, "-")
    .substring(0, 60)
    .replace(/-+$/, ""); // no trailing dash
  return `${base || "extract"}.${ext}`;
}

export default defineBackground(() => {
  setupContextMenus();

  browser.runtime.onInstalled.addListener(() => {
    setupContextMenus();
  });

  browser.contextMenus.onClicked.addListener(async (info, tab) => {
    if (!tab?.id) return;
    const tabId = tab.id;

    const menuId = info.menuItemId as string;

    // Determine extraction type and output format from menu item id
    let type: "full" | "selection" | "element" = "full";
    let format: "md" | "txt" = "md";

    if (menuId === MENU_FULL_MD) {
      type = "full";
      format = "md";
    } else if (menuId === MENU_FULL_TXT) {
      type = "full";
      format = "txt";
    } else if (menuId === MENU_SELECTION_MD) {
      type = "selection";
      format = "md";
    } else if (menuId === MENU_SELECTION_TXT) {
      type = "selection";
      format = "txt";
    } else if (menuId === MENU_ELEMENT_MD) {
      type = "element";
      format = "md";
    } else if (menuId === MENU_ELEMENT_TXT) {
      type = "element";
      format = "txt";
    } else {
      return; // clicked on parent label, ignore
    }

    // Show loading toast for potentially slow pages
    let loadingTimer: ReturnType<typeof setTimeout> | null = setTimeout(
      async () => {
        try {
          await sendMessage("showToast", "⏳ Extracting…", tabId);
        } catch {
          // content script may not be ready on restricted pages
        }
        loadingTimer = null;
      },
      500,
    );

    const clearLoadingTimer = () => {
      if (loadingTimer !== null) {
        clearTimeout(loadingTimer);
        loadingTimer = null;
      }
    };

    try {
      const result = await sendMessage("contextMenuExtract", { type }, tabId);

      clearLoadingTimer();

      if (!result) {
        await sendMessage("showToast", "❌ Nothing to extract", tabId);
        return;
      }

      // Persist to history
      await saveResultToHistory(result);

      // Determine content and filename
      const content = format === "md" ? result.content : result.textContent;
      const ext = format === "md" ? "md" : "txt";
      const mimeType =
        format === "md"
          ? "text/markdown;charset=utf-8"
          : "text/plain;charset=utf-8";
      const filename = safeFilename(result.title, ext);

      // Trigger download inside content script (needs DOM access)
      await sendMessage(
        "triggerDownload",
        { filename, content, mimeType },
        tabId,
      );

      // Also copy to clipboard via content script (background can't access clipboard in MV3)
      await sendMessage("triggerCopy", content, tabId);

      const shortTitle =
        result.title.length > 35
          ? result.title.substring(0, 35) + "…"
          : result.title;

      await sendMessage(
        "showToast",
        `✓ Downloaded: ${shortTitle}.${ext}`,
        tabId,
      );
    } catch (err) {
      clearLoadingTimer();
      console.error("[SmartExtract] Context menu error:", err);
      try {
        await sendMessage("showToast", "❌ Extraction failed", tabId);
      } catch {
        // restricted page — nothing we can do
      }
    }
  });
});
