import { useState, useMemo, useEffect } from "react";
import { sendMessage } from "@/lib/messaging";
import type {
  AiProvider,
  ExtractionResult,
  ExtractionSource,
  HistoryEntry,
  OutputFormat,
} from "@/lib/types";
import {
  AI_PROVIDER_URLS,
  DEFAULT_CUSTOM_PROVIDER_NAME,
  DEFAULT_ENABLE_FILE_UPLOAD,
  DEFAULT_AI_PROVIDER,
  DEFAULT_TEMPLATE,
  DEFAULT_AI_PROMPT,
  DEFAULT_AI_URL,
} from "@/lib/types";
import { loadLocalState, saveLocalState } from "@/lib/local-state";
import { loadHistoryFromDb, saveHistoryToDb } from "@/lib/history-db";
import {
  createHistoryEntry,
  insertHistoryEntry,
  removeHistoryEntry,
} from "@/lib/history-utils";
import type { ExtractionCacheMap } from "@/lib/extraction-cache";
import {
  getCachedExtractionForUrl,
  upsertCachedExtraction,
} from "@/lib/extraction-cache";
import {
  PROMPT_TEMPLATES,
  buildPromptWithContext,
  getPromptTemplateById,
} from "@/lib/ai-prompts";
import { buildDownloadFilename, getReadingStats } from "@/lib/popup-utils";
import {
  FileText,
  Copy,
  Check,
  Download,
  RefreshCw,
  Zap,
  Clock,
  Hash,
  ExternalLink,
  Target,
  FileCode,
  Type,
  MousePointer2,
  Trash2,
  AlertCircle,
  Sparkles,
  Database,
  Settings,
  ChevronLeft,
  RotateCcw,
  Save,
  BrainCircuit,
  MessageSquare,
  History,
  Bot,
  BookOpen,
  Layers,
  Lightbulb,
  List,
  AlertTriangle,
  PlusCircle,
  Bookmark,
  Link2,
  Globe,
  Cpu,
  FlaskConical,
} from "lucide-react";
import "./App.css";

interface SavedPrompt {
  id: string;
  name: string;
  prompt: string;
  createdAt: number;
}

interface SavedAiUrl {
  id: string;
  name: string;
  url: string;
  provider: AiProvider;
  createdAt: number;
}

const AI_PROVIDER_OPTIONS: Array<{
  id: AiProvider;
  label: string;
  subtitle: string;
}> = [
  { id: "chatgpt", label: "ChatGPT", subtitle: "OpenAI ChatGPT" },
  { id: "gemini", label: "Gemini", subtitle: "Google Gemini" },
  { id: "grok", label: "Grok", subtitle: "xAI Grok" },
  { id: "claude", label: "Claude", subtitle: "Anthropic Claude" },
  { id: "aistudio", label: "AI Studio", subtitle: "Google AI Studio" },
  { id: "custom", label: "Custom", subtitle: "Provider URL Kustom" },
];

function App() {
  const LOCAL_UI_KEY = "smartExtract.uiState";
  const LOCAL_DRAFT_KEY = "smartExtract.draftSettings";
  const LOCAL_PROMPT_LIBRARY_KEY = "smartExtract.promptLibrary";
  const LOCAL_AI_URL_LIBRARY_KEY = "smartExtract.aiUrlLibrary";
  const LOCAL_EXTRACTION_CACHE_KEY = "smartExtract.extractionCacheByUrl";
  const MAX_HISTORY = 50;
  const MAX_CUSTOM_PROMPTS = 20;
  const MAX_CUSTOM_URLS = 20;
  const MAX_URL_CACHE = 150;

  const [extractedData, setExtractedData] = useState<ExtractionResult | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [format, setFormat] = useState<OutputFormat>("MD");
  const [wasAutoCopied, setWasAutoCopied] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [extractionCache, setExtractionCache] = useState<ExtractionCacheMap>(
    {},
  );
  const [servedFromCache, setServedFromCache] = useState(false);

  // Settings State
  const [showSettings, setShowSettings] = useState(false);
  const [customTemplate, setCustomTemplate] = useState(DEFAULT_TEMPLATE);
  const [aiPrompt, setAiPrompt] = useState(DEFAULT_AI_PROMPT);
  const [aiProvider, setAiProvider] = useState<AiProvider>(DEFAULT_AI_PROVIDER);
  const [customProviderName, setCustomProviderName] = useState(
    DEFAULT_CUSTOM_PROVIDER_NAME,
  );
  const [enableFileUpload, setEnableFileUpload] = useState(
    DEFAULT_ENABLE_FILE_UPLOAD,
  );
  const [selectedPromptTemplate, setSelectedPromptTemplate] =
    useState("summary_5_points");
  const [aiUrl, setAiUrl] = useState(DEFAULT_AI_URL);
  const [templateSaved, setTemplateSaved] = useState(false);
  const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>([]);
  const [savedAiUrls, setSavedAiUrls] = useState<SavedAiUrl[]>([]);
  const [activeSavedUrlId, setActiveSavedUrlId] = useState<string | null>(null);
  const [editingAiUrlId, setEditingAiUrlId] = useState<string | null>(null);
  const [newAiUrlName, setNewAiUrlName] = useState("");
  const [urlWarning, setUrlWarning] = useState<string | null>(null);
  const [newPromptName, setNewPromptName] = useState("");
  const [newPromptText, setNewPromptText] = useState("");
  const [promptWarning, setPromptWarning] = useState<string | null>(null);
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null);

  useEffect(() => {
    const uiState = loadLocalState<{
      format: OutputFormat;
      extractedData: ExtractionResult | null;
    }>(LOCAL_UI_KEY, {
      format: "MD",
      extractedData: null,
    });
    setFormat(uiState.format);
    setExtractedData(uiState.extractedData);

    const draftSettings = loadLocalState<{
      customTemplate: string;
      aiPrompt: string;
      aiProvider: AiProvider;
      customProviderName: string;
      enableFileUpload: boolean;
      selectedPromptTemplate: string;
      aiUrl: string;
    }>(LOCAL_DRAFT_KEY, {
      customTemplate: DEFAULT_TEMPLATE,
      aiPrompt: DEFAULT_AI_PROMPT,
      aiProvider: DEFAULT_AI_PROVIDER,
      customProviderName: DEFAULT_CUSTOM_PROVIDER_NAME,
      enableFileUpload: DEFAULT_ENABLE_FILE_UPLOAD,
      selectedPromptTemplate: "summary_5_points",
      aiUrl: DEFAULT_AI_URL,
    });
    setCustomTemplate(draftSettings.customTemplate);
    setAiPrompt(draftSettings.aiPrompt);
    setAiProvider(
      draftSettings.aiProvider in AI_PROVIDER_URLS
        ? draftSettings.aiProvider
        : DEFAULT_AI_PROVIDER,
    );
    setCustomProviderName(
      draftSettings.customProviderName || DEFAULT_CUSTOM_PROVIDER_NAME,
    );
    setEnableFileUpload(draftSettings.enableFileUpload);
    setSelectedPromptTemplate(draftSettings.selectedPromptTemplate);
    setAiUrl(draftSettings.aiUrl);
    setSavedPrompts(
      loadLocalState<SavedPrompt[]>(LOCAL_PROMPT_LIBRARY_KEY, []).slice(
        0,
        MAX_CUSTOM_PROMPTS,
      ),
    );
    setSavedAiUrls(
      loadLocalState<SavedAiUrl[]>(LOCAL_AI_URL_LIBRARY_KEY, [])
        .map((item) => ({
          ...item,
          provider:
            item.provider in AI_PROVIDER_URLS
              ? item.provider
              : DEFAULT_AI_PROVIDER,
        }))
        .slice(0, MAX_CUSTOM_URLS),
    );
    setExtractionCache(
      loadLocalState<ExtractionCacheMap>(LOCAL_EXTRACTION_CACHE_KEY, {}),
    );

    loadHistoryFromDb()
      .then((entries) => setHistory(entries))
      .catch(console.error);

    if (typeof browser === "undefined" || !browser.storage) return;

    browser.storage.local
      .get("lastVisualExtraction")
      .then(async (res) => {
        const data = res as { lastVisualExtraction?: ExtractionResult };
        const visualExtraction = data.lastVisualExtraction;
        if (!visualExtraction) return;

        setExtractedData(visualExtraction);
        setWasAutoCopied(true);
        setTimeout(() => setWasAutoCopied(false), 3000);
        await browser.storage.local.remove("lastVisualExtraction");

        setHistory((prev) => {
          const entry = createHistoryEntry(visualExtraction, "picker", "MD");
          const next = insertHistoryEntry(prev, entry, MAX_HISTORY);
          saveHistoryToDb(next).catch(console.error);
          return next;
        });
      })
      .catch(console.error);

    browser.tabs
      .query({ active: true, currentWindow: true })
      .then((tabs) => {
        const activeUrl = tabs[0]?.url;
        if (!activeUrl) return;
        const cached = getCachedExtractionForUrl(
          loadLocalState<ExtractionCacheMap>(LOCAL_EXTRACTION_CACHE_KEY, {}),
          activeUrl,
        );
        if (cached) {
          setExtractedData((prev) => prev ?? cached);
          setServedFromCache(true);
        }
      })
      .catch(console.error);

    browser.storage.sync
      .get([
        "customTemplate",
        "aiPrompt",
        "aiProvider",
        "customProviderName",
        "enableFileUpload",
        "selectedPromptTemplate",
        "aiUrl",
      ])
      .then((res) => {
        const data = res as {
          customTemplate?: string;
          aiPrompt?: string;
          aiProvider?: AiProvider;
          customProviderName?: string;
          enableFileUpload?: boolean;
          selectedPromptTemplate?: string;
          aiUrl?: string;
        };
        if (data.customTemplate) setCustomTemplate(data.customTemplate);
        if (data.aiPrompt) setAiPrompt(data.aiPrompt);
        if (data.aiProvider) {
          setAiProvider(
            data.aiProvider in AI_PROVIDER_URLS
              ? data.aiProvider
              : DEFAULT_AI_PROVIDER,
          );
        }
        if (data.customProviderName) {
          setCustomProviderName(data.customProviderName);
        }
        if (typeof data.enableFileUpload === "boolean") {
          setEnableFileUpload(data.enableFileUpload);
        }
        if (data.selectedPromptTemplate) {
          setSelectedPromptTemplate(data.selectedPromptTemplate);
        }
        if (data.aiUrl) setAiUrl(data.aiUrl);
      })
      .catch(console.error);

    browser.storage.sync
      .get(["customPromptLibrary"])
      .then((res) => {
        const data = res as { customPromptLibrary?: SavedPrompt[] };
        if (Array.isArray(data.customPromptLibrary)) {
          setSavedPrompts(
            data.customPromptLibrary.slice(0, MAX_CUSTOM_PROMPTS),
          );
        }
      })
      .catch(console.error);

    browser.storage.sync
      .get(["customAiUrlLibrary"])
      .then((res) => {
        const data = res as { customAiUrlLibrary?: SavedAiUrl[] };
        if (Array.isArray(data.customAiUrlLibrary)) {
          setSavedAiUrls(
            data.customAiUrlLibrary
              .map((item) => ({
                ...item,
                provider:
                  item.provider in AI_PROVIDER_URLS
                    ? item.provider
                    : DEFAULT_AI_PROVIDER,
              }))
              .slice(0, MAX_CUSTOM_URLS),
          );
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    saveLocalState(LOCAL_UI_KEY, { format, extractedData });
  }, [format, extractedData]);

  useEffect(() => {
    saveLocalState(LOCAL_DRAFT_KEY, {
      customTemplate,
      aiPrompt,
      aiProvider,
      customProviderName,
      enableFileUpload,
      selectedPromptTemplate,
      aiUrl,
    });
  }, [
    customTemplate,
    aiPrompt,
    aiProvider,
    customProviderName,
    enableFileUpload,
    selectedPromptTemplate,
    aiUrl,
  ]);

  useEffect(() => {
    saveLocalState(LOCAL_PROMPT_LIBRARY_KEY, savedPrompts);
    if (typeof browser !== "undefined" && browser.storage?.sync) {
      browser.storage.sync
        .set({ customPromptLibrary: savedPrompts })
        .catch(console.error);
    }
  }, [savedPrompts]);

  useEffect(() => {
    saveLocalState(LOCAL_AI_URL_LIBRARY_KEY, savedAiUrls);
    if (typeof browser !== "undefined" && browser.storage?.sync) {
      browser.storage.sync
        .set({ customAiUrlLibrary: savedAiUrls })
        .catch(console.error);
    }
  }, [savedAiUrls]);

  useEffect(() => {
    const normalizedCurrent = sanitizeAiUrl(aiUrl);
    if (!normalizedCurrent) {
      setActiveSavedUrlId(null);
      return;
    }
    const active = savedAiUrls.find(
      (item) =>
        item.provider === aiProvider &&
        sanitizeAiUrl(item.url) === normalizedCurrent,
    );
    setActiveSavedUrlId(active?.id ?? null);
  }, [aiProvider, aiUrl, savedAiUrls]);

  useEffect(() => {
    saveLocalState(LOCAL_EXTRACTION_CACHE_KEY, extractionCache);
  }, [extractionCache]);

  const saveSettings = async () => {
    await browser.storage.sync.set({
      customTemplate,
      aiPrompt,
      aiProvider,
      customProviderName,
      enableFileUpload,
      selectedPromptTemplate,
      aiUrl,
      customPromptLibrary: savedPrompts,
      customAiUrlLibrary: savedAiUrls,
    });
    setTemplateSaved(true);
    setTimeout(() => setTemplateSaved(false), 2000);
  };

  const resetSettings = () => {
    setCustomTemplate(DEFAULT_TEMPLATE);
    setAiPrompt(DEFAULT_AI_PROMPT);
    setAiProvider(DEFAULT_AI_PROVIDER);
    setCustomProviderName(DEFAULT_CUSTOM_PROVIDER_NAME);
    setEnableFileUpload(DEFAULT_ENABLE_FILE_UPLOAD);
    setSelectedPromptTemplate("summary_5_points");
    setAiUrl(AI_PROVIDER_URLS[DEFAULT_AI_PROVIDER]);
  };

  const applyProvider = (provider: AiProvider) => {
    setAiProvider(provider);
    const firstForProvider = savedAiUrls.find(
      (item) => item.provider === provider,
    );
    setAiUrl(firstForProvider?.url ?? AI_PROVIDER_URLS[provider]);
    setUrlWarning(null);
  };

  const sanitizeAiUrl = (rawUrl: string): string | null => {
    const value = rawUrl.trim();
    if (!value) return null;
    try {
      const parsed = new URL(value);
      if (!/^https?:$/.test(parsed.protocol)) return null;
      return parsed.toString();
    } catch {
      return null;
    }
  };

  const applySavedAiUrl = (item: SavedAiUrl) => {
    const sanitized = sanitizeAiUrl(item.url);
    if (!sanitized) {
      setUrlWarning("URL tersimpan tidak valid. Hapus lalu simpan ulang.");
      return;
    }
    setAiProvider(item.provider);
    setAiUrl(sanitized);
    setActiveSavedUrlId(item.id);
    setUrlWarning(null);
  };

  const handleEditAiUrl = (item: SavedAiUrl) => {
    setEditingAiUrlId(item.id);
    setNewAiUrlName(item.name);
    setAiProvider(item.provider);
    setAiUrl(item.url);
    setUrlWarning(null);
  };

  const handleCancelEditAiUrl = () => {
    setEditingAiUrlId(null);
    setNewAiUrlName("");
    setUrlWarning(null);
  };

  const handleSaveAiUrl = () => {
    const sanitizedUrl = sanitizeAiUrl(aiUrl);
    const name = newAiUrlName.trim();
    if (!sanitizedUrl) {
      setUrlWarning("URL tidak valid. Gunakan format https://...");
      return;
    }
    if (name.length < 3) {
      setUrlWarning("Nama URL minimal 3 karakter.");
      return;
    }

    setSavedAiUrls((prev) => {
      const existingByEditId = editingAiUrlId
        ? prev.find((item) => item.id === editingAiUrlId)
        : null;
      const existingByName = prev.find(
        (item) =>
          item.provider === aiProvider &&
          item.name.toLowerCase() === name.toLowerCase(),
      );
      const existing = existingByEditId ?? existingByName;

      const nextItem: SavedAiUrl = existing
        ? { ...existing, name, url: sanitizedUrl, provider: aiProvider }
        : {
            id: `url_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            name,
            url: sanitizedUrl,
            provider: aiProvider,
            createdAt: Date.now(),
          };

      const filtered = prev.filter((item) => item.id !== nextItem.id);
      return [nextItem, ...filtered].slice(0, MAX_CUSTOM_URLS);
    });
    setAiUrl(sanitizedUrl);
    setActiveSavedUrlId(null);
    setEditingAiUrlId(null);
    setNewAiUrlName("");
    setUrlWarning(null);
  };

  const handleDeleteAiUrl = (id: string) => {
    setSavedAiUrls((prev) => prev.filter((item) => item.id !== id));
    if (activeSavedUrlId === id) {
      setActiveSavedUrlId(null);
    }
    if (editingAiUrlId === id) {
      handleCancelEditAiUrl();
    }
  };

  const applyPromptTemplate = (templateId: string) => {
    const template = getPromptTemplateById(templateId);
    setSelectedPromptTemplate(template.id);
    setAiPrompt(template.prompt);
  };

  const applySavedPrompt = (saved: SavedPrompt) => {
    setSelectedPromptTemplate(saved.id);
    setAiPrompt(saved.prompt);
    setPromptWarning(null);
  };

  const handleEditSavedPrompt = (item: SavedPrompt) => {
    setEditingPromptId(item.id);
    setNewPromptName(item.name);
    setNewPromptText(item.prompt);
    setPromptWarning(null);
  };

  const handleCancelEditPrompt = () => {
    setEditingPromptId(null);
    setNewPromptName("");
    setNewPromptText("");
    setPromptWarning(null);
  };

  const handleSavePromptTemplate = () => {
    const name = newPromptName.trim();
    const prompt = newPromptText.trim();

    if (name.length < 3) {
      setPromptWarning("Nama prompt minimal 3 karakter.");
      return;
    }
    if (prompt.length < 20) {
      setPromptWarning(
        "Isi prompt minimal 20 karakter agar hasil AI lebih akurat.",
      );
      return;
    }

    setSavedPrompts((prev) => {
      const existingByEditId = editingPromptId
        ? prev.find((item) => item.id === editingPromptId)
        : null;
      const existingByName = prev.find(
        (item) => item.name.toLowerCase() === name.toLowerCase(),
      );
      const existing = existingByEditId ?? existingByName;

      const nextItem: SavedPrompt = existing
        ? { ...existing, name, prompt }
        : {
            id: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            name,
            prompt,
            createdAt: Date.now(),
          };

      const withoutExisting = prev.filter((item) => item.id !== nextItem.id);
      const next = [nextItem, ...withoutExisting].slice(0, MAX_CUSTOM_PROMPTS);
      return next;
    });

    setSelectedPromptTemplate("custom");
    setAiPrompt(prompt);
    setEditingPromptId(null);
    setNewPromptName("");
    setNewPromptText("");
    setPromptWarning(null);
  };

  const handleDeleteSavedPrompt = (id: string) => {
    setSavedPrompts((prev) => prev.filter((item) => item.id !== id));
    if (selectedPromptTemplate === id) {
      setSelectedPromptTemplate("summary_5_points");
      setAiPrompt(DEFAULT_AI_PROMPT);
    }
    if (editingPromptId === id) {
      handleCancelEditPrompt();
    }
  };

  const renderPromptIcon = (icon: string) => {
    if (icon === "book") return <BookOpen className="w-4 h-4" />;
    if (icon === "layers") return <Layers className="w-4 h-4" />;
    if (icon === "lightbulb") return <Lightbulb className="w-4 h-4" />;
    return <List className="w-4 h-4" />;
  };

  const renderProviderIcon = (provider: AiProvider) => {
    if (provider === "chatgpt")
      return <MessageSquare className="w-3.5 h-3.5" />;
    if (provider === "gemini") return <Bot className="w-3.5 h-3.5" />;
    if (provider === "grok") return <Cpu className="w-3.5 h-3.5" />;
    if (provider === "claude") return <Sparkles className="w-3.5 h-3.5" />;
    if (provider === "custom") return <Globe className="w-3.5 h-3.5" />;
    return <FlaskConical className="w-3.5 h-3.5" />;
  };

  const stats = useMemo(() => {
    return getReadingStats(extractedData?.textContent ?? "");
  }, [extractedData]);

  const persistExtraction = (
    result: ExtractionResult,
    source: ExtractionSource,
    usedFormat: OutputFormat,
  ) => {
    setExtractedData(result);
    setHistory((prev) => {
      const entry = createHistoryEntry(result, source, usedFormat);
      const next = insertHistoryEntry(prev, entry, MAX_HISTORY);
      saveHistoryToDb(next).catch(console.error);
      return next;
    });
  };

  const handleRestoreHistory = (entry: HistoryEntry) => {
    setExtractedData({
      title: entry.title,
      byline: "",
      dir: "ltr",
      content: entry.content,
      textContent: entry.textContent,
      length: entry.textContent.length,
      excerpt: "",
      siteName: entry.siteName,
      url: entry.url,
    });
    setFormat(entry.format);
    setShowHistory(false);
    setError(null);
  };

  const handleDeleteHistory = (id: string) => {
    setHistory((prev) => {
      const next = removeHistoryEntry(prev, id);
      saveHistoryToDb(next).catch(console.error);
      return next;
    });
  };

  const handleClearHistory = () => {
    setHistory([]);
    saveHistoryToDb([]).catch(console.error);
  };

  const handleClearExtractionCache = () => {
    setExtractionCache({});
    setServedFromCache(false);
  };

  const handleAskAI = async () => {
    if (!extractedData) return;

    const fullText =
      format === "MD" ? extractedData.content : extractedData.textContent;
    const finalPrompt = buildPromptWithContext(aiPrompt, fullText, {
      title: extractedData.title,
      siteName: extractedData.siteName,
      url: extractedData.url,
    });
    const canAutoInject = aiProvider !== "custom";

    try {
      if (typeof browser !== "undefined" && browser.storage) {
        if (canAutoInject) {
          await browser.storage.local.set({
            pendingAIUpload: {
              provider: aiProvider,
              text:
                (aiProvider === "chatgpt" || aiProvider === "gemini") &&
                enableFileUpload
                  ? fullText
                  : undefined,
              prompt: finalPrompt,
              title: extractedData.title,
            },
          });
        } else {
          await navigator.clipboard.writeText(finalPrompt);
        }
      }

      window.open(aiUrl, "_blank");
      if (!canAutoInject) {
        alert(
          "Provider kustom tidak mendukung autofill otomatis. Prompt sudah disalin ke clipboard, silakan paste manual.",
        );
      }
    } catch (err) {
      console.error("Failed to save to storage:", err);
      navigator.clipboard.writeText(finalPrompt);
      alert(
        "Gagal menyiapkan file otomatis. Prompt sudah disalin ke Clipboard. Silakan paste (Ctrl+V) manual di ChatGPT.",
      );
      window.open(aiUrl, "_blank");
    }
  };

  const safeSendMessage = async (
    tabId: number,
    action: "extractContent" | "extractSelection" | "startInspector",
  ) => {
    try {
      return await sendMessage(action, customTemplate, { tabId });
    } catch (err: any) {
      const msg = err.message || "";
      if (
        msg.includes("connection") ||
        msg.includes("exist") ||
        msg.includes("sendMessage")
      ) {
        await browser.scripting.executeScript({
          target: { tabId },
          files: ["content-scripts/content.js"],
        });
        await new Promise((r) => setTimeout(r, 600));
        return await sendMessage(action, customTemplate, { tabId });
      }
      throw err;
    }
  };

  const handleFullExtract = async () => {
    setLoading(true);
    setError(null);
    setCopied(false);
    setWasAutoCopied(false);
    setServedFromCache(false);

    try {
      const [tab] = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tab?.id || !tab.url) throw new Error("No active tab found.");

      const cached = getCachedExtractionForUrl(extractionCache, tab.url);
      if (cached) {
        setExtractedData(cached);
        setServedFromCache(true);
        return;
      }

      const result = await safeSendMessage(tab.id, "extractContent");
      if (result) {
        persistExtraction(result, "full", format);
        setExtractionCache((prev) =>
          upsertCachedExtraction(prev, tab.url!, result, MAX_URL_CACHE),
        );
      } else throw new Error("No readable content found.");
    } catch (err: any) {
      setError(err.message || "Extraction failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectionExtract = async () => {
    setLoading(true);
    setError(null);
    setWasAutoCopied(false);
    setServedFromCache(false);
    try {
      const [tab] = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tab?.id) throw new Error("No active tab found.");
      const result = await safeSendMessage(tab.id, "extractSelection");
      if (result) persistExtraction(result, "selection", format);
    } catch (err: any) {
      if (err.message?.includes("selected")) setError("Highlight text first!");
      else setError(err.message || "Selection failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleStartInspector = async () => {
    try {
      const [tab] = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tab?.id) throw new Error("No active tab found.");
      await safeSendMessage(tab.id, "startInspector");
      window.close();
    } catch (err: any) {
      setError(err.message || "Could not start inspector.");
    }
  };

  const handleCopy = () => {
    const content =
      format === "MD" ? extractedData?.content : extractedData?.textContent;
    if (content) {
      navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    if (!extractedData) return;
    const content =
      format === "MD" ? extractedData.content : extractedData.textContent;
    const blob = new Blob([content || ""], {
      type: format === "MD" ? "text/markdown" : "text/plain",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = buildDownloadFilename(extractedData.title, format);
    a.click();
    URL.revokeObjectURL(url);
  };

  if (showSettings) {
    return (
      <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-all duration-300 w-full min-w-0">
        <header className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSettings(false)}
              className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h1 className="font-bold text-lg tracking-tight">Settings & AI</h1>
          </div>
        </header>
        <main className="flex-1 p-5 overflow-y-auto space-y-6">
          {/* Header Template */}
          <section>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Markdown Template
            </label>
            <textarea
              className="w-full h-40 p-3 text-[10px] font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none"
              value={customTemplate}
              onChange={(e) => setCustomTemplate(e.target.value)}
            />
          </section>

          {/* AI Settings */}
          <section className="bg-indigo-50/50 dark:bg-indigo-900/10 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-900/30 space-y-4">
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
              <BrainCircuit className="w-4 h-4" />
              <h2 className="text-xs font-bold uppercase tracking-wider">
                AI Configuration
              </h2>
            </div>
            <div>
              <label className="block text-[10px] font-semibold mb-2 text-slate-600 dark:text-slate-400">
                AI Provider
              </label>
              <div className="grid grid-cols-2 gap-2">
                {AI_PROVIDER_OPTIONS.map((providerOption) => (
                  <button
                    key={providerOption.id}
                    type="button"
                    onClick={() => applyProvider(providerOption.id)}
                    className={`p-2 rounded-lg border text-left transition-all ${
                      aiProvider === providerOption.id
                        ? "bg-white dark:bg-slate-900 border-indigo-400 text-indigo-700 dark:text-indigo-300"
                        : "bg-white/60 dark:bg-slate-900/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    <p className="text-[10px] font-bold flex items-center gap-1.5">
                      {renderProviderIcon(providerOption.id)}
                      {providerOption.id === "custom"
                        ? customProviderName
                        : providerOption.label}
                    </p>
                    <p className="text-[9px] mt-1 opacity-80">
                      {providerOption.id === "custom"
                        ? "Provider AI kustom"
                        : providerOption.subtitle}
                    </p>
                  </button>
                ))}
              </div>
            </div>
            {aiProvider === "custom" && (
              <div>
                <label className="block text-[10px] font-semibold mb-1 text-slate-600 dark:text-slate-400">
                  Nama Custom Provider
                </label>
                <input
                  type="text"
                  className="w-full p-2 text-[11px] bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg outline-none"
                  value={customProviderName}
                  onChange={(e) =>
                    setCustomProviderName(
                      e.target.value || DEFAULT_CUSTOM_PROVIDER_NAME,
                    )
                  }
                  placeholder="Contoh: My Company AI"
                />
              </div>
            )}
            <div>
              <label className="block text-[10px] font-semibold mb-1 text-slate-600 dark:text-slate-400">
                AI Tool URL
              </label>
              <input
                type="text"
                className="w-full p-2 text-[11px] bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg outline-none"
                value={aiUrl}
                onChange={(e) => setAiUrl(e.target.value)}
                placeholder={AI_PROVIDER_URLS[aiProvider]}
              />
              <p className="mt-1 text-[9px] text-slate-500">
                Contoh ChatGPT valid: <code>https://chatgpt.com/c/...</code>,{" "}
                <code>https://chatgpt.com/g/.../project</code>,{" "}
                <code>https://chatgpt.com/g/.../c/...</code>
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/40 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-slate-700 dark:text-slate-200">
                    Upload File ke AI
                  </p>
                  <p className="text-[9px] text-slate-500 mt-1 leading-relaxed">
                    Jika aktif, hasil extract dikirim sebagai lampiran file
                    (ChatGPT & Gemini).
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0 pt-0.5">
                  <button
                    type="button"
                    onClick={() => setEnableFileUpload((prev) => !prev)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
                      enableFileUpload
                        ? "bg-emerald-500"
                        : "bg-slate-300 dark:bg-slate-600"
                    }`}
                    title="Toggle upload file"
                    role="switch"
                    aria-checked={enableFileUpload}
                    aria-pressed={enableFileUpload}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-1 ring-black/5 transition duration-200 ${
                        enableFileUpload
                          ? "translate-x-[22px]"
                          : "translate-x-[2px]"
                      }`}
                    />
                  </button>
                  <span
                    className={`text-[9px] font-bold uppercase tracking-wider ${
                      enableFileUpload
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    {enableFileUpload ? "On" : "Off"}
                  </span>
                </div>
              </div>
            </div>
            <div className="space-y-2 rounded-xl border border-slate-200 dark:border-slate-700 p-3 bg-white/70 dark:bg-slate-900/40">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {editingAiUrlId ? "Edit URL Tujuan" : "Simpan URL Tujuan"}
              </p>
              <input
                type="text"
                value={newAiUrlName}
                onChange={(e) => setNewAiUrlName(e.target.value)}
                placeholder="Nama URL (contoh: Project Menulis)"
                className="w-full p-2 text-[11px] bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg outline-none"
              />
              {urlWarning && (
                <p className="text-[10px] text-red-600 dark:text-red-400 font-semibold">
                  {urlWarning}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSaveAiUrl}
                  className="flex-1 py-2 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-[11px] font-bold flex items-center justify-center gap-1.5"
                >
                  <Link2 className="w-4 h-4" />
                  {editingAiUrlId ? "Update URL" : "Simpan URL Ini"}
                </button>
                {editingAiUrlId && (
                  <button
                    type="button"
                    onClick={handleCancelEditAiUrl}
                    className="px-3 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-bold"
                  >
                    Batal
                  </button>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400">
                Saved Provider URLs
              </label>
              {savedAiUrls.length === 0 && (
                <p className="text-[10px] text-slate-500">
                  Belum ada URL tersimpan.
                </p>
              )}
              {savedAiUrls.map((item) => (
                <div
                  key={item.id}
                  className={`rounded-lg border p-2 ${
                    activeSavedUrlId === item.id
                      ? "border-emerald-400 bg-emerald-50/70 dark:bg-emerald-900/20"
                      : "border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/70"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold truncate flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5" />
                        {item.name}
                        {activeSavedUrlId === item.id && (
                          <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[8px] uppercase tracking-wider">
                            Aktif
                          </span>
                        )}
                      </p>
                      <p className="text-[9px] text-slate-500 truncate mt-1">
                        {item.url}
                      </p>
                      <p className="text-[9px] text-slate-400 mt-1 uppercase">
                        {item.provider}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => applySavedAiUrl(item)}
                        className="px-2 py-1 rounded-md bg-blue-50 text-blue-700 text-[9px] font-bold"
                      >
                        Gunakan
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEditAiUrl(item)}
                        className="px-2 py-1 rounded-md bg-amber-50 text-amber-700 text-[9px] font-bold"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteAiUrl(item.id)}
                        className="p-1 rounded-md bg-red-50 text-red-600"
                        title="Hapus URL"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div>
              <label className="block text-[10px] font-semibold mb-2 text-slate-600 dark:text-slate-400">
                Prompt Template
              </label>
              <div className="grid grid-cols-2 gap-2">
                {PROMPT_TEMPLATES.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => applyPromptTemplate(template.id)}
                    className={`text-left p-2 rounded-lg border transition-all ${
                      selectedPromptTemplate === template.id
                        ? "bg-white dark:bg-slate-900 border-indigo-500 text-indigo-700 dark:text-indigo-300 shadow-sm"
                        : "bg-white/60 dark:bg-slate-900/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-[10px] font-bold">
                      <span className="flex items-center gap-1.5">
                        {renderPromptIcon(template.icon)}
                        <span>{template.label}</span>
                      </span>
                      {selectedPromptTemplate === template.id && (
                        <span className="px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[8px] uppercase tracking-wider">
                          Aktif
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-[9px] leading-snug opacity-80">
                      {template.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
              <div className="flex items-center gap-1.5 font-bold mb-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                Peringatan Data
              </div>
              Prompt akan dikirim bersama isi teks hasil ekstraksi. Jangan kirim
              data sensitif.
            </div>
            <div>
              <label className="block text-[10px] font-semibold mb-1 text-slate-600 dark:text-slate-400">
                Custom AI Prompt
              </label>
              <textarea
                className="w-full h-20 p-2 text-[11px] bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg outline-none resize-none"
                value={aiPrompt}
                onChange={(e) => {
                  setAiPrompt(e.target.value);
                  setSelectedPromptTemplate("custom");
                }}
              />
            </div>
            <div className="space-y-2">
              <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400">
                Saved Custom Prompts
              </label>
              {savedPrompts.length === 0 && (
                <p className="text-[10px] text-slate-500">
                  Belum ada prompt tersimpan.
                </p>
              )}
              {savedPrompts.map((item) => (
                <div
                  key={item.id}
                  className={`rounded-lg border p-2 ${
                    selectedPromptTemplate === item.id
                      ? "border-indigo-400 bg-white dark:bg-slate-900"
                      : "border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/70"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold truncate flex items-center gap-1.5">
                        <Bookmark className="w-3.5 h-3.5" />
                        {item.name}
                      </p>
                      <p className="text-[9px] text-slate-500 truncate mt-1">
                        {item.prompt}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => applySavedPrompt(item)}
                        className="px-2 py-1 rounded-md bg-blue-50 text-blue-700 text-[9px] font-bold"
                      >
                        Gunakan
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEditSavedPrompt(item)}
                        className="px-2 py-1 rounded-md bg-amber-50 text-amber-700 text-[9px] font-bold"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSavedPrompt(item.id)}
                        className="p-1 rounded-md bg-red-50 text-red-600"
                        title="Hapus prompt"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-2 rounded-xl border border-slate-200 dark:border-slate-700 p-3 bg-white/70 dark:bg-slate-900/40">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {editingPromptId ? "Edit Prompt" : "Tambah Prompt Baru"}
              </p>
              <input
                type="text"
                value={newPromptName}
                onChange={(e) => setNewPromptName(e.target.value)}
                placeholder="Nama prompt (contoh: Analisis Mendalam)"
                className="w-full p-2 text-[11px] bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg outline-none"
              />
              <textarea
                value={newPromptText}
                onChange={(e) => setNewPromptText(e.target.value)}
                placeholder="Isi prompt custom Anda..."
                className="w-full h-20 p-2 text-[11px] bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg outline-none resize-none"
              />
              {promptWarning && (
                <p className="text-[10px] text-red-600 dark:text-red-400 font-semibold">
                  {promptWarning}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSavePromptTemplate}
                  className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold flex items-center justify-center gap-1.5"
                >
                  <PlusCircle className="w-4 h-4" />
                  {editingPromptId ? "Update Prompt" : "Simpan Prompt"}
                </button>
                {editingPromptId && (
                  <button
                    type="button"
                    onClick={handleCancelEditPrompt}
                    className="px-3 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-bold"
                  >
                    Batal
                  </button>
                )}
              </div>
            </div>
          </section>

          <section className="bg-white/70 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
              <Database className="w-4 h-4" />
              <h2 className="text-xs font-bold uppercase tracking-wider">
                Cache Ekstraksi
              </h2>
            </div>
            <p className="text-[10px] text-slate-500 leading-relaxed">
              Cache mempercepat ekstraksi ulang halaman yang sama. Hapus cache
              jika konten situs sudah berubah.
            </p>
            <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 px-3 py-2">
              <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">
                {Object.keys(extractionCache).length} halaman tersimpan
              </span>
              <button
                type="button"
                onClick={handleClearExtractionCache}
                disabled={Object.keys(extractionCache).length === 0}
                className="px-3 py-1.5 rounded-lg bg-red-50 text-red-600 disabled:bg-slate-100 disabled:text-slate-400 text-[10px] font-bold"
              >
                Hapus Cache
              </button>
            </div>
          </section>
        </main>
        <footer className="p-5 border-t border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md flex justify-between gap-3">
          <button
            onClick={resetSettings}
            className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl text-xs font-bold transition-all flex items-center gap-2 active:scale-95"
          >
            <RotateCcw className="w-4 h-4" /> Reset
          </button>
          <button
            onClick={saveSettings}
            className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 active:scale-95"
          >
            {templateSaved ? (
              <Check className="w-4 h-4" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {templateSaved ? "Settings Saved!" : "Save Changes"}
          </button>
        </footer>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-all duration-300 w-full min-w-0">
      {/* Header */}
      <header className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Zap className="w-5 h-5 text-white fill-white" />
          </div>
          <h1 className="font-bold text-lg tracking-tight">
            SmartExtract{" "}
            <span className="text-[10px] font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-600 px-1.5 py-0.5 rounded ml-1">
              v2.5
            </span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
            <button
              onClick={() => setFormat("MD")}
              className={`px-3 py-1 text-[11px] font-bold rounded flex items-center gap-1 transition-all ${format === "MD" ? "bg-white dark:bg-slate-700 shadow-sm text-blue-600" : "text-slate-500 hover:text-slate-800"}`}
            >
              <FileCode className="w-3.5 h-3.5" /> MD
            </button>
            <button
              onClick={() => setFormat("TXT")}
              className={`px-3 py-1 text-[11px] font-bold rounded flex items-center gap-1 transition-all ${format === "TXT" ? "bg-white dark:bg-slate-700 shadow-sm text-blue-600" : "text-slate-500 hover:text-slate-800"}`}
            >
              <Type className="w-3.5 h-3.5" /> TXT
            </button>
          </div>
          <button
            onClick={() => setShowHistory((prev) => !prev)}
            className={`p-2 rounded-lg transition-colors ${
              showHistory
                ? "text-blue-600 bg-blue-50 dark:bg-blue-900/30"
                : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
            title="History"
          >
            <History className="w-5 h-5" />
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Content Area */}
      <main className="flex-1 p-4 sm:p-5 overflow-y-auto min-h-[420px]">
        {!extractedData && !loading && !error && (
          <div className="flex flex-col items-center justify-center h-[340px] text-center space-y-6 animate-in fade-in duration-700">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/10 dark:to-blue-900/30 rounded-3xl flex items-center justify-center shadow-inner relative">
              <div className="absolute inset-0 bg-blue-400 blur-2xl opacity-10 animate-pulse rounded-full"></div>
              <FileText className="w-10 h-10 text-blue-600 dark:text-blue-400 relative z-10" />
            </div>
            <div className="max-w-[240px]">
              <p className="font-bold text-slate-800 dark:text-slate-200 text-lg tracking-tight">
                Ekstrak Konten Sekali Klik
              </p>
              <p className="text-sm text-slate-500 mt-2">
                Ambil artikel, pilihan teks, atau bagian halaman lalu kirim ke
                AI favoritmu.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 w-full max-w-[320px]">
              <button
                onClick={handleFullExtract}
                disabled={loading}
                title="Ekstrak seluruh halaman"
                aria-label="Ekstrak seluruh halaman aktif"
                className="col-span-2 px-6 py-3.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white rounded-2xl text-sm font-bold transition-all shadow-lg shadow-blue-600/20 active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <Zap className="w-4 h-4 fill-white" /> Ekstrak Halaman
              </button>
              <button
                onClick={handleStartInspector}
                disabled={loading}
                title="Pilih bagian halaman secara visual"
                aria-label="Pilih bagian halaman secara visual"
                className="px-4 py-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 hover:bg-indigo-100 disabled:bg-slate-100 text-indigo-700 dark:text-indigo-300 rounded-2xl text-xs font-bold transition-all flex flex-col items-center gap-2 shadow-sm active:scale-[0.98]"
              >
                <MousePointer2 className="w-5 h-5" /> Pilih Bagian
              </button>
              <button
                onClick={handleSelectionExtract}
                disabled={loading}
                title="Ekstrak teks yang sedang dipilih"
                aria-label="Ekstrak teks yang sedang dipilih"
                className="px-4 py-3 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 disabled:bg-slate-100 text-slate-700 dark:text-slate-200 rounded-2xl text-xs font-bold transition-all flex flex-col items-center gap-2 shadow-sm active:scale-[0.98]"
              >
                <Target className="w-5 h-5" /> Teks Dipilih
              </button>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center h-[340px] space-y-5">
            <RefreshCw className="w-12 h-12 text-blue-600 animate-spin" />
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
              Processing...
            </p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-3xl p-8 text-center animate-in zoom-in duration-500">
            <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-4" />
            <p className="text-red-600 dark:text-red-400 text-sm font-bold leading-relaxed mb-6">
              {error}
            </p>
            <button
              onClick={() => setError(null)}
              className="w-full py-3 bg-white dark:bg-slate-800 border border-red-200 dark:border-red-900/40 text-xs font-bold text-red-700 dark:text-red-300 uppercase tracking-widest rounded-xl"
            >
              Go Back
            </button>
          </div>
        )}

        {showHistory && !loading && (
          <section className="space-y-3 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Extraction History
              </h2>
              <button
                onClick={handleClearHistory}
                disabled={history.length === 0}
                className="text-[10px] font-bold text-red-500 disabled:text-slate-300 uppercase tracking-wider"
              >
                Clear All
              </button>
            </div>

            {history.length === 0 && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-xs text-slate-500">
                Belum ada history ekstraksi.
              </div>
            )}

            {history.map((item) => (
              <article
                key={item.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                      {item.title}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-1 truncate">
                      {item.siteName || item.url}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      {new Date(item.createdAt).toLocaleString()} •{" "}
                      {item.source} • {item.format}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleRestoreHistory(item)}
                      className="px-2 py-1 rounded-md bg-blue-50 text-blue-700 text-[10px] font-bold"
                    >
                      Pakai Lagi
                    </button>
                    <button
                      onClick={() => handleDeleteHistory(item.id)}
                      className="p-1.5 rounded-md bg-red-50 text-red-600"
                      title="Hapus item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </section>
        )}

        {extractedData && !loading && !showHistory && (
          <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-2">
            {/* Metadata Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xl border-l-4 border-l-blue-600 relative group">
              <div className="absolute top-0 right-0 p-3 flex gap-2">
                {servedFromCache && (
                  <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 text-[9px] font-bold rounded-full animate-in zoom-in">
                    <Database className="w-2.5 h-2.5" /> From Cache
                  </div>
                )}
                {wasAutoCopied && (
                  <div className="flex items-center gap-1 px-2 py-0.5 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-[9px] font-bold rounded-full animate-in zoom-in">
                    <Sparkles className="w-2.5 h-2.5" /> Auto-copied
                  </div>
                )}
                <button
                  onClick={() => setExtractedData(null)}
                  className="text-slate-300 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <h2 className="font-bold text-slate-800 dark:text-white leading-tight pr-12 text-sm tracking-tight mb-4">
                {extractedData.title}
              </h2>
              <div className="flex flex-wrap gap-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 px-2.5 py-1 rounded-full">
                  <Clock className="w-3 h-3 text-blue-500" />
                  {stats.time} Min
                </div>
                <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 px-2.5 py-1 rounded-full">
                  <Hash className="w-3 h-3 text-indigo-500" />
                  {stats.words} Words
                </div>
                <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 px-2.5 py-1 rounded-full">
                  <ExternalLink className="w-3 h-3 text-emerald-500" />
                  {extractedData.siteName}
                </div>
              </div>
            </div>

            {/* Preview Box */}
            <div className="relative group">
              <div className="mb-2 flex items-center justify-between gap-2 text-[10px] font-semibold text-slate-500">
                <span>
                  Preview {format === "MD" ? "Markdown" : "Plain Text"}
                </span>
                <span>
                  {copied ? "Tersalin" : "Copy, download, atau kirim ke AI"}
                </span>
              </div>
              <textarea
                readOnly
                className="w-full h-[min(20rem,42vh)] min-h-56 bg-slate-100 dark:bg-slate-900/50 border-none rounded-3xl p-5 text-xs font-mono text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-blue-500/20 resize-none transition-all scrollbar-thin leading-relaxed"
                value={
                  format === "MD"
                    ? extractedData.content
                    : extractedData.textContent
                }
              />
              <div className="absolute top-10 right-4 flex flex-col gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all duration-300 sm:translate-x-2 sm:group-hover:translate-x-0">
                <button
                  onClick={handleAskAI}
                  className="p-3 bg-indigo-600 text-white shadow-xl rounded-2xl hover:bg-indigo-700 transition-all active:scale-90"
                  title="Ask AI Summary"
                >
                  <BrainCircuit className="w-5 h-5 fill-white/20" />
                </button>
                <button
                  onClick={handleCopy}
                  className="p-3 bg-white/95 dark:bg-slate-800/95 shadow-xl rounded-2xl hover:bg-white transition-all border border-slate-200 dark:border-slate-700 active:scale-90"
                  title="Copy"
                >
                  {copied ? (
                    <Check className="w-5 h-5 text-green-500" />
                  ) : (
                    <Copy className="w-5 h-5" />
                  )}
                </button>
                <button
                  onClick={handleDownload}
                  className="p-3 bg-white/95 dark:bg-slate-800/95 shadow-xl rounded-2xl hover:bg-white transition-all border border-slate-200 dark:border-slate-700 active:scale-90"
                  title="Download"
                >
                  <Download className="w-5 h-5 text-blue-500" />
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer Actions */}
      {!showSettings && !showHistory && extractedData && (
        <footer className="p-5 border-t border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md flex gap-3 animate-in slide-in-from-bottom-6 duration-700">
          <button
            onClick={handleFullExtract}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-bold shadow-lg shadow-blue-600/20 active:scale-95"
          >
            <Zap className="w-4 h-4 fill-white" /> Whole Page
          </button>
          <button
            onClick={handleAskAI}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold shadow-lg shadow-indigo-600/20 active:scale-95"
          >
            <MessageSquare className="w-4 h-4 fill-white/20" /> Summarize with
            AI
          </button>
        </footer>
      )}
    </div>
  );
}

export default App;
