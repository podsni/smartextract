import { sendMessage } from "@/lib/messaging";
import { loadHistoryFromDb, saveHistoryToDb } from "@/lib/history-db";
import { createHistoryEntry, insertHistoryEntry } from "@/lib/history-utils";
import type { ExtractionMode, ExtractionResult } from "@/lib/types";

// ─── Menu ID constants ────────────────────────────────────────────────────────
// Pattern: se-<type>-<mode>-<action>-<format>
// type:   page | sel | elem
// mode:   article | full | raw (raw = "clean" mode, minimal processing)
// action: copy | dl
// format: md | txt

const P = "smartextract"; // root parent

// Sub-parents (one per extraction scope)
const P_ARTICLE = `${P}-article`;
const P_FULL = `${P}-full`;
const P_SEL = `${P}-sel`;
const P_ELEM = `${P}-elem`;

type MenuAction = "copy" | "dl";
type MenuFormat = "md" | "txt";
type CtxType =
  | "all"
  | "page"
  | "frame"
  | "selection"
  | "link"
  | "editable"
  | "image"
  | "video"
  | "audio";

function menuId(
  parent: string,
  action: MenuAction,
  format: MenuFormat,
): string {
  return `${parent}-${action}-${format}`;
}

// All leaf menu IDs — used to route clicks
const ALL_ITEMS: Record<
  string,
  {
    type: "full" | "selection" | "element";
    mode: ExtractionMode;
    action: MenuAction;
    format: MenuFormat;
  }
> = {};

function reg(
  parentId: string,
  type: "full" | "selection" | "element",
  mode: ExtractionMode,
  action: MenuAction,
  format: MenuFormat,
  contexts: [CtxType, ...CtxType[]],
) {
  const id = menuId(parentId, action, format);
  const verb = action === "copy" ? "Copy" : "Download";
  const fmt = format === "md" ? "Markdown (.md)" : "Plain Text (.txt)";
  browser.contextMenus.create({
    id,
    parentId,
    title: `${action === "copy" ? "📋" : "⬇️"} ${verb} as ${fmt}`,
    contexts: contexts as unknown as Parameters<
      typeof browser.contextMenus.create
    >[0]["contexts"],
  });
  ALL_ITEMS[id] = { type, mode, action, format };
}

function setupContextMenus() {
  browser.contextMenus.removeAll(() => {
    // ── Root ────────────────────────────────────────────────────────────────
    browser.contextMenus.create({
      id: P,
      title: "⚡ SmartExtract",
      contexts: ["all"],
    });

    // ── Article Mode ────────────────────────────────────────────────────────
    browser.contextMenus.create({
      id: P_ARTICLE,
      parentId: P,
      title: "📰 Article Mode",
      contexts: ["page", "frame", "selection"],
    });
    reg(P_ARTICLE, "full", "article", "copy", "md", [
      "page",
      "frame",
      "selection",
    ]);
    reg(P_ARTICLE, "full", "article", "copy", "txt", [
      "page",
      "frame",
      "selection",
    ]);
    reg(P_ARTICLE, "full", "article", "dl", "md", [
      "page",
      "frame",
      "selection",
    ]);
    reg(P_ARTICLE, "full", "article", "dl", "txt", [
      "page",
      "frame",
      "selection",
    ]);

    // ── Full Page ────────────────────────────────────────────────────────────
    browser.contextMenus.create({
      id: P_FULL,
      parentId: P,
      title: "📄 Full Page",
      contexts: ["page", "frame"],
    });
    reg(P_FULL, "full", "clean", "copy", "md", ["page", "frame"]);
    reg(P_FULL, "full", "clean", "copy", "txt", ["page", "frame"]);
    reg(P_FULL, "full", "clean", "dl", "md", ["page", "frame"]);
    reg(P_FULL, "full", "clean", "dl", "txt", ["page", "frame"]);

    // ── Selection ────────────────────────────────────────────────────────────
    browser.contextMenus.create({
      id: P_SEL,
      parentId: P,
      title: "✂️ Selection",
      contexts: ["selection"],
    });
    reg(P_SEL, "selection", "clean", "copy", "md", ["selection"]);
    reg(P_SEL, "selection", "clean", "copy", "txt", ["selection"]);
    reg(P_SEL, "selection", "clean", "dl", "md", ["selection"]);
    reg(P_SEL, "selection", "clean", "dl", "txt", ["selection"]);

    // ── This Element ─────────────────────────────────────────────────────────
    browser.contextMenus.create({
      id: P_ELEM,
      parentId: P,
      title: "🎯 This Element",
      contexts: ["all"],
    });
    reg(P_ELEM, "element", "clean", "copy", "md", ["all"]);
    reg(P_ELEM, "element", "clean", "copy", "txt", ["all"]);
    reg(P_ELEM, "element", "clean", "dl", "md", ["all"]);
    reg(P_ELEM, "element", "clean", "dl", "txt", ["all"]);
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
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "")
    .replace(/\s+/g, "-")
    .substring(0, 60)
    .replace(/-+$/, "");
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

    const item = ALL_ITEMS[info.menuItemId as string];
    if (!item) return; // clicked a sub-parent label — ignore

    const { type, mode, action, format } = item;

    // Loading toast after 500 ms for slow pages
    let loadingTimer: ReturnType<typeof setTimeout> | null = setTimeout(
      async () => {
        try {
          await sendMessage("showToast", "⏳ Extracting…", tabId);
        } catch {
          /* restricted page */
        }
        loadingTimer = null;
      },
      500,
    );
    const clearTimer = () => {
      if (loadingTimer !== null) {
        clearTimeout(loadingTimer);
        loadingTimer = null;
      }
    };

    try {
      const result = await sendMessage(
        "contextMenuExtract",
        { type, mode },
        tabId,
      );
      clearTimer();

      if (!result) {
        await sendMessage("showToast", "❌ Nothing to extract", tabId);
        return;
      }

      await saveResultToHistory(result);

      const content = format === "md" ? result.content : result.textContent;
      const ext = format === "md" ? "md" : "txt";
      const shortTitle =
        result.title.length > 35
          ? result.title.substring(0, 35) + "…"
          : result.title;

      if (action === "copy") {
        // Copy via content script (background can't access clipboard in MV3)
        const ok = await sendMessage("triggerCopy", content, tabId);
        await sendMessage(
          "showToast",
          ok ? `✓ Copied: ${shortTitle}` : `⚠️ Clipboard failed — try again`,
          tabId,
        );
      } else {
        // Download
        await sendMessage(
          "triggerDownload",
          {
            filename: safeFilename(result.title, ext),
            content,
            mimeType:
              format === "md"
                ? "text/markdown;charset=utf-8"
                : "text/plain;charset=utf-8",
          },
          tabId,
        );
        await sendMessage(
          "showToast",
          `✓ Downloaded: ${shortTitle}.${ext}`,
          tabId,
        );
      }
    } catch (err) {
      clearTimer();
      console.error("[SmartExtract] Context menu error:", err);
      try {
        await sendMessage("showToast", "❌ Extraction failed", tabId);
      } catch {
        /* restricted page */
      }
    }
  });
});
