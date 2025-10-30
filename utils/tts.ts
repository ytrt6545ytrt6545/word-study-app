import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Speech from "expo-speech";

export type VoiceGender = "male" | "female";
export type TtsVoice = { identifier: string; name?: string; language?: string; quality?: number | string };

// 語音相關設定皆以固定鍵值儲存在 AsyncStorage，方便備份模組一次帶走或恢復。
// 這些鍵值用來映射 AsyncStorage 內的語音偏好設定，統一管理便於備份或重置。
const KEY_RATE_PERCENT = "@tts_rate_percent"; // 0-100 slider for EN
const KEY_GENDER = "@tts_gender";
const KEY_PITCH_PERCENT = "@tts_pitch_percent"; // 0-100 for pitch (left=male, right=female)
const KEY_VOICE_EN = "@tts_voice_en";
const KEY_VOICE_ZH = "@tts_voice_zh";
const KEY_RATE_ZH = "@tts_rate_zh"; // zh rate multiplier (1.0 = normal)
const KEY_PAUSE_COMMA_MS = "@tts_pause_comma_ms"; // reading pause at comma
const KEY_PAUSE_SENT_MS = "@tts_pause_sentence_ms"; // reading pause at sentence end

// 基礎語速與聲線讀寫：載入/儲存使用者偏好供設定頁與朗讀功能共用。
// 調整流程建議：設定頁更新 → 呼叫對應 save 函式 → 朗讀端透過 getSpeechOptions 取得最新參數。

export async function loadSpeechSettings(): Promise<{ ratePercent: number; gender: VoiceGender }> {
  const [percentRaw, genderRaw] = await Promise.all([
    AsyncStorage.getItem(KEY_RATE_PERCENT),
    AsyncStorage.getItem(KEY_GENDER),
  ]);
  let ratePercent = 50;
  if (percentRaw != null) {
    const n = Number(percentRaw);
    if (!isNaN(n)) ratePercent = Math.max(0, Math.min(100, Math.round(n)));
  }
  const gender: VoiceGender = (genderRaw === "male" || genderRaw === "female") ? (genderRaw as VoiceGender) : "female";
  return { ratePercent, gender };
}

export async function saveRatePercent(percent: number) {
  const p = Math.max(0, Math.min(100, Math.round(percent)));
  await AsyncStorage.setItem(KEY_RATE_PERCENT, String(p));
}

export async function saveGender(gender: VoiceGender) {
  await AsyncStorage.setItem(KEY_GENDER, gender);
}

export function mapRateFromPercent(percent: number): number {
  const p = Math.max(0, Math.min(100, percent));
  // 0 => 0.5x, 50 => 1.0x, 100 => 1.5x
  return 0.5 + (p / 100) * 1.0;
}

export function mapPitch(gender: VoiceGender): number {
  return gender === "male" ? 0.9 : 1.1;
}

export function mapPitchFromPercent(percent: number): number {
  const p = Math.max(0, Math.min(100, percent));
  // 0 => 0.50（低）; 50 => 1.00; 100 => 1.50（高）
  return 0.5 + (p / 100) * 1.0;
}

export async function loadPitchPercent(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(KEY_PITCH_PERCENT);
    if (raw == null) return 50;
    const n = Number(raw);
    return isNaN(n) ? 50 : Math.max(0, Math.min(100, Math.round(n)));
  } catch {
    return 50;
  }
}

export async function savePitchPercent(percent: number): Promise<number> {
  const p = Math.max(0, Math.min(100, Math.round(Number(percent) || 50)));
  await AsyncStorage.setItem(KEY_PITCH_PERCENT, String(p));
  return p;
}

export async function listVoices(): Promise<TtsVoice[]> {
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    return (voices as any as TtsVoice[]) || [];
  } catch {
    return [];
  }
}

export async function loadVoiceSelection(): Promise<{ voiceEn: string | null; voiceZh: string | null }> {
  const [en, zh] = await Promise.all([
    AsyncStorage.getItem(KEY_VOICE_EN),
    AsyncStorage.getItem(KEY_VOICE_ZH),
  ]);
  return { voiceEn: en || null, voiceZh: zh || null };
}

export async function saveVoiceForLang(lang: 'en' | 'zh', identifier: string | null) {
  if (lang === 'en') {
    if (identifier) await AsyncStorage.setItem(KEY_VOICE_EN, identifier); else await AsyncStorage.removeItem(KEY_VOICE_EN);
  } else {
    if (identifier) await AsyncStorage.setItem(KEY_VOICE_ZH, identifier); else await AsyncStorage.removeItem(KEY_VOICE_ZH);
  }
}

export async function loadZhRate(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(KEY_RATE_ZH);
    if (!raw) return 1.0;
    const n = Number(raw);
    if (isNaN(n) || n <= 0) return 1.0;
    return Math.max(0.5, Math.min(3.0, n));
  } catch {
    return 1.0;
  }
}

export async function saveZhRate(multiplier: number): Promise<number> {
  const m = Math.max(0.5, Math.min(3.0, Number(multiplier) || 1));
  await AsyncStorage.setItem(KEY_RATE_ZH, String(m));
  return m;
}

// 介面層與朗讀流程呼叫此函式取得最終語音參數，會根據語系選擇不同語者與語速設定。
export async function getSpeechOptions(language?: string): Promise<{ language?: string; rate: number; pitch: number; voice?: string }> {
  const { ratePercent } = await loadSpeechSettings();
  const { voiceEn, voiceZh } = await loadVoiceSelection();
  const isZh = !!language && language.toLowerCase().startsWith('zh');
  const voice = isZh ? voiceZh || undefined : voiceEn || undefined;
  const zhRate = await loadZhRate();
  const rate = isZh ? zhRate : mapRateFromPercent(ratePercent);
  const pitchPercent = await loadPitchPercent();
  const pitch = mapPitchFromPercent(pitchPercent);
  return { language, rate, pitch, voice };
}

// Reading pauses (web/reading screen)
// 閱讀頁的朗讀功能會根據這些停頓參數調整逗號與句點的停留時間。
export async function loadPauseConfig(): Promise<{ commaMs: number; sentenceMs: number }> {
  try {
    const [cRaw, sRaw] = await Promise.all([
      AsyncStorage.getItem(KEY_PAUSE_COMMA_MS),
      AsyncStorage.getItem(KEY_PAUSE_SENT_MS),
    ]);
    let comma = Number(cRaw ?? 120);
    let sent = Number(sRaw ?? 220);
    if (isNaN(comma)) comma = 120;
    if (isNaN(sent)) sent = 220;
    comma = Math.max(80, Math.min(200, Math.round(comma)));
    sent = Math.max(150, Math.min(400, Math.round(sent)));
    return { commaMs: comma, sentenceMs: sent };
  } catch {
    return { commaMs: 120, sentenceMs: 220 };
  }
}

// 寫入停頓設定時會自動做範圍檢查（逗號 80-200ms、句尾 150-400ms），避免異常值導致朗讀體驗失衡。
export async function savePauseConfig(cfg: Partial<{ commaMs: number; sentenceMs: number }>): Promise<{ commaMs: number; sentenceMs: number }> {
  const cur = await loadPauseConfig();
  let comma = Math.max(80, Math.min(200, Math.round(Number(cfg.commaMs ?? cur.commaMs))));
  let sent = Math.max(150, Math.min(400, Math.round(Number(cfg.sentenceMs ?? cur.sentenceMs))));
  await Promise.all([
    AsyncStorage.setItem(KEY_PAUSE_COMMA_MS, String(comma)),
    AsyncStorage.setItem(KEY_PAUSE_SENT_MS, String(sent)),
  ]);
  return { commaMs: comma, sentenceMs: sent };
}





