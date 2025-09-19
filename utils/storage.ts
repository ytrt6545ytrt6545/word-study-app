import AsyncStorage from "@react-native-async-storage/async-storage";
import { defaultSrs, SrsState, updateSrs } from "./srs";

// System-reserved tag for review flow
export const REVIEW_TAG = "複習";
// Legacy corrupted values to migrate from
const LEGACY_REVIEW_TAGS = new Set(["複�?"]);

export type WordStatus = "unknown" | "learning" | "mastered";
export type Word = {
  en: string;
  zh: string;
  exampleEn?: string; // example sentence (EN)
  exampleZh?: string; // example sentence (ZH)
  note?: string;
  status: WordStatus;
  createdAt?: string; // ISO timestamp when the word was added
  reviewCount?: number; // how many times reviewed
  lastReviewedAt?: string; // ISO timestamp of last review
  tags?: string[]; // labels/tags for this word
  // SRS fields (SM-2 lite)
  srsEase?: number; // EF
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
  // Migration: ensure createdAt and reviewCount exist
  const migrated = parsed.map((w) => {
    const rawTags = Array.isArray((w as any).tags) ? (w as any).tags : [];
    // Normalize and migrate corrupted review tag strings
    const tagsSet = new Set<string>();
    for (const t of rawTags) {
      if (typeof t !== 'string') continue;
      const name = (t || '').trim();
      if (!name) continue;
      tagsSet.add(LEGACY_REVIEW_TAGS.has(name) ? REVIEW_TAG : name);
    }
    const tags = Array.from(tagsSet);
    const base: Word = {
      ...w,
      createdAt: (w as any).createdAt || nowIso,
      reviewCount: typeof (w as any).reviewCount === 'number' ? (w as any).reviewCount : 0,
      tags,
    } as Word;
    // Ensure SRS defaults
    const hasReview = (base.tags || []).includes(REVIEW_TAG);
    const now = Date.now();
    const ease = typeof (base as any).srsEase === 'number' ? (base as any).srsEase as number : 2.5;
    const interval = typeof (base as any).srsInterval === 'number' ? (base as any).srsInterval as number : 0;
    const reps = typeof (base as any).srsReps === 'number' ? (base as any).srsReps as number : 0;
    const lapses = typeof (base as any).srsLapses === 'number' ? (base as any).srsLapses as number : 0;
    const dueMs = (base as any).srsDue ? Date.parse((base as any).srsDue) : (hasReview ? now : NaN);
    const srsDueIso = isNaN(dueMs) ? undefined : new Date(dueMs).toISOString();
    return { ...base, srsEase: ease, srsInterval: interval, srsReps: reps, srsLapses: lapses, srsDue: srsDueIso } as Word;
  });
  // If anything was missing, persist the migrated data
  if (migrated.some((w, i) => w.createdAt !== (parsed[i] as any).createdAt || w.reviewCount !== (parsed[i] as any).reviewCount || JSON.stringify(w.tags || []) !== JSON.stringify((parsed[i] as any).tags || []) ||
    (w as any).srsEase !== (parsed[i] as any).srsEase || (w as any).srsInterval !== (parsed[i] as any).srsInterval || (w as any).srsReps !== (parsed[i] as any).srsReps || (w as any).srsLapses !== (parsed[i] as any).srsLapses || (w as any).srsDue !== (parsed[i] as any).srsDue)) {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
  }
  return migrated;
}

/**
 * 增加一次複習次數（避免短窗重複計數）
 * - windowMs 可防止重複觸發累計
 */
export async function bumpReview(en: string, windowMs = 120_000): Promise<Word | null> {
  const list = await loadWords();
  const idx = list.findIndex((w) => w.en.toLowerCase() === (en || '').toLowerCase());
  if (idx < 0) return null;

  const now = Date.now();
  const last = list[idx].lastReviewedAt ? Date.parse(list[idx].lastReviewedAt!) : 0;
  if (now - last < windowMs) {
    // too soon; skip increment, but keep data
    return list[idx];
  }

  const current = list[idx];
  const nextCount = (current.reviewCount || 0) + 1;
  // Auto-upgrade status by review thresholds
  let nextStatus: WordStatus = current.status;
  if (nextCount > 30) {
    nextStatus = 'mastered';
  } else if (nextCount > 15 && current.status === 'unknown') {
    nextStatus = 'learning';
  }
  const next: Word = {
    ...current,
    status: nextStatus,
    reviewCount: nextCount,
    lastReviewedAt: new Date(now).toISOString(),
  };
  const updated = [...list];
  updated[idx] = next;
  await saveWords(updated);
  return next;
}

export async function saveWords(words: Word[]) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(words));
}

// Tags storage
export async function loadTags(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(TAGS_KEY);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) {
      const set = new Set(
        arr
          .filter((t: any) => typeof t === 'string')
          .map((t: string) => (t || '').trim())
          .filter(Boolean)
          .map((t: string) => (LEGACY_REVIEW_TAGS.has(t) ? REVIEW_TAG : t))
      );
      // Ensure system tag always exists in registry
      set.add(REVIEW_TAG);
      return Array.from(set);
    }
  } catch {}
  return [REVIEW_TAG];
}

export async function saveTags(tags: string[]) {
  const normSet = new Set(tags.map((t) => (t || '').trim()).filter(Boolean));
  // Ensure system tag remains present
  normSet.add(REVIEW_TAG);
  const norm = Array.from(normSet);
  await AsyncStorage.setItem(TAGS_KEY, JSON.stringify(norm));
}

export async function addTag(tag: string): Promise<string[]> {
  const name = (tag || '').trim();
  if (!name) return loadTags();
  const list = await loadTags();
  if (!list.includes(name)) {
    list.push(name);
    await saveTags(list);
  }
  return list;
}

export async function setWordTags(en: string, tags: string[]): Promise<Word | null> {
  const list = await loadWords();
  const idx = list.findIndex((w) => w.en.toLowerCase() === (en || '').toLowerCase());
  if (idx < 0) return null;
  const norm = Array.from(new Set(tags.map((t) => (t || '').trim()).filter(Boolean)));
  const updated: Word = { ...list[idx], tags: norm };
  const next = [...list];
  next[idx] = updated;
  await saveWords(next);
  return updated;
}

export async function toggleWordTag(en: string, tag: string, enabled: boolean): Promise<Word | null> {
  const list = await loadWords();
  const idx = list.findIndex((w) => w.en.toLowerCase() === (en || '').toLowerCase());
  if (idx < 0) return null;
  const current = list[idx];
  const curTags = Array.isArray(current.tags) ? current.tags : [];
  const name = (tag || '').trim();
  const nextTags = new Set(curTags.map((t) => (t || '').trim()).filter(Boolean));
  if (enabled) nextTags.add(name); else nextTags.delete(name);
  let updated: Word = { ...current, tags: Array.from(nextTags) };
  // When enabling review tag, ensure SRS defaults present
  if (enabled && name === REVIEW_TAG) {
    const now = Date.now();
    updated = {
      ...updated,
      srsEase: typeof updated.srsEase === 'number' ? updated.srsEase : 2.5,
      srsInterval: typeof updated.srsInterval === 'number' ? updated.srsInterval : 0,
      srsReps: typeof updated.srsReps === 'number' ? updated.srsReps : 0,
      srsLapses: typeof updated.srsLapses === 'number' ? updated.srsLapses : 0,
      srsDue: updated.srsDue || new Date(now).toISOString(),
    };
  }
  const next = [...list];
  next[idx] = updated;
  await saveWords(next);
  return updated;
}

export async function removeTag(tag: string): Promise<string[]> {
  const name = (tag || '').trim();
  // Disallow removing system tag
  if (name === REVIEW_TAG) return loadTags();
  if (!name) return loadTags();
  // Update tag registry
  const currentTags = await loadTags();
  const nextTags = currentTags.filter((t) => t !== name);
  await saveTags(nextTags);
  // Remove from all words
  const words = await loadWords();
  let dirty = false;
  const updated = words.map((w) => {
    const wt = Array.isArray(w.tags) ? w.tags : [];
    const filtered = wt.filter((t) => t !== name);
    if (filtered.length !== wt.length) {
      dirty = true;
      return { ...w, tags: filtered } as Word;
    }
    return w;
  });
  if (dirty) await saveWords(updated);
  return nextTags;
}

export async function removeTags(tags: string[]): Promise<string[]> {
  const set = new Set((tags || []).map((t) => (t || '').trim()).filter(Boolean));
  // Disallow removing system tag
  set.delete(REVIEW_TAG);
  if (set.size === 0) return loadTags();
  // Update tag registry
  const currentTags = await loadTags();
  const nextTags = currentTags.filter((t) => !set.has(t));
  await saveTags(nextTags);
  // Remove from all words
  const words = await loadWords();
  let dirty = false;
  const updated = words.map((w) => {
    const wt = Array.isArray(w.tags) ? w.tags : [];
    const filtered = wt.filter((t) => !set.has((t || '').trim()));
    if (filtered.length !== wt.length) {
      dirty = true;
      return { ...w, tags: filtered } as Word;
    }
    return w;
  });
  if (dirty) await saveWords(updated);
  return nextTags;
}

export async function renameTag(oldName: string, newName: string): Promise<string[]> {
  const from = (oldName || '').trim();
  const to = (newName || '').trim();
  // Disallow renaming system tag
  if (from === REVIEW_TAG) return loadTags();
  if (!from || !to || from === to) return loadTags();
  // Update words: replace 'from' with 'to' and dedupe
  const words = await loadWords();
  let dirty = false;
  const updated = words.map((w) => {
    const wt = Array.isArray(w.tags) ? w.tags : [];
    if (!wt.includes(from) && !wt.includes(to)) return w;
    const nextSet = new Set<string>(wt.map((t) => (t || '').trim()).filter(Boolean));
    if (nextSet.has(from)) {
      dirty = true;
      nextSet.delete(from);
      nextSet.add(to);
    }
    // ensure dedupe when both existed
    return { ...w, tags: Array.from(nextSet) } as Word;
  });
  if (dirty) await saveWords(updated);
  // Update registry: ensure 'to' exists, remove 'from'
  const currentTags = await loadTags();
  const set = new Set(currentTags);
  set.delete(from);
  set.add(to);
  const nextTags = Array.from(set);
  await saveTags(nextTags);
  return nextTags;
}

// ---------- SRS helpers ----------

function toState(w: Word, now: number): SrsState {
  return {
    ease: typeof w.srsEase === 'number' ? w.srsEase : 2.5,
    interval: typeof w.srsInterval === 'number' ? w.srsInterval : 0,
    reps: typeof w.srsReps === 'number' ? w.srsReps : 0,
    lapses: typeof w.srsLapses === 'number' ? w.srsLapses : 0,
    due: w.srsDue ? Date.parse(w.srsDue) : now,
  };
}

function fromState(w: Word, s: SrsState): Word {
  return {
    ...w,
    srsEase: s.ease,
    srsInterval: s.interval,
    srsReps: s.reps,
    srsLapses: s.lapses,
    srsDue: new Date(s.due).toISOString(),
  };
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
  const idx = list.findIndex((w) => w.en.toLowerCase() === (en || '').toLowerCase());
  if (idx < 0) return null;
  const w = list[idx];
  const hasReview = (w.tags || []).includes(REVIEW_TAG);
  if (!hasReview) return w;
  const nextState = updateSrs(toState(w, nowMs), correct ? 'good' : 'again', nowMs);
  const updated = fromState(w, nextState);
  const arr = [...list];
  arr[idx] = updated;
  await saveWords(arr);
  return updated;
}

// Daily limits
const SRS_DAILY_KEY = "@srs_daily_stats";
export type SrsDailyStats = { day: string; newUsed: number; reviewUsed: number };

function currentDayId(date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}${dd}${mm}`; // yyddmm order is fine as an id
}

export async function getDailyStats(): Promise<SrsDailyStats> {
  const raw = await AsyncStorage.getItem(SRS_DAILY_KEY);
  const today = currentDayId();
  if (!raw) return { day: today, newUsed: 0, reviewUsed: 0 };
  try {
    const parsed = JSON.parse(raw) as SrsDailyStats;
    if (parsed.day === today) return parsed;
  } catch {}
  return { day: today, newUsed: 0, reviewUsed: 0 };
}

export async function bumpDailyStats(delta: Partial<Pick<SrsDailyStats, 'newUsed' | 'reviewUsed'>>): Promise<SrsDailyStats> {
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
  } catch {
    return DEFAULT_LIMITS;
  }
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
  try {
    const raw = await AsyncStorage.getItem(PREF_WORD_FONT_SIZE_KEY);
    if (!raw) return 18;
    const n = Number(raw);
    if (isNaN(n)) return 18;
    return Math.max(12, Math.min(48, Math.round(n)));
  } catch {
    return 18;
  }
}

export async function saveWordFontSize(size: number): Promise<number> {
  const n = Math.max(12, Math.min(48, Math.round(Number(size) || 18)));
  await AsyncStorage.setItem(PREF_WORD_FONT_SIZE_KEY, String(n));
  return n;
}

