import { extractPageContent } from "@/lib/extractor";
import { onMessage } from "@/lib/messaging";

export default defineContentScript({
  matches: ["<all_urls>"],
  async main(ctx) {
    const HIGHLIGHT_CLASS = "smart-extract-pro-highlight";
    const TOAST_ID = "smart-extract-toast";

    // Track the element the user last right-clicked for "Extract This Element"
    let lastRightClickTarget: HTMLElement | null = null;

    const style = document.createElement("style");
    style.textContent = `
      .${HIGHLIGHT_CLASS} {
        outline: 2px solid #3b82f6 !important;
        outline-offset: 2px !important;
        background-color: rgba(59, 130, 246, 0.15) !important;
        cursor: cell !important;
        transition: all 0.1s ease-out !important;
        z-index: 9999999 !important;
      }
      #${TOAST_ID} {
        position: fixed;
        bottom: 24px;
        right: 24px;
        background: #1e293b;
        color: white;
        padding: 12px 20px;
        border-radius: 12px;
        font-family: system-ui, sans-serif;
        font-size: 14px;
        font-weight: 500;
        line-height: 1.4;
        box-shadow: 0 10px 15px -3px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05);
        z-index: 2147483647;
        display: flex;
        align-items: center;
        gap: 10px;
        max-width: 380px;
        transform: translateY(120px);
        opacity: 0;
        transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1),
                    opacity 0.25s ease;
      }
      #${TOAST_ID}.show {
        transform: translateY(0);
        opacity: 1;
      }
      #${TOAST_ID} .se-icon { font-weight: bold; flex-shrink: 0; }
      #${TOAST_ID}.toast-success .se-icon { color: #10b981; }
      #${TOAST_ID}.toast-error   .se-icon { color: #ef4444; }
      #${TOAST_ID}.toast-warning .se-icon { color: #f59e0b; }
      #${TOAST_ID}.toast-loading .se-icon { color: #60a5fa; }
    `;
    document.head.appendChild(style);

    // Track right-clicked element for "Extract This Element" menu item
    document.addEventListener(
      "contextmenu",
      (e) => {
        lastRightClickTarget = e.target as HTMLElement;
      },
      true,
    );

    let toastTimer: ReturnType<typeof setTimeout> | null = null;

    const showToast = (
      message: string,
      type: "success" | "error" | "warning" | "loading" = "success",
      duration = 3500,
    ) => {
      // Clear any running dismiss timer
      if (toastTimer !== null) {
        clearTimeout(toastTimer);
        toastTimer = null;
      }

      let toast = document.getElementById(TOAST_ID);
      if (!toast) {
        toast = document.createElement("div");
        toast.id = TOAST_ID;
        document.body.appendChild(toast);
      }

      const icons: Record<string, string> = {
        success: "✓",
        error: "✕",
        warning: "⚠",
        loading: "⏳",
      };

      // Set class BEFORE adding show so transition fires correctly
      toast.className = `toast-${type}`;
      toast.innerHTML = `<span class="se-icon">${icons[type]}</span><span>${message}</span>`;

      // Force reflow so the transition triggers after class swap
      void toast.offsetWidth;
      toast.classList.add("show");

      if (duration > 0) {
        toastTimer = setTimeout(() => {
          toast?.classList.remove("show");
          toastTimer = null;
        }, duration);
      }
    };

    // Download a file from content script — only place we have DOM access
    const downloadFile = (
      filename: string,
      content: string,
      mimeType: string,
    ) => {
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      // Clean up after brief delay so browser registers the click
      setTimeout(() => {
        URL.revokeObjectURL(url);
        a.remove();
      }, 1000);
    };

    // Full Page Extraction (from popup)
    onMessage("extractContent", async (request) => {
      if (ctx.isInvalid) return null;
      return await extractPageContent(
        document,
        window.location.href,
        false,
        request?.data?.template,
        request?.data?.options,
      );
    });

    // Selection Extraction (from popup)
    onMessage("extractSelection", async (request) => {
      if (ctx.isInvalid) return null;
      const selection = window.getSelection();
      if (
        !selection ||
        selection.rangeCount === 0 ||
        selection.toString().trim() === ""
      ) {
        throw new Error("Nothing selected.");
      }
      const container = document.createElement("div");
      container.appendChild(selection.getRangeAt(0).cloneContents());
      return await extractPageContent(
        container,
        window.location.href,
        true,
        request?.data?.template,
        request?.data?.options,
      );
    });

    // Context Menu Extraction — called by background, returns ExtractionResult
    onMessage("contextMenuExtract", async (request) => {
      if (ctx.isInvalid) return null;
      const { type, mode, template, options } = request.data;

      // mode from menu overrides options.mode
      const mergedOptions = { ...options, mode };

      if (type === "selection") {
        const selection = window.getSelection();
        if (!selection || selection.toString().trim() === "") return null;
        const container = document.createElement("div");
        container.appendChild(selection.getRangeAt(0).cloneContents());
        return await extractPageContent(
          container,
          window.location.href,
          true,
          template,
          mergedOptions,
        );
      }

      if (type === "element") {
        const target = lastRightClickTarget ?? document.body;
        return await extractPageContent(
          target,
          window.location.href,
          true,
          template,
          mergedOptions,
        );
      }

      // full page
      return await extractPageContent(
        document,
        window.location.href,
        false,
        template,
        mergedOptions,
      );
    });

    // Download trigger — background sends this after getting the result
    onMessage("triggerDownload", (request) => {
      if (ctx.isInvalid) return;
      const { filename, content, mimeType } = request.data;
      downloadFile(filename, content, mimeType);
    });

    // Copy trigger — background can't access clipboard in MV3, so we do it here
    onMessage("triggerCopy", async (request) => {
      if (ctx.isInvalid) return false;
      try {
        await navigator.clipboard.writeText(request.data as string);
        return true;
      } catch {
        return false;
      }
    });

    // Toast trigger from background script
    onMessage("showToast", (request) => {
      if (ctx.isInvalid) return;
      const msg = request.data as string;

      let type: "success" | "error" | "warning" | "loading" = "success";
      if (msg.startsWith("❌")) type = "error";
      else if (msg.startsWith("⚠️")) type = "warning";
      else if (msg.startsWith("⏳")) type = "loading";

      const duration = type === "loading" ? 0 : type === "error" ? 4500 : 3500;
      showToast(msg, type, duration);
    });

    // Visual Inspector (from popup)
    onMessage("startInspector", (request) => {
      if (ctx.isInvalid) return;

      let lastElement: HTMLElement | null = null;

      const onMouseMove = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target === lastElement || target.id === TOAST_ID) return;
        if (lastElement) lastElement.classList.remove(HIGHLIGHT_CLASS);
        target.classList.add(HIGHLIGHT_CLASS);
        lastElement = target;
      };

      const onClick = async (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const target = e.target as HTMLElement;
        cleanup();
        try {
          const result = await extractPageContent(
            target,
            window.location.href,
            true,
            request?.data?.template,
            request?.data?.options,
          );
          if (result) {
            await navigator.clipboard.writeText(result.content);
            await browser.storage.local.set({ lastVisualExtraction: result });
            const short =
              result.title.length > 30
                ? result.title.substring(0, 30) + "…"
                : result.title;
            showToast(`Copied: ${short}`, "success");
          }
        } catch (err) {
          console.error("[SmartExtract] Visual picker error:", err);
          showToast("Failed to extract element.", "error");
        }
      };

      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") cleanup();
      };

      const cleanup = () => {
        if (lastElement) lastElement.classList.remove(HIGHLIGHT_CLASS);
        document.removeEventListener("mousemove", onMouseMove, true);
        document.removeEventListener("click", onClick, true);
        document.removeEventListener("keydown", onKeyDown, true);
        showToast("Visual Picker cancelled", "warning", 2000);
      };

      document.addEventListener("mousemove", onMouseMove, true);
      document.addEventListener("click", onClick, true);
      document.addEventListener("keydown", onKeyDown, true);

      showToast("Visual Picker active — ESC to cancel", "loading", 0);
    });

    ctx.onInvalidated(() => {
      style.remove();
      document.getElementById(TOAST_ID)?.remove();
    });
  },
});
