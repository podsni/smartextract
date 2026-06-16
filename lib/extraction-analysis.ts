import type { ExtractionAnalysis, ExtractionMetadata } from "./types";

interface AnalyzeInput {
  content: string;
  textContent: string;
  metadata?: ExtractionMetadata;
}

const NOISE_WORDS = [
  "subscribe",
  "cookie",
  "advertisement",
  "newsletter",
  "sign up",
  "share this",
];

function countMatches(text: string, pattern: RegExp): number {
  return text.match(pattern)?.length ?? 0;
}

function countDuplicateBlocks(text: string): number {
  const seen = new Set<string>();
  let duplicates = 0;

  text
    .split(/\n{2,}/)
    .map((block) => block.trim().toLowerCase().replace(/\s+/g, " "))
    .filter(Boolean)
    .forEach((block) => {
      if (seen.has(block)) duplicates += 1;
      else seen.add(block);
    });

  return duplicates;
}

export function analyzeExtractionQuality(
  input: AnalyzeInput,
): ExtractionAnalysis {
  const text = input.textContent.trim();
  const content = input.content.trim();
  const words = text ? text.split(/\s+/).length : 0;
  const linkCount = countMatches(content, /\[[^\]]+\]\([^)]+\)/g);
  const imageCount = countMatches(content, /!\[[^\]]*\]\([^)]+\)/g);
  const duplicateBlockCount = countDuplicateBlocks(text);
  const lowerText = text.toLowerCase();
  const noiseCount = NOISE_WORDS.filter((word) =>
    lowerText.includes(word),
  ).length;
  const issues: string[] = [];
  const recommendations: string[] = [];
  let score = 100;

  if (words < 80) {
    issues.push("Konten terlalu pendek");
    recommendations.push("Coba mode Raw");
    score -= 35;
  }

  if (noiseCount > 0) {
    issues.push("Konten masih mengandung noise");
    recommendations.push("Coba mode Clean Page");
    score -= Math.min(25, noiseCount * 10);
  }

  if (linkCount > Math.max(10, words / 20)) {
    issues.push("Terlalu banyak link");
    recommendations.push("Matikan Pertahankan link");
    score -= 15;
  }

  if (imageCount > 8) {
    issues.push("Terlalu banyak gambar");
    recommendations.push("Matikan Sertakan gambar");
    score -= 10;
  }

  if (duplicateBlockCount > 0) {
    issues.push("Ada blok teks duplikat");
    recommendations.push("Aktifkan Hapus duplikat");
    score -= Math.min(20, duplicateBlockCount * 8);
  }

  if (!input.metadata?.description && !input.metadata?.author) {
    issues.push("Metadata kurang lengkap");
    score -= 5;
  }

  const normalizedScore = Math.max(0, Math.min(100, score));
  const level =
    normalizedScore >= 80 ? "good" : normalizedScore >= 50 ? "medium" : "poor";

  return {
    score: normalizedScore,
    level,
    issues,
    recommendations: Array.from(new Set(recommendations)),
    linkCount,
    imageCount,
    duplicateBlockCount,
    noiseCount,
  };
}
