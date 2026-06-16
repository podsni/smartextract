import { describe, expect, it } from "bun:test";
import {
  DEFAULT_EXTRACTION_OPTIONS,
  normalizeExtractionOptions,
} from "./extraction-options";

describe("extraction options", () => {
  it("keeps defaults when no options are provided", () => {
    expect(normalizeExtractionOptions()).toEqual(DEFAULT_EXTRACTION_OPTIONS);
  });

  it("accepts a supported mode", () => {
    expect(normalizeExtractionOptions({ mode: "clean" }).mode).toBe("clean");
  });

  it("falls back from invalid mode", () => {
    expect(normalizeExtractionOptions({ mode: "bad" as any }).mode).toBe(
      "article",
    );
  });
});
