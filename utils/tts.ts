import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Speech from "expo-speech";

// 舊版有離散等級；改為 0–100 百分比
export type RateLevel = "normal" | "slow" | "slower"; // 保留型別以避免外部引用報錯
export type VoiceGender = "male" | "female";
export type TtsVoice = { identifier: string; name?: string; language?: string; quality?: number | string };

const KEY_RATE_LEVEL = "@tts_rate_level"; // 舊版鍵名（相容用）
const KEY_RATE_PERCENT = "@tts_rate_percent"; // 新版鍵名（0–100）
const KEY_GENDER = "@tts_gender";
const KEY_VOICE_EN = "@tts_voice_en";
const KEY_VOICE_ZH = "@tts_voice_zh";

// 讀取語音設定：回傳 ratePercent（0–100）與性別
export async function loadSpeechSettings(): Promise<{ ratePercent: number; gender: VoiceGender }> {
  const [percentRaw, legacyRaw, genderRaw] = await Promise.all([
    AsyncStorage.getItem(KEY_RATE_PERCENT),
    AsyncStorage.getItem(KEY_RATE_LEVEL),
    AsyncStorage.getItem(KEY_GENDER),
  ]);

  let ratePercent: number | null = null;
  if (percentRaw != null) {
    const n = Number(percentRaw);
    if (!isNaN(n)) ratePercent = Math.max(0, Math.min(100, Math.round(n)));
  }
  // 與舊版對映：normal=50、slow=40、slower=30（約略對應舊 1.0/0.8/0.6）
  if (ratePercent == null) {
    if (legacyRaw === "slow") ratePercent = 40;
    else if (legacyRaw === "slower") ratePercent = 30;
    else ratePercent = 50; // normal 或未設定
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

// 將 0–100 百分比映射到 expo-speech 的 rate。50 ≈ 1.0（正常）
export function mapRateFromPercent(percent: number): number {
  const p = Math.max(0, Math.min(100, percent));
  // 0 => 0.5x, 50 => 1.0x, 100 => 1.5x
  return 0.5 + (p / 100) * 1.0;
}

export function mapPitch(gender: VoiceGender): number {
  // Use pitch to emulate lower (male) vs higher (female) voice
  return gender === "male" ? 0.9 : 1.1;
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

export async function getSpeechOptions(language?: string): Promise<{ language?: string; rate: number; pitch: number; voice?: string }> {
  const { ratePercent, gender } = await loadSpeechSettings();
  const { voiceEn, voiceZh } = await loadVoiceSelection();
  const isZh = !!language && language.toLowerCase().startsWith('zh');
  const voice = isZh ? voiceZh || undefined : voiceEn || undefined;
  // 中文一律正常語速（1.0），英文依照拉桿百分比
  const rate = isZh ? 1.0 : mapRateFromPercent(ratePercent);
  return { language, rate, pitch: mapPitch(gender), voice };
}
