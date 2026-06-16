import { describe, expect, it } from "bun:test";
import {
  buildDownloadFilename,
  cleanExtractedText,
  getReadingStats,
} from "./popup-utils";

describe("popup utils", () => {
  it("builds safe markdown filenames", () => {
    expect(buildDownloadFilename("Hello: World/AI", "MD")).toBe(
      "hello_world_ai.md",
    );
  });

  it("falls back when title has no usable characters", () => {
    expect(buildDownloadFilename("!!!", "TXT")).toBe("smart_extract.txt");
  });

  it("counts words and estimated reading time", () => {
    expect(getReadingStats("satu dua tiga empat lima")).toEqual({
      words: 5,
      time: 1,
    });
  });

  it("returns zero stats for empty content", () => {
    expect(getReadingStats("   ")).toEqual({ words: 0, time: 0 });
  });

  it("removes markdown links when requested", () => {
    expect(
      cleanExtractedText("Read [Docs](https://example.com)", "links"),
    ).toBe("Read Docs");
  });

  it("removes markdown images when requested", () => {
    expect(cleanExtractedText("![Logo](logo.png)\nText", "images")).toBe(
      "Text",
    );
  });
});
