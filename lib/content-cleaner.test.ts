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
