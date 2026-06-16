import type { ExtractionMode, ExtractionOptions } from "./types";

export const DEFAULT_EXTRACTION_OPTIONS: ExtractionOptions = {
  mode: "article",
  includeImages: true,
  includeLinks: true,
  includeMetadata: true,
  removeDuplicates: true,
};

const MODES = new Set<ExtractionMode>(["article", "clean", "raw"]);

export function normalizeExtractionOptions(
  options?: Partial<ExtractionOptions>,
): ExtractionOptions {
  const mode = MODES.has(options?.mode as ExtractionMode)
    ? (options!.mode as ExtractionMode)
    : DEFAULT_EXTRACTION_OPTIONS.mode;

  return {
    ...DEFAULT_EXTRACTION_OPTIONS,
    ...options,
    mode,
    includeImages:
      typeof options?.includeImages === "boolean"
        ? options.includeImages
        : DEFAULT_EXTRACTION_OPTIONS.includeImages,
    includeLinks:
      typeof options?.includeLinks === "boolean"
        ? options.includeLinks
        : DEFAULT_EXTRACTION_OPTIONS.includeLinks,
    includeMetadata:
      typeof options?.includeMetadata === "boolean"
        ? options.includeMetadata
        : DEFAULT_EXTRACTION_OPTIONS.includeMetadata,
    removeDuplicates:
      typeof options?.removeDuplicates === "boolean"
        ? options.removeDuplicates
        : DEFAULT_EXTRACTION_OPTIONS.removeDuplicates,
  };
}
