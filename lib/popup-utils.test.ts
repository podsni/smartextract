import { describe, expect, it } from "bun:test";
import { buildDownloadFilename, getReadingStats } from "./popup-utils";

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
});
