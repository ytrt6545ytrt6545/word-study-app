import AsyncStorage from "@react-native-async-storage/async-storage";

import { joinTagPath, normalizeTagPath, parseTagPath } from "./storage";

// 文章資料模組：統一管理收藏文章、標籤與重點標記的讀寫與資料清洗邏輯。
// 主要責任：
// - 提供 CRUD API 讓閱讀頁與收藏庫操作文章資料。
// - 確保匯入備份或外部來源時，欄位皆符合 `Article` 型別與時間戳格式。
// - 維護標籤層級（含自訂排序）及 highlights 內容，避免 AsyncStorage 內出現不合法資料。

const ARTICLES_KEY = "@halo_articles";
const ARTICLE_TAGS_KEY = "@halo_article_tags";
const ARTICLE_TAG_ORDER_KEY = "@halo_article_tag_order";

export type ArticleStatus = "new" | "reading" | "processed" | "archived";
export type ArticleSourceType = "manual" | "file" | "web" | "ai" | "other";

export type ArticleHighlight = {
  id: string;
  text: string;
  note?: string;
  linkedWords?: string[];
};

export type Article = {
  id: string;
  title: string;
  sourceType: ArticleSourceType;
  sourceRef: string | null;
  rawText: string;
  summary: string | null;
  tags: string[];
  status: ArticleStatus;
  createdAt: string;
  updatedAt: string;
  highlights: ArticleHighlight[];
};

export type ArticleDraft = {
  title?: string | null;
  sourceType?: ArticleSourceType | null;
  sourceRef?: string | null;
  rawText?: string | null;
  summary?: string | null;
  tags?: string[] | null;
  status?: ArticleStatus | null;
  highlights?: ArticleHighlightInput[] | null;
};

export type ArticlePatch = Partial<Omit<Article, "id" | "createdAt" | "updatedAt">> & {
  highlights?: ArticleHighlightInput[] | null;
};

export type ArticleHighlightInput = {
  id?: string;
  text?: string | null;
  note?: string | null;
  linkedWords?: string[] | null;
};

export type ArticleTagOrder = Record<string, string[]>;

const ARTICLE_STATUS_SET = new Set<ArticleStatus>(["new", "reading", "processed", "archived"]);

function nowIso(): string {
  return new Date().toISOString();
}

function toIsoOrFallback(value: unknown, fallback: string): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed && !Number.isNaN(Date.parse(trimmed))) {
      return new Date(trimmed).toISOString();
    }
  }
  return fallback;
}

function sanitizeTitle(value: unknown): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return "Untitled article";
}

function sanitizeSourceType(value: unknown): ArticleSourceType {
  if (typeof value === "string") {
    const lower = value.toLowerCase();
    if (lower === "manual" || lower === "file" || lower === "web" || lower === "ai") {
      return lower as ArticleSourceType;
    }
  }
  return "other";
}

function sanitizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function sanitizeRawText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value == null) return "";
  return String(value);
}

function generateId(prefix: string): string {
  const cryptoObj = (globalThis as any)?.crypto;
  if (cryptoObj && typeof cryptoObj.randomUUID === "function") {
    return cryptoObj.randomUUID();
  }
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}-${random}`;
}

function normalizeLinkedWords(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out: string[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const trimmed = entry.trim();
    if (!trimmed) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out.length > 0 ? out : undefined;
}

function normalizeHighlight(raw: ArticleHighlightInput | ArticleHighlight | null | undefined): ArticleHighlight | null {
  if (!raw) return null;
  const text = sanitizeOptionalString("text" in raw ? raw.text : undefined) ?? "";
  if (!text) return null;
  const id =
    sanitizeOptionalString("id" in raw ? raw.id : undefined) ?? generateId("highlight");
  const note = sanitizeOptionalString(raw.note);
  const linkedWords = normalizeLinkedWords(raw.linkedWords);
  return {
    id,
    text,
    ...(note ? { note } : {}),
    ...(linkedWords ? { linkedWords } : {}),
  };
}

function normalizeHighlights(value: unknown): ArticleHighlight[] {
  if (!Array.isArray(value)) return [];
  const out: ArticleHighlight[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const normalized = normalizeHighlight(item as ArticleHighlightInput);
    if (!normalized) continue;
    if (seen.has(normalized.id)) continue;
    seen.add(normalized.id);
    out.push(normalized);
  }
  return out;
}

function ensureArticleTags(input: unknown): string[] {
  const map = new Map<string, string>();
  const add = (value: string) => {
    const key = value.toLowerCase();
    if (!map.has(key)) map.set(key, value);
  };
  if (!Array.isArray(input)) return [];
  for (const raw of input) {
    if (typeof raw !== "string") continue;
    const norm = normalizeTagPath(raw);
    if (!norm) continue;
    const segments = parseTagPath(norm);
    for (let i = 1; i <= segments.length; i += 1) {
      add(joinTagPath(segments.slice(0, i)));
    }
  }
  return Array.from(map.values());
}

// 將外部輸入的文章資料補齊預設值並矯正欄位格式，確保儲存在本地端的資料一致。
// 此函式會：
// - 修正時間戳（createdAt/updatedAt）為 ISO 字串。
// - 過濾空白標題、來源資訊與 highlight 無效欄位。
// - 針對 highlights/ tags 做去重與排序，以避免前端顯示例外狀況。
function normalizeArticle(raw: any): Article {
  const now = nowIso();
  const createdAt = toIsoOrFallback(raw?.createdAt, now);
  const updatedAt = toIsoOrFallback(raw?.updatedAt, createdAt);
  const highlights = normalizeHighlights(raw?.highlights);
  const tags = ensureArticleTags(raw?.tags);
  const summary = sanitizeOptionalString(raw?.summary);
  const sourceRef = sanitizeOptionalString(raw?.sourceRef);

  return {
    id: sanitizeOptionalString(raw?.id) ?? generateId("article"),
    title: sanitizeTitle(raw?.title),
    sourceType: sanitizeSourceType(raw?.sourceType),
    sourceRef,
    rawText: sanitizeRawText(raw?.rawText),
    summary,
    tags,
    status: ARTICLE_STATUS_SET.has(raw?.status) ? (raw.status as ArticleStatus) : "new",
    createdAt,
    updatedAt,
    highlights,
  };
}

async function writeArticles(list: Article[]): Promise<void> {
  await AsyncStorage.setItem(ARTICLES_KEY, JSON.stringify(list));
}

// 從 AsyncStorage 讀取整份文章清單，並逐筆正規化回程式可用的型別。
export async function loadArticles(): Promise<Article[]> {
  const raw = await AsyncStorage.getItem(ARTICLES_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error("Article payload is not an array.");
    }
    const normalized = parsed.map((item) => normalizeArticle(item));
    await writeArticles(normalized);
    return normalized;
  } catch {
    await writeArticles([]);
    return [];
  }
}

export async function saveArticles(list: Article[]): Promise<void> {
  const normalized = list.map((item) => normalizeArticle(item));
  await writeArticles(normalized);
}

// 建立新文章時會套用預設欄位、生成 ID 與時間戳後再寫入本地存放。
// 透過 normalizeArticle 確保每個欄位（含 highlights）皆符合前端預期結構。
export async function createArticle(draft: ArticleDraft): Promise<Article> {
  const now = nowIso();
  const base: Article = normalizeArticle({
    ...draft,
    id: generateId("article"),
    createdAt: now,
    updatedAt: now,
    status: draft.status ?? "new",
  });
  const existing = await loadArticles();
  const next = [base, ...existing];
  await writeArticles(next);
  return base;
}

// 更新既有文章，僅接受補丁欄位並保留原始建立時間。
// mutateArticle 會先載入最新清單，再以 normalizeArticle 防止 partial patch 產生非法資料。
export async function updateArticle(id: string, patch: ArticlePatch): Promise<Article | null> {
  const existing = await loadArticles();
  const idx = existing.findIndex((item) => item.id === id);
  if (idx < 0) return null;
  const current = existing[idx];
  const nextArticle = normalizeArticle({
    ...current,
    ...patch,
    highlights: patch.highlights ?? current.highlights,
    tags: patch.tags ?? current.tags,
    updatedAt: nowIso(),
    id: current.id,
    createdAt: current.createdAt,
  });
  const next = [...existing];
  next[idx] = nextArticle;
  await writeArticles(next);
  return nextArticle;
}

// 刪除文章會直接重寫整份清單，成功時回傳 true 以便 UI 更新。
export async function deleteArticle(id: string): Promise<boolean> {
  const existing = await loadArticles();
  const next = existing.filter((item) => item.id !== id);
  if (next.length === existing.length) return false;
  await writeArticles(next);
  return true;
}

export async function getArticleById(id: string): Promise<Article | null> {
  const list = await loadArticles();
  return list.find((item) => item.id === id) ?? null;
}

// 取得文章標籤並過濾空值、重複項，確保介面不會顯示髒資料。
export async function loadArticleTags(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(ARTICLE_TAGS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    const normalized = ensureArticleTags(parsed);
    await AsyncStorage.setItem(ARTICLE_TAGS_KEY, JSON.stringify(normalized));
    return normalized;
  } catch {
    await AsyncStorage.setItem(ARTICLE_TAGS_KEY, JSON.stringify([]));
    return [];
  }
}

export async function saveArticleTags(tags: string[]): Promise<string[]> {
  const normalized = ensureArticleTags(tags);
  await AsyncStorage.setItem(ARTICLE_TAGS_KEY, JSON.stringify(normalized));
  return normalized;
}

export async function loadArticleTagOrder(): Promise<ArticleTagOrder> {
  const raw = await AsyncStorage.getItem(ARTICLE_TAG_ORDER_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") throw new Error("invalid");
    const normalized: ArticleTagOrder = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof key !== "string" || !Array.isArray(value)) continue;
      const allowed: string[] = [];
      for (const rawEntry of value) {
        if (typeof rawEntry !== "string") continue;
        const norm = normalizeTagPath(rawEntry);
        if (norm) allowed.push(norm);
      }
      normalized[key] = allowed;
    }
    await AsyncStorage.setItem(ARTICLE_TAG_ORDER_KEY, JSON.stringify(normalized));
    return normalized;
  } catch {
    await AsyncStorage.setItem(ARTICLE_TAG_ORDER_KEY, JSON.stringify({}));
    return {};
  }
}

export async function saveArticleTagOrder(order: ArticleTagOrder): Promise<void> {
  const normalized: ArticleTagOrder = {};
  for (const [key, list] of Object.entries(order)) {
    if (typeof key !== "string" || !Array.isArray(list)) continue;
    const clean: string[] = [];
    const seen = new Set<string>();
    for (const entry of list) {
      if (typeof entry !== "string") continue;
      const norm = normalizeTagPath(entry);
      if (!norm || seen.has(norm)) continue;
      seen.add(norm);
      clean.push(norm);
    }
    normalized[key] = clean;
  }
  await AsyncStorage.setItem(ARTICLE_TAG_ORDER_KEY, JSON.stringify(normalized));
}

async function mutateArticle(
  id: string,
  mutator: (article: Article) => Article | null
): Promise<Article | null> {
  const existing = await loadArticles();
  const idx = existing.findIndex((item) => item.id === id);
  if (idx < 0) return null;
  const current = existing[idx];
  const mutated = mutator(current);
  if (!mutated) return null;
  const nextArticle = normalizeArticle({
    ...mutated,
    id: current.id,
    createdAt: current.createdAt,
    updatedAt: nowIso(),
  });
  const next = [...existing];
  next[idx] = nextArticle;
  await writeArticles(next);
  return nextArticle;
}

export async function addArticleHighlight(
  articleId: string,
  input: ArticleHighlightInput
): Promise<Article | null> {
  const normalized = normalizeHighlight({ ...input });
  if (!normalized) {
    throw new Error("Highlight text is required.");
  }
  return mutateArticle(articleId, (article) => ({
    ...article,
    highlights: [...article.highlights, normalized],
  }));
}

export async function updateArticleHighlight(
  articleId: string,
  highlightId: string,
  patch: ArticleHighlightInput
): Promise<Article | null> {
  return mutateArticle(articleId, (article) => {
    const idx = article.highlights.findIndex((h) => h.id === highlightId);
    if (idx < 0) return null;
    const current = article.highlights[idx];
    const nextHighlight = normalizeHighlight({
      ...current,
      ...patch,
      id: current.id,
    });
    if (!nextHighlight) return null;
    const highlights = [...article.highlights];
    highlights[idx] = nextHighlight;
    return { ...article, highlights };
  });
}

export async function removeArticleHighlight(
  articleId: string,
  highlightId: string
): Promise<Article | null> {
  return mutateArticle(articleId, (article) => {
    const nextHighlights = article.highlights.filter((h) => h.id !== highlightId);
    if (nextHighlights.length === article.highlights.length) return null;
    return { ...article, highlights: nextHighlights };
  });
}
