import AsyncStorage from "@react-native-async-storage/async-storage";
import { defaultSrs, SrsState, updateSrs } from "./srs";

// 儲存層核心模組：負責標籤階層、SRS 計算、每日限制與偏好設定等資料操作。
// 職責說明：
// - 提供統一的 AsyncStorage key 與存取函式，減少頁面直接操作原生 API 的風險。
// - 維護標籤的階層結構（parse/join/normalize）與排序規則，供收藏庫與測驗等功能使用。
// - 處理 SRS 寫入、每日練習限制、單字增刪編等高頻邏輯，確保其他模組透過這裡的介面即可完成資料更新。

// ---- Hierarchical tag helpers (path string, max 3 levels) ----
export const TAG_DELIM = ">"; // display as: A > B > C

export type TagNode = {
  name: string;
  path: string; // normalized full path, e.g., "A > B"
  children?: TagNode[];
};

export function parseTagPath(input: string): string[] {
  const raw = (input || "").trim();
  if (!raw) return [];
  return raw.split(TAG_DELIM).map((s) => s.trim()).filter(Boolean);
}

export function joinTagPath(parts: string[]): string {
  return parts.join(` ${TAG_DELIM} `);
}

export function isValidTagSegment(seg: string): boolean {
  if (!seg) return false;
  return !seg.includes(TAG_DELIM);
}

export function normalizeTagPath(path: string): string | null {
  const parts = parseTagPath(path);
  if (parts.length === 0) return null;
  if (parts.length > 3) return null;
  for (const p of parts) if (!isValidTagSegment(p)) return null;
  return joinTagPath(parts);
}

export function pathStartsWith(childPath: string, parentPath: string): boolean {
  const c = normalizeTagPath(childPath);
  const p = normalizeTagPath(parentPath);
  if (!c || !p) return false;
  if (c === p) return true;
  return c.startsWith(p + ` ${TAG_DELIM} `);
}

// 將平面化的路徑字串轉成樹狀結構，供 UI 顯示標籤階層（含最多三層的巢狀節點）。
// 系統保留標籤（REVIEW/EXAM）不會出現在樹形結構中，避免被使用者拖曳。
export function buildTagTree(paths: string[]): TagNode[] {
  const root: Map<string, any> = new Map();
  for (const raw of paths) {
    // System tags are kept flat; skip in tree
    if (raw === REVIEW_TAG || raw === EXAM_TAG) continue;
    const norm = normalizeTagPath(raw);
    if (!norm) continue;
    const parts = parseTagPath(norm);
    let cur = root;
    let acc: string[] = [];
    for (const part of parts) {
      acc.push(part);
      const key = part;
      if (!cur.has(key)) cur.set(key, { __path: joinTagPath(acc), __children: new Map() });
      cur = cur.get(key).__children;
    }
  }
  const toNodes = (m: Map<string, any>): TagNode[] =>
    Array.from(m.entries())
      .map(([name, val]) => ({ name, path: val.__path, children: toNodes(val.__children) }));
  return toNodes(root);
}

// ----- Tag order persistence (for sibling order & drag-move) -----
const TAG_ORDER_KEY = "@halo_tag_order";
export type TagOrder = Record<string, string[]>; // parentPath("") -> [childName, ...]

export async function loadTagOrder(): Promise<TagOrder> {
  try {
    const raw = await AsyncStorage.getItem(TAG_ORDER_KEY);
    if (!raw) return {};
    const obj = JSON.parse(raw);
    if (obj && typeof obj === 'object') return obj as TagOrder;
  } catch {}
  return {};
}
export async function saveTagOrder(order: TagOrder): Promise<void> {
  await AsyncStorage.setItem(TAG_ORDER_KEY, JSON.stringify(order));
}

function parentOf(path: string): string {
  const parts = parseTagPath(path);
  if (parts.length <= 1) return "";
  return joinTagPath(parts.slice(0, parts.length - 1));
}
function nameOf(path: string): string {
  const parts = parseTagPath(path);
  return parts[parts.length - 1] || "";
}

function sortByOrder(children: TagNode[] | undefined, parentPath: string, order: TagOrder): TagNode[] | undefined {
  if (!children || children.length === 0) return children;
  const rule = order[parentPath] || [];
  const idx = new Map<string, number>();
  rule.forEach((n, i) => idx.set(n, i));
  const named = [...children];
  named.sort((a, b) => {
    const ia = idx.has(a.name) ? (idx.get(a.name) as number) : Number.MAX_SAFE_INTEGER;
    const ib = idx.has(b.name) ? (idx.get(b.name) as number) : Number.MAX_SAFE_INTEGER;
    if (ia !== ib) return ia - ib;
    return a.name.localeCompare(b.name);
  });
  return named;
}

// 根據儲存在 AsyncStorage 的排序資訊（TagOrder）重建樹狀節點的兄弟順序，拖曳操作亦依此更新。
export function applyOrderToTree(nodes: TagNode[], parentPath: string, order: TagOrder): TagNode[] {
  const sorted = sortByOrder(nodes, parentPath, order) || [];
  return sorted.map((node) => ({
    ...node,
    children: applyOrderToTree(node.children || [], node.path, order),
  }));
}

export async function buildOrderedTagTree(paths: string[]): Promise<TagNode[]> {
  const tree = buildTagTree(paths);
  const order = await loadTagOrder();
  return applyOrderToTree(tree, "", order);
}

// System-reserved tag name for review (avoid deletion/rename)
export const REVIEW_TAG = "\u8907\u7fd2"; // 複習
export const EXAM_TAG = "\u8003\u8a66"; // 考試
const SYSTEM_TAGS = new Set([REVIEW_TAG, EXAM_TAG]);
const LEGACY_REVIEW_TAGS = new Set([REVIEW_TAG]);
const LEGACY_EXAM_TAGS = new Set([EXAM_TAG, "\\u8003\\u8a66"]);

function normalizeSystemTagName(name: string): string {
  if (LEGACY_REVIEW_TAGS.has(name)) return REVIEW_TAG;
  if (LEGACY_EXAM_TAGS.has(name)) return EXAM_TAG;
  return name;
}

const UNICODE_ESCAPE_RE = /\\[uU]([0-9a-fA-F]{4})/g;

const decodeUnicodeEscapes = (value: string): string => {
  if (!value) return value;
  if (!value.includes("\\u") && !value.includes("\\U")) return value;
  return value.replace(UNICODE_ESCAPE_RE, (_, hex: string) => {
    const code = Number.parseInt(hex, 16);
    return Number.isNaN(code) ? `\\u${hex}` : String.fromCharCode(code);
  });
};

const normalizeRequiredText = (value: any): string => {
  if (typeof value !== "string") return "";
  return decodeUnicodeEscapes(value);
};

const normalizeOptionalText = <T extends string | undefined>(value: any): T => {
  if (typeof value !== "string") return undefined as T;
  return decodeUnicodeEscapes(value) as T;
};

export type WordStatus = "unknown" | "learning" | "mastered";
export type Word = {
  en: string;
  zh: string;
  exampleEn?: string;
  exampleZh?: string;
  phonetic?: string;
  note?: string;
  status: WordStatus;
  createdAt?: string;
  reviewCount?: number;
  lastReviewedAt?: string;
  tags?: string[];
  // SRS fields (SM-2 lite)
  srsEase?: number;
  srsInterval?: number; // days
  srsReps?: number;
  srsLapses?: number;
  srsDue?: string; // ISO
};

const STORAGE_KEY = "@halo_words";
const TAGS_KEY = "@halo_tags";
const SRS_LIMITS_KEY = "@srs_limits";
const PREF_WORD_FONT_SIZE_KEY = "@pref_word_font_size";

export async function loadWords(): Promise<Word[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  const nowIso = new Date().toISOString();
  if (!raw) {
    const initial: Word[] = [
      { en: "apple", zh: "\u860B\u679C", status: "learning", createdAt: nowIso, reviewCount: 0, tags: [] },
      { en: "book", zh: "\u66F8\u672C", status: "unknown", createdAt: nowIso, reviewCount: 0, tags: [] },
      { en: "cat", zh: "\u8C93", status: "mastered", createdAt: nowIso, reviewCount: 0, tags: [] },
    ];
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    return initial;
  }
  const parsed: Word[] = JSON.parse(raw);
  // migration + normalization
  const migrated = parsed.map((w) => {
    const rawTags = Array.isArray((w as any).tags) ? (w as any).tags : [];
    const tagsSet = new Set<string>();
    for (const t of rawTags) {
      if (typeof t !== "string") continue;
      const name = (t || "").trim();
      if (!name) continue;
      tagsSet.add(normalizeSystemTagName(name));
    }
    const tags = Array.from(tagsSet);
    const base: Word = {
      ...w,
      en: normalizeRequiredText((w as any).en),
      zh: normalizeRequiredText((w as any).zh),
      exampleEn: normalizeOptionalText<string | undefined>((w as any).exampleEn),
      exampleZh: normalizeOptionalText<string | undefined>((w as any).exampleZh),
      phonetic: normalizeOptionalText<string | undefined>((w as any).phonetic),
      note: normalizeOptionalText<string | undefined>((w as any).note),
      createdAt: (w as any).createdAt || nowIso,
      reviewCount: typeof (w as any).reviewCount === "number" ? (w as any).reviewCount : 0,
      tags,
    } as Word;
    const hasReview = (base.tags || []).includes(REVIEW_TAG);
    const ease = typeof (base as any).srsEase === "number" ? (base as any).srsEase : 2.5;
    const interval = typeof (base as any).srsInterval === "number" ? (base as any).srsInterval : 0;
    const reps = typeof (base as any).srsReps === "number" ? (base as any).srsReps : 0;
    const lapses = typeof (base as any).srsLapses === "number" ? (base as any).srsLapses : 0;
    const dueMs = (base as any).srsDue ? Date.parse((base as any).srsDue) : (hasReview ? Date.now() : NaN);
    const srsDueIso = isNaN(dueMs) ? undefined : new Date(dueMs).toISOString();
    return { ...base, srsEase: ease, srsInterval: interval, srsReps: reps, srsLapses: lapses, srsDue: srsDueIso } as Word;
  });
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
  return migrated;
}

export async function saveWords(words: Word[]) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(words));
}

// review counter + status auto upgrade
export async function bumpReview(en: string, windowMs = 120_000): Promise<Word | null> {
  const list = await loadWords();
  const idx = list.findIndex((w) => w.en.toLowerCase() === (en || "").toLowerCase());
  if (idx < 0) return null;
  const now = Date.now();
  const last = list[idx].lastReviewedAt ? Date.parse(list[idx].lastReviewedAt!) : 0;
  if (now - last < windowMs) return list[idx];
  const current = list[idx];
  const nextCount = (current.reviewCount || 0) + 1;
  let nextStatus: WordStatus = current.status;
  if (nextCount > 30) nextStatus = "mastered";
  else if (nextCount > 15 && current.status === "unknown") nextStatus = "learning";
  const next: Word = { ...current, status: nextStatus, reviewCount: nextCount, lastReviewedAt: new Date(now).toISOString() };
  const updated = [...list];
  updated[idx] = next;
  await saveWords(updated);
  return next;
}

// Tags storage
export async function loadTags(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(TAGS_KEY);
  if (!raw) return [REVIEW_TAG, EXAM_TAG];
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) {
      const set = new Set<string>();
      for (const it of arr) {
        if (typeof it !== "string") continue;
        const cleaned = (it || "").trim();
        if (!cleaned) continue;
        const mapped = normalizeSystemTagName(cleaned);
        if (SYSTEM_TAGS.has(mapped)) { set.add(mapped); continue; }
        const norm = normalizeTagPath(mapped);
        if (norm) set.add(norm);
      }
      set.add(REVIEW_TAG);
      set.add(EXAM_TAG);
      return Array.from(set);
    }
  } catch {}
  return [REVIEW_TAG, EXAM_TAG];
}

export async function saveTags(tags: string[]) {
  const normSet = new Set<string>();
  for (const t of tags) {
    const cleanedRaw = (t || "").trim();
    if (!cleanedRaw) continue;
    const cleaned = normalizeSystemTagName(cleanedRaw);
    if (SYSTEM_TAGS.has(cleaned)) { normSet.add(cleaned); continue; }
    const norm = normalizeTagPath(cleaned);
    if (norm) normSet.add(norm);
  }
  // ensure system tags always present
  normSet.add(REVIEW_TAG);
  normSet.add(EXAM_TAG);
  const finalTags = Array.from(normSet);
  await AsyncStorage.setItem(TAGS_KEY, JSON.stringify(finalTags));
}

export async function addTag(tag: string): Promise<string[]> {
  const name = (tag || "").trim();
  if (!name) return loadTags();
  const mapped = normalizeSystemTagName(name);
  if (SYSTEM_TAGS.has(mapped)) return loadTags();
  const norm = normalizeTagPath(mapped);
  if (!norm) return loadTags();
  const list = await loadTags();
  const set = new Set(list);
  const parts = parseTagPath(norm);
  for (let i = 1; i <= parts.length; i++) {
    set.add(joinTagPath(parts.slice(0, i)));
  }
  // update order: append child into its parent order if missing
  const parent = parts.length > 1 ? joinTagPath(parts.slice(0, parts.length - 1)) : "";
  const childName = parts[parts.length - 1];
  const order = await loadTagOrder();
  const arr = Array.isArray(order[parent]) ? order[parent] : [];
  if (!arr.includes(childName)) arr.push(childName);
  order[parent] = arr;
  await saveTagOrder(order);
  await saveTags(Array.from(set));
  return loadTags();
}

export async function setWordTags(en: string, tags: string[]): Promise<Word | null> {
  const list = await loadWords();
  const idx = list.findIndex((w) => w.en.toLowerCase() === (en || "").toLowerCase());
  if (idx < 0) return null;
  const normSet = new Set<string>();
  for (const raw of tags || []) {
    const cleanedRaw = (raw || "").trim();
    if (!cleanedRaw) continue;
    const cleaned = normalizeSystemTagName(cleanedRaw);
    if (SYSTEM_TAGS.has(cleaned)) { normSet.add(cleaned); continue; }
    const norm = normalizeTagPath(cleaned);
    if (norm) normSet.add(norm);
  }
  const norm = Array.from(normSet);
  const updated: Word = { ...list[idx], tags: norm };
  const next = [...list];
  next[idx] = updated;
  await saveWords(next);
  return updated;
}

export async function toggleWordTag(en: string, tag: string, enabled: boolean): Promise<Word | null> {
  const list = await loadWords();
  const idx = list.findIndex((w) => w.en.toLowerCase() === (en || "").toLowerCase());
  if (idx < 0) return null;
  const current = list[idx];
  const curTags = Array.isArray(current.tags) ? current.tags : [];
  const rawName = (tag || "").trim();
  const mapped = normalizeSystemTagName(rawName);
  const target = SYSTEM_TAGS.has(mapped) ? mapped : (normalizeTagPath(mapped) || "");
  if (!target) return current;
  const nextTags = new Set(
    curTags
      .map((t) => {
        const cleaned = normalizeSystemTagName((t || "").trim());
        if (!cleaned) return "";
        if (SYSTEM_TAGS.has(cleaned)) return cleaned;
        return normalizeTagPath(cleaned) || "";
      })
      .filter(Boolean)
  );
  if (enabled) nextTags.add(target); else nextTags.delete(target);
  let updated: Word = { ...current, tags: Array.from(nextTags) };
  if (enabled && target === REVIEW_TAG) {
    const now = Date.now();
    updated = {
      ...updated,
      srsEase: typeof updated.srsEase === "number" ? updated.srsEase : 2.5,
      srsInterval: typeof updated.srsInterval === "number" ? updated.srsInterval : 0,
      srsReps: typeof updated.srsReps === "number" ? updated.srsReps : 0,
      srsLapses: typeof updated.srsLapses === "number" ? updated.srsLapses : 0,
      srsDue: updated.srsDue || new Date(now).toISOString(),
    };
  }
  const next = [...list];
  next[idx] = updated;
  await saveWords(next);
  return updated;
}

export async function removeTag(tag: string): Promise<string[]> {
  const name = (tag || "").trim();
  const mapped = normalizeSystemTagName(name);
  if (SYSTEM_TAGS.has(mapped) || !mapped) return loadTags();
  const norm = normalizeTagPath(mapped);
  if (!norm) return loadTags();
  const currentTags = await loadTags();
  const nextTags = currentTags.filter((t) => t !== norm);
  await saveTags(nextTags);
  const words = await loadWords();
  let dirty = false;
  const updated = words.map((w) => {
    const wt = Array.isArray(w.tags) ? w.tags : [];
    const filtered = wt.filter((t) => t !== norm);
    if (filtered.length !== wt.length) { dirty = true; return { ...w, tags: filtered } as Word; }
    return w;
  });
  if (dirty) await saveWords(updated);
  // update order: remove from its parent list
  const p = parentOf(norm);
  const n = nameOf(norm);
  const order = await loadTagOrder();
  if (Array.isArray(order[p])) {
    order[p] = order[p].filter((x) => x !== n);
    await saveTagOrder(order);
  }
  return nextTags;
}

export async function removeTags(tags: string[]): Promise<string[]> {
  const set = new Set((tags || []).map((t) => (t || "").trim()).filter(Boolean));
  set.delete(REVIEW_TAG);
  set.delete(EXAM_TAG);
  if (set.size === 0) return loadTags();
  const currentTags = await loadTags();
  const normalized = new Set<string>();
  for (const t of set) {
    const n = normalizeTagPath(t);
    if (n) normalized.add(n);
  }
  const nextTags = currentTags.filter((t) => !normalized.has(t));
  await saveTags(nextTags);
  const words = await loadWords();
  let dirty = false;
  const updated = words.map((w) => {
    const wt = Array.isArray(w.tags) ? w.tags : [];
    const filtered = wt.filter((t) => !normalized.has((normalizeTagPath(t || "") || "")));
    if (filtered.length !== wt.length) { dirty = true; return { ...w, tags: filtered } as Word; }
    return w;
  });
  if (dirty) await saveWords(updated);
  return nextTags;
}

export async function renameTag(oldName: string, newName: string): Promise<string[]> {
  const from = (oldName || "").trim();
  const to = (newName || "").trim();
  if (SYSTEM_TAGS.has(from) || !from || !to || from === to) return loadTags();
  const fromNorm = normalizeTagPath(from);
  const toNorm = normalizeTagPath(to);
  if (!fromNorm || !toNorm) return loadTags();
  const words = await loadWords();
  let dirty = false;
  const updated = words.map((w) => {
    const wt = Array.isArray(w.tags) ? w.tags : [];
    if (!wt.includes(fromNorm) && !wt.includes(toNorm)) return w;
    const nextSet = new Set<string>(wt.map((t) => (normalizeTagPath(t || "") || "")).filter(Boolean));
    if (nextSet.has(fromNorm)) { dirty = true; nextSet.delete(fromNorm); nextSet.add(toNorm); }
    return { ...w, tags: Array.from(nextSet) } as Word;
  });
  if (dirty) await saveWords(updated);
  const currentTags = await loadTags();
  const set = new Set(currentTags);
  set.delete(fromNorm); set.add(toNorm);
  const nextTags = Array.from(set);
  await saveTags(nextTags);
  // update order: rename within same parent (no subtree)
  const fp = parentOf(fromNorm);
  const fn = nameOf(fromNorm);
  const tp = parentOf(toNorm);
  const tn = nameOf(toNorm);
  const order = await loadTagOrder();
  if (fp === tp && Array.isArray(order[fp])) {
    order[fp] = order[fp].map((x) => (x === fn ? tn : x));
    await saveTagOrder(order);
  }
  return nextTags;
}

// Subtree operations for hierarchical tags
export async function removeTagSubtree(tag: string): Promise<string[]> {
  const base = normalizeTagPath(tag || "");
  if (!base || SYSTEM_TAGS.has(base)) return loadTags();

  // 1. Read all data first
  const [currentTags, words, order] = await Promise.all([
    loadTags(),
    loadWords(),
    loadTagOrder(),
  ]);

  // 2. Calculate next state
  const nextTags = currentTags.filter((t) => !(t === base || pathStartsWith(t, base)));
  
  let dirtyWords = false;
  const updatedWords = words.map((w) => {
    const wt = Array.isArray(w.tags) ? w.tags : [];
    if (wt.length === 0) return w;
    const filtered = wt.filter((t) => {
      const n = normalizeTagPath(t || "");
      return !(n && (n === base || pathStartsWith(n, base)));
    });
    if (filtered.length !== wt.length) {
      dirtyWords = true;
      return { ...w, tags: filtered };
    }
    return w;
  });

  const p = parentOf(base);
  const n = nameOf(base);
  let orderChanged = false;
  const nextOrder = { ...order };
  if (Array.isArray(nextOrder[p])) {
    const originalLength = nextOrder[p].length;
    nextOrder[p] = nextOrder[p].filter((x) => x !== n);
    if (nextOrder[p].length !== originalLength) {
      orderChanged = true;
    }
  }

  // 3. Write all data at the end
  const promises: Promise<any>[] = [saveTags(nextTags)];
  if (dirtyWords) {
    promises.push(saveWords(updatedWords));
  }
  if (orderChanged) {
    promises.push(saveTagOrder(nextOrder));
  }
  
  await Promise.all(promises);
  
  return nextTags;
}

export async function renameTagSubtree(from: string, to: string): Promise<string[]> {
  const src = normalizeTagPath(from || "");
  const dst = normalizeTagPath(to || "");
  if (!src || !dst || src === REVIEW_TAG || src === EXAM_TAG) return loadTags();
  const currentTags = await loadTags();
  const remapped = new Set<string>();
  for (const t of currentTags) {
    if (t === REVIEW_TAG) { remapped.add(REVIEW_TAG); continue; }
    if (t === src || pathStartsWith(t, src)) {
      const suffix = t.slice(src.length);
      const candidate = (dst + suffix).trim();
      const norm = normalizeTagPath(candidate);
      if (norm) remapped.add(norm);
    } else {
      const norm = normalizeTagPath(t);
      if (norm) remapped.add(norm);
    }
  }
  const nextTags = Array.from(remapped);
  await saveTags(nextTags);

  const words = await loadWords();
  let dirty = false;
  const updated = words.map((w) => {
    const wt = Array.isArray(w.tags) ? w.tags : [];
    const nextSet = new Set<string>();
    for (const t of wt) {
      const n = normalizeTagPath(t || "");
      if (!n) continue;
      if (n === src || pathStartsWith(n, src)) {
        const suffix = n.slice(src.length);
        const candidate = (dst + suffix).trim();
        const nn = normalizeTagPath(candidate);
        if (nn) { nextSet.add(nn); dirty = true; }
      } else {
        nextSet.add(n);
      }
    }
    return { ...w, tags: Array.from(nextSet) } as Word;
  });
  if (dirty) await saveWords(updated);
  // order: move child from old parent list to new parent list (rename last segment if changed)
  const srcP = parentOf(src);
  const srcN = nameOf(src);
  const dstP = parentOf(dst);
  const dstN = nameOf(dst);
  const order = await loadTagOrder();
  if (Array.isArray(order[srcP])) {
    order[srcP] = order[srcP].filter((x) => x !== srcN);
  }
  const dstArr = Array.isArray(order[dstP]) ? order[dstP] : [];
  if (!dstArr.includes(dstN)) dstArr.push(dstN);
  order[dstP] = dstArr;
  await saveTagOrder(order);
  return nextTags;
}

// Copy a subtree from `from` to `to` (keep original; merge tags; add tags to words additionally)
export async function copyTagSubtree(from: string, to: string): Promise<string[]> {
  const src = normalizeTagPath(from || "");
  const dst = normalizeTagPath(to || "");
  if (!src || !dst || src === REVIEW_TAG || src === EXAM_TAG) return loadTags();
  const srcParts = parseTagPath(src);
  const dstParts = parseTagPath(dst);
  if (dstParts.length > 3) return loadTags();

  const currentTags = await loadTags();
  const out = new Set<string>(currentTags);
  for (const t of currentTags) {
    if (t === src || pathStartsWith(t, src)) {
      const suffix = t.slice(src.length);
      const candidate = (dst + suffix).trim();
      const norm = normalizeTagPath(candidate);
      if (norm) out.add(norm);
    }
  }
  const nextTags = Array.from(out);
  await saveTags(nextTags);

  // Update words: add copied tags in addition to originals
  const words = await loadWords();
  const updated = words.map((w) => {
    const wt = Array.isArray(w.tags) ? w.tags : [];
    const nextSet = new Set<string>(wt.map((t) => (normalizeTagPath(t || "") || "")).filter(Boolean));
    let touched = false;
    for (const t of wt) {
      const n = normalizeTagPath(t || "");
      if (!n) continue;
      if (n === src || pathStartsWith(n, src)) {
        const suffix = n.slice(src.length);
        const candidate = (dst + suffix).trim();
        const nn = normalizeTagPath(candidate);
        if (nn && !nextSet.has(nn)) { nextSet.add(nn); touched = true; }
      }
    }
    return touched ? ({ ...w, tags: Array.from(nextSet) } as Word) : w;
  });
  await saveWords(updated);

  // Order: add top-level child under dst parent if missing
  const dstP = parentOf(dst);
  const dstN = nameOf(dst);
  const order = await loadTagOrder();
  const arr = Array.isArray(order[dstP]) ? order[dstP] : [];
  if (!arr.includes(dstN)) arr.push(dstN);
  order[dstP] = arr;
  await saveTagOrder(order);
  return nextTags;
}

// Reorder a child within its siblings under the same parent
export async function reorderTagSibling(parentPath: string, name: string, direction: 'up' | 'down'): Promise<void> {
  const order = await loadTagOrder();
  const arr = Array.isArray(order[parentPath]) ? [...order[parentPath]] : [];
  const idx = arr.indexOf(name);
  if (idx < 0) return;
  const swapWith = direction === 'up' ? idx - 1 : idx + 1;
  if (swapWith < 0 || swapWith >= arr.length) return;
  const tmp = arr[idx];
  arr[idx] = arr[swapWith];
  arr[swapWith] = tmp;
  order[parentPath] = arr;
  await saveTagOrder(order);
}

// ---------- SRS helpers ----------
function toState(w: Word, now: number): SrsState {
  return {
    ease: typeof w.srsEase === "number" ? w.srsEase : 2.5,
    interval: typeof w.srsInterval === "number" ? w.srsInterval : 0,
    reps: typeof w.srsReps === "number" ? w.srsReps : 0,
    lapses: typeof w.srsLapses === "number" ? w.srsLapses : 0,
    due: w.srsDue ? Date.parse(w.srsDue) : now,
  };
}
function fromState(w: Word, s: SrsState): Word {
  return { ...w, srsEase: s.ease, srsInterval: s.interval, srsReps: s.reps, srsLapses: s.lapses, srsDue: new Date(s.due).toISOString() };
}

export async function getDueCount(nowMs: number = Date.now()): Promise<number> {
  const list = await loadWords();
  return list.filter((w) => (w.tags || []).includes(REVIEW_TAG) && w.srsDue && Date.parse(w.srsDue) <= nowMs).length;
}
export async function listDueWords(nowMs: number = Date.now()): Promise<Word[]> {
  const list = await loadWords();
  return list.filter((w) => (w.tags || []).includes(REVIEW_TAG) && w.srsDue && Date.parse(w.srsDue) <= nowMs);
}
export async function srsAnswer(en: string, correct: boolean, nowMs: number = Date.now()): Promise<Word | null> {
  const list = await loadWords();
  const idx = list.findIndex((w) => w.en.toLowerCase() === (en || "").toLowerCase());
  if (idx < 0) return null;
  const w = list[idx];
  const hasReview = (w.tags || []).includes(REVIEW_TAG);
  if (!hasReview) return w;
  const nextState = updateSrs(toState(w, nowMs), correct ? "good" : "again", nowMs);
  const updated = fromState(w, nextState);
  const arr = [...list];
  arr[idx] = updated;
  await saveWords(arr);
  return updated;
}

// ---------- Daily limits ----------
const SRS_DAILY_KEY = "@srs_daily_stats";
export type SrsDailyStats = { day: string; newUsed: number; reviewUsed: number };
function currentDayId(date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}${dd}${mm}`;
}
export async function getDailyStats(): Promise<SrsDailyStats> {
  const raw = await AsyncStorage.getItem(SRS_DAILY_KEY);
  const today = currentDayId();
  if (!raw) return { day: today, newUsed: 0, reviewUsed: 0 };
  try { const parsed = JSON.parse(raw) as SrsDailyStats; if (parsed.day === today) return parsed; } catch {}
  return { day: today, newUsed: 0, reviewUsed: 0 };
}
export async function bumpDailyStats(delta: Partial<Pick<SrsDailyStats, "newUsed" | "reviewUsed">>): Promise<SrsDailyStats> {
  const today = currentDayId();
  const cur = await getDailyStats();
  const next: SrsDailyStats = {
    day: today,
    newUsed: Math.max(0, cur.day === today ? cur.newUsed + (delta.newUsed || 0) : (delta.newUsed || 0)),
    reviewUsed: Math.max(0, cur.day === today ? cur.reviewUsed + (delta.reviewUsed || 0) : (delta.reviewUsed || 0)),
  };
  await AsyncStorage.setItem(SRS_DAILY_KEY, JSON.stringify(next));
  return next;
}

// ---------- SRS limits (user-configurable) ----------
export type SrsLimits = { dailyNewLimit: number; dailyReviewLimit: number };
const DEFAULT_LIMITS: SrsLimits = { dailyNewLimit: 10, dailyReviewLimit: 100 };
function clamp(n: number, min: number, max: number): number { return Math.max(min, Math.min(max, n)); }
export async function getSrsLimits(): Promise<SrsLimits> {
  const raw = await AsyncStorage.getItem(SRS_LIMITS_KEY);
  if (!raw) return DEFAULT_LIMITS;
  try {
    const obj = JSON.parse(raw);
    const dn = clamp(Number(obj.dailyNewLimit ?? DEFAULT_LIMITS.dailyNewLimit), 0, 100);
    const dr = clamp(Number(obj.dailyReviewLimit ?? DEFAULT_LIMITS.dailyReviewLimit), 0, 1000);
    return { dailyNewLimit: dn, dailyReviewLimit: dr };
  } catch { return DEFAULT_LIMITS; }
}
export async function saveSrsLimits(limits: Partial<SrsLimits>): Promise<SrsLimits> {
  const cur = await getSrsLimits();
  const next: SrsLimits = {
    dailyNewLimit: clamp(Number(limits.dailyNewLimit ?? cur.dailyNewLimit), 0, 100),
    dailyReviewLimit: clamp(Number(limits.dailyReviewLimit ?? cur.dailyReviewLimit), 0, 1000),
  };
  await AsyncStorage.setItem(SRS_LIMITS_KEY, JSON.stringify(next));
  return next;
}

// ---------- UI preferences ----------
export async function getWordFontSize(): Promise<number> {
  try { const raw = await AsyncStorage.getItem(PREF_WORD_FONT_SIZE_KEY); if (!raw) return 18; const n = Number(raw); return isNaN(n) ? 18 : Math.max(12, Math.min(48, Math.round(n))); } catch { return 18; }
}
export async function saveWordFontSize(size: number): Promise<number> {
  const n = Math.max(12, Math.min(48, Math.round(Number(size) || 18)));
  await AsyncStorage.setItem(PREF_WORD_FONT_SIZE_KEY, String(n));
  return n;
}
