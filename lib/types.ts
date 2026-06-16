export interface ExtractionMetadata {
  title: string;
  description: string;
  author: string;
  publishedTime: string;
  canonicalUrl: string;
  siteName: string;
}

export type ExtractionQualityLevel = "good" | "medium" | "poor";

export interface ExtractionAnalysis {
  score: number;
  level: ExtractionQualityLevel;
  issues: string[];
  recommendations: string[];
  linkCount: number;
  imageCount: number;
  duplicateBlockCount: number;
  noiseCount: number;
}

export interface ExtractionResult {
  title: string;
  byline: string;
  dir: string;
  content: string; // Markdown format
  textContent: string; // Plain text
  length: number;
  excerpt: string;
  siteName: string;
  url: string;
  metadata?: ExtractionMetadata;
  analysis?: ExtractionAnalysis;
}

export interface ExtractorMessage {
  action: "EXTRACT_CONTENT";
}

export interface UserSettings {
  customTemplate: string;
  aiProvider: AiProvider;
  customProviderName: string;
  aiPrompt: string;
  enableFileUpload: boolean;
}

export type AiProvider =
  | "chatgpt"
  | "gemini"
  | "grok"
  | "claude"
  | "aistudio"
  | "custom";

export interface PendingAIUpload {
  provider: AiProvider;
  text?: string;
  title?: string;
  prompt?: string;
}

export type ExtractionSource = "full" | "selection" | "picker";
export type OutputFormat = "MD" | "TXT";
export type ExtractionMode = "article" | "clean" | "raw";

export interface ExtractionOptions {
  mode: ExtractionMode;
  includeImages: boolean;
  includeLinks: boolean;
  includeMetadata: boolean;
  removeDuplicates: boolean;
}

export interface HistoryEntry {
  id: string;
  createdAt: number;
  title: string;
  url: string;
  siteName: string;
  source: ExtractionSource;
  format: OutputFormat;
  content: string;
  textContent: string;
  analysis?: ExtractionAnalysis;
  metadata?: ExtractionMetadata;
}

export const DEFAULT_TEMPLATE = `---
title: "{{title}}"
author: "{{author}}"
source: "{{url}}"
site: "{{site}}"
published: "{{published}}"
saved: "{{date}}"
---

# {{title}}

> **Source:** [{{url}}]({{url}})
> **Author:** {{author}} · **Published:** {{published}}

---

{{content}}`;

export const DEFAULT_AI_PROMPT =
  "Tolong ringkas teks berikut dalam 5 poin utama yang sangat jelas dan mudah dipahami:";
export const DEFAULT_AI_PROVIDER: AiProvider = "chatgpt";
export const DEFAULT_ENABLE_FILE_UPLOAD = true;
export const DEFAULT_EXTRACTION_OPTIONS: ExtractionOptions = {
  mode: "article",
  includeImages: true,
  includeLinks: true,
  includeMetadata: true,
  removeDuplicates: true,
};
export const DEFAULT_CUSTOM_PROVIDER_NAME = "Custom Provider";
export const DEFAULT_AI_URL = "https://chatgpt.com/";
export const AI_PROVIDER_URLS: Record<AiProvider, string> = {
  chatgpt: "https://chatgpt.com/",
  gemini: "https://gemini.google.com/app?hl=id",
  grok: "https://grok.com/",
  claude: "https://claude.ai/new",
  aistudio: "https://aistudio.google.com/prompts/new_chat",
  custom: "https://example.com/",
};
