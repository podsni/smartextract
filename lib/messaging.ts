import { defineExtensionMessaging } from "@webext-core/messaging";
import type { ExtractionOptions, ExtractionResult } from "./types";

export interface ExtractRequest {
  template?: string;
  options?: Partial<ExtractionOptions>;
}

export interface MessagingSchema {
  extractContent(request?: ExtractRequest): ExtractionResult | null;
  extractSelection(request?: ExtractRequest): ExtractionResult | null;
  startInspector(request?: ExtractRequest): void;
}

export const { sendMessage, onMessage } =
  defineExtensionMessaging<MessagingSchema>();
