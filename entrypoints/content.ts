import { extractPageContent } from "@/lib/extractor";
import { onMessage } from "@/lib/messaging";

export default defineContentScript({
  matches: ["<all_urls>"],
  async main(ctx) {
    const HIGHLIGHT_CLASS = "smart-extract-pro-highlight";
    const TOAST_ID = "smart-extract-toast";

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
        box-shadow: 0 10px 15px -3px rgba(0,0,0,0.3);
        z-index: 10000000;
        display: flex;
        align-items: center;
        gap: 10px;
        transform: translateY(100px);
        transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
      }
      #${TOAST_ID}.show { transform: translateY(0); }
      #${TOAST_ID} .icon { color: #10b981; font-weight: bold; }
    `;
    document.head.appendChild(style);

    const showToast = (message: string) => {
      let toast = document.getElementById(TOAST_ID);
      if (!toast) {
        toast = document.createElement("div");
        toast.id = TOAST_ID;
        document.body.appendChild(toast);
      }
      toast.innerHTML = `<span class="icon">✓</span> ${message}`;
      toast.classList.add("show");
      setTimeout(() => toast?.classList.remove("show"), 3000);
    };

    // Full Page Extraction
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

    // Selection Extraction
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

    // Visual Inspector
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
            showToast(`Copied: ${result.title.substring(0, 30)}...`);
          }
        } catch (err) {
          console.error("Extraction error:", err);
          showToast("Failed to extract element.");
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
      };

      document.addEventListener("mousemove", onMouseMove, true);
      document.addEventListener("click", onClick, true);
      document.addEventListener("keydown", onKeyDown, true);

      showToast("Visual Picker Active (ESC to cancel)");
    });

    ctx.onInvalidated(() => {
      style.remove();
      document.getElementById(TOAST_ID)?.remove();
    });
  },
});
