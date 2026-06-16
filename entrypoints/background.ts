import { sendMessage } from "@/lib/messaging";
import { loadHistoryFromDb, saveHistoryToDb } from "@/lib/history-db";
import { createHistoryEntry, insertHistoryEntry } from "@/lib/history-utils";
import type { ExtractionResult } from "@/lib/types";

const MENU_FULL = "smartextract-full";
const MENU_SELECTION = "smartextract-selection";
const MENU_ELEMENT = "smartextract-element";

function setupContextMenus() {
  browser.contextMenus.removeAll(() => {
    browser.contextMenus.create({
      id: MENU_FULL,
      title: "📄 Extract Full Page",
      contexts: ["page", "frame"],
    });

    browser.contextMenus.create({
      id: MENU_SELECTION,
      title: "✂️ Extract Selection",
      contexts: ["selection"],
    });

    browser.contextMenus.create({
      id: MENU_ELEMENT,
      title: "🎯 Extract This Element",
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

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export default defineBackground(() => {
  setupContextMenus();

  // Re-setup menus on install/update to avoid stale items
  browser.runtime.onInstalled.addListener(() => {
    setupContextMenus();
  });

  browser.contextMenus.onClicked.addListener(async (info, tab) => {
    if (!tab?.id) return;
    const tabId = tab.id;

    // Determine extraction type from menu item
    let type: "full" | "selection" | "element" = "full";
    if (info.menuItemId === MENU_SELECTION) type = "selection";
    else if (info.menuItemId === MENU_ELEMENT) type = "element";

    // Show loading toast for potentially slow extractions
    let loadingTimer: ReturnType<typeof setTimeout> | null = setTimeout(
      async () => {
        try {
          await sendMessage("showToast", "⏳ Extracting...", tabId);
        } catch {
          // tab may not have content script yet
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

      // Try to copy to clipboard
      const copied = await copyToClipboard(result.content);

      // Always save to history regardless of clipboard result
      await saveResultToHistory(result);

      const shortTitle = result.title
        ? result.title.substring(0, 35) + (result.title.length > 35 ? "…" : "")
        : "Content";

      if (copied) {
        await sendMessage("showToast", `✓ Copied: ${shortTitle}`, tabId);
      } else {
        await sendMessage(
          "showToast",
          `⚠️ Saved to history (clipboard failed)`,
          tabId,
        );
      }
    } catch (err) {
      clearLoadingTimer();
      console.error("[SmartExtract] Context menu extraction error:", err);
      try {
        await sendMessage("showToast", "❌ Extraction failed", tabId);
      } catch {
        // toast send can also fail on restricted pages
      }
    }
  });
});
