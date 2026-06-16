import { defineExtensionMessaging } from "@webext-core/messaging";
import type { ExtractionOptions, ExtractionResult } from "./types";

export interface ExtractRequest {
  template?: string;
  options?: Partial<ExtractionOptions>;
}

export type ContextMenuType = "full" | "selection" | "element";

export interface ContextMenuExtractRequest {
  type: ContextMenuType;
  template?: string;
  options?: Partial<ExtractionOptions>;
}

export interface DownloadRequest {
  filename: string;
  content: string;
  mimeType: string;
}

export interface MessagingSchema {
  extractContent(request?: ExtractRequest): ExtractionResult | null;
  extractSelection(request?: ExtractRequest): ExtractionResult | null;
  startInspector(request?: ExtractRequest): void;
  contextMenuExtract(
    request: ContextMenuExtractRequest,
  ): ExtractionResult | null;
  triggerDownload(request: DownloadRequest): void;
  showToast(message: string): void;
}

export const { sendMessage, onMessage } =
  defineExtensionMessaging<MessagingSchema>();
