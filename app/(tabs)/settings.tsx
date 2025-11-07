import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Alert, Button, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { loadSpeechSettings, listVoices, TtsVoice, loadVoiceSelection, saveVoiceForLang, saveRatePercent, getSpeechOptions, loadZhRate, saveZhRate, loadPitchPercent, savePitchPercent } from "@/utils/tts";
import * as Speech from "expo-speech";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Picker } from "@react-native-picker/picker";
import Slider from "@/components/ui/Slider";
import { getSrsLimits, saveSrsLimits, getWordFontSize, saveWordFontSize } from "@/utils/storage";
import { useI18n, Locale } from "@/i18n";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri } from "expo-auth-session";
import Constants from "expo-constants";
import { buildBackupPayload, uploadBackupToDrive, downloadLatestBackupFromDrive, applyBackupPayload, exportBackupToDevice, importBackupFromDevice } from "@/utils/backup";

const ENABLE_GOOGLE_SIGNIN = false;

export default function Settings() {
  const { t, locale, setLocale } = useI18n();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [busy, setBusy] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);
  const [ratePercent, setRatePercent] = useState<number>(50);
  const [pitchPercent, setPitchPercent] = useState<number>(50);
  const [voices, setVoices] = useState<TtsVoice[]>([]);
  const [voiceEn, setVoiceEn] = useState<string | null>(null);
  const [voiceZh, setVoiceZh] = useState<string | null>(null);
  const [loadingVoices, setLoadingVoices] = useState(true);
  const [dailyNewLimit, setDailyNewLimit] = useState<number>(10);
  const [dailyReviewLimit, setDailyReviewLimit] = useState<number>(100);
  const [wordFontSize, setWordFontSize] = useState<number>(18);
  const [zhRate, setZhRate] = useState<number>(1.0);
  const refreshAllData = useCallback(() => {
    if (typeof window !== "undefined" && (window as any).haloWord?.refreshAll) {
      try { (window as any).haloWord.refreshAll(); } catch {}
    }
  }, []);

  const hydrateSettings = useCallback(async () => {
    try {
      setLoadingVoices(true);
      const speech = await loadSpeechSettings();
      setRatePercent(speech.ratePercent);
      setPitchPercent(await loadPitchPercent());
      const voicesList = await listVoices();
      setVoices(voicesList);
      const selections = await loadVoiceSelection();
      setVoiceEn(selections.voiceEn);
      setVoiceZh(selections.voiceZh);
      const limits = await getSrsLimits();
      setDailyNewLimit(limits.dailyNewLimit);
      setDailyReviewLimit(limits.dailyReviewLimit);
      setWordFontSize(await getWordFontSize());
      setZhRate(await loadZhRate());
    } finally {
      setLoadingVoices(false);
    }
  }, []);

  useEffect(() => {
    hydrateSettings();
  }, [hydrateSettings]);

  const enVoices = useMemo(
    () => voices.filter((v) => (v.language || "").toLowerCase().startsWith("en")),
    [voices]
  );
  const zhVoices = useMemo(
    () => voices.filter((v) => (v.language || "").toLowerCase().startsWith("zh")),
    [voices]
  );
  const currentEnName = useMemo(() => {
    if (!voiceEn) return t("settings.systemDefault");
    const v = enVoices.find((item) => item.identifier === voiceEn);
    return v?.name || v?.identifier || voiceEn;
  }, [voiceEn, enVoices, t]);
  const currentZhName = useMemo(() => {
    if (!voiceZh) return t("settings.systemDefault");
    const v = zhVoices.find((item) => item.identifier === voiceZh);
    return v?.name || v?.identifier || voiceZh;
  }, [voiceZh, zhVoices, t]);

  const onCommitRate = async (value: number) => {
    setRatePercent(value);
    await saveRatePercent(value);
  };
  const onCommitPitch = async (value: number) => {
    const v = Math.round(value);
    setPitchPercent(v);
    await savePitchPercent(v);
  };
  const onPickVoice = async (lang: "en" | "zh", id: string | null) => {
    if (lang === "en") setVoiceEn(id);
    else setVoiceZh(id);
    await saveVoiceForLang(lang, id);
  };
  const onCommitNewLimit = async (value: number) => {
    const v = Math.round(value);
    setDailyNewLimit(v);
    await saveSrsLimits({ dailyNewLimit: v });
  };
  const onCommitReviewLimit = async (value: number) => {
    const v = Math.round(value);
    setDailyReviewLimit(v);
    await saveSrsLimits({ dailyReviewLimit: v });
  };
  const onCommitWordFont = async (value: number) => {
    const n = Math.round(value);
    setWordFontSize(n);
    await saveWordFontSize(n);
  };
  const onSetZhRate = async (m: number) => {
    const next = await saveZhRate(m);
    setZhRate(next);
  };
  const onPreviewVoice = async (lang: "en" | "zh") => {
    try {
      Speech.stop();
    } catch {}
    const text = lang === "en" ? "take an example" : "這是一句示範語音";
    const langCode = lang === "en" ? "en-US" : "zh-TW";
    const opts = await getSpeechOptions(langCode);
    Speech.speak(text, { language: langCode, voice: opts.voice, rate: opts.rate, pitch: opts.pitch });
  };

  useEffect(() => {
    setMounted(true);
    try {
      WebBrowser.maybeCompleteAuthSession();
    } catch {}
  }, []);

  const onBackupNow = async () => {
    if (!accessToken) {
      Alert.alert("備份", "請先登入 Google。");
      return;
    }
    try {
      setBusy(true);
      const payload = await buildBackupPayload();
      await uploadBackupToDrive(accessToken, payload);
      Alert.alert("備份", "已備份到 Google 雲端（App Data Folder）。");
    } catch (e: any) {
      Alert.alert("備份失敗", String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const onRestoreNow = async () => {
    if (!accessToken) {
      Alert.alert("還原", "請先登入 Google。");
      return;
    }
    try {
      setBusy(true);
      const obj = await downloadLatestBackupFromDrive(accessToken);
      if (!obj) {
        Alert.alert("還原", "找不到備份檔。");
        return;
      }
      await applyBackupPayload(obj);
      Alert.alert("還原完成", "已套用備份，請重新啟動 App。");
    } catch (e: any) {
      Alert.alert("還原失敗", String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const onExportLocal = async () => {
    try {
      setBusy(true);
      const msg = await exportBackupToDevice();
      Alert.alert("匯出成功", msg);
      refreshAllData();
    } catch (e: any) {
      Alert.alert("匯出失敗", String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const onImportLocal = async () => {
    try {
      setBusy(true);
      const obj = await importBackupFromDevice();
      if (!obj) {
        Alert.alert("匯入已取消", "沒有選擇檔案。");
        return;
      }
      await applyBackupPayload(obj);
      refreshAllData();
      Alert.alert("匯入成功", "已套用備份，資料已更新。");
    } catch (e: any) {
      Alert.alert("匯入失敗", String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.header}>
          <Text style={styles.title}>⚙️ {t("settings.title")}</Text>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="backup" size={20} color="#0a7ea4" />
            <Text style={styles.sectionTitle}>本機備份 / 還原</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
            <Pressable 
              style={styles.actionButton}
              onPress={onExportLocal}
              disabled={busy}
            >
              <Text style={styles.actionButtonText}>📤 {busy ? "匯出中…" : "匯出到裝置"}</Text>
            </Pressable>
            <Pressable 
              style={styles.actionButton}
              onPress={onImportLocal}
              disabled={busy}
            >
              <Text style={styles.actionButtonText}>📥 {busy ? "匯入中…" : "從裝置匯入"}</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="cloud" size={20} color="#0a7ea4" />
            <Text style={styles.sectionTitle}>Google 雲端備份</Text>
          </View>
          {ENABLE_GOOGLE_SIGNIN && mounted ? (
            <Text style={styles.dim}>Google 備份功能尚未啟用</Text>
          ) : (
            <Text style={styles.dim}>目前僅支援備份到 Google 帳號。</Text>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="language" size={20} color="#0a7ea4" />
            <Text style={styles.sectionTitle}>{t("settings.language")}</Text>
          </View>
          <View style={styles.pickerContainer}>
            <Picker selectedValue={locale} onValueChange={(val) => setLocale(val as Locale)}>
              <Picker.Item label={t("settings.language.zh")} value={"zh-TW"} />
              <Picker.Item label={t("settings.language.en")} value={"en"} />
            </Picker>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="track-changes" size={20} color="#0a7ea4" />
            <Text style={styles.sectionTitle}>{t("settings.dailyLimit")}</Text>
          </View>
          <Text style={styles.settingLabel}>{t("settings.newLimit", { n: dailyNewLimit })}</Text>
          <Slider
            minimumValue={0}
            maximumValue={100}
            step={1}
            value={dailyNewLimit}
            onValueChange={setDailyNewLimit}
            onSlidingComplete={onCommitNewLimit}
          />
          <Text style={[styles.settingLabel, { marginTop: 12 }]}>{t("settings.reviewLimit", { n: dailyReviewLimit })}</Text>
          <Slider
            minimumValue={0}
            maximumValue={1000}
            step={10}
            value={dailyReviewLimit}
            onValueChange={setDailyReviewLimit}
            onSlidingComplete={onCommitReviewLimit}
          />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="speed" size={20} color="#0a7ea4" />
            <Text style={styles.sectionTitle}>{t("settings.rate")}</Text>
          </View>
          <Slider
            minimumValue={0}
            maximumValue={100}
            step={1}
            value={ratePercent}
            onValueChange={setRatePercent}
            onSlidingComplete={onCommitRate}
          />
          <Text style={styles.dim}>{t("settings.rate.hint", { n: ratePercent })}</Text>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="translate" size={20} color="#0a7ea4" />
            <Text style={styles.sectionTitle}>{t("settings.zhRate")}</Text>
          </View>
          <View style={styles.row}>
            {[1, 1.15, 1.25, 1.35].map((m) => (
              <Pressable 
                key={m}
                style={[styles.speedButton, zhRate === m && styles.speedButtonActive]}
                onPress={() => onSetZhRate(m)}
              >
                <Text style={[styles.speedButtonText, zhRate === m && styles.speedButtonTextActive]}>
                  {zhRate === m ? "✓ " : ""}{m}x
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="graphic-eq" size={20} color="#0a7ea4" />
            <Text style={styles.sectionTitle}>{t("settings.pitch")}</Text>
          </View>
          <Slider
            minimumValue={0}
            maximumValue={100}
            step={1}
            value={pitchPercent}
            onValueChange={setPitchPercent}
            onSlidingComplete={onCommitPitch}
          />
          <Text style={styles.dim}>{t("settings.pitch.hint", { n: pitchPercent })}</Text>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="text-fields" size={20} color="#0a7ea4" />
            <Text style={styles.sectionTitle}>{t("settings.wordFont")}</Text>
          </View>
          <Text style={styles.settingLabel}>{t("settings.wordFont.value", { n: wordFontSize })}</Text>
          <Slider
            minimumValue={12}
            maximumValue={48}
            step={1}
            value={wordFontSize}
            onValueChange={setWordFontSize}
            onSlidingComplete={onCommitWordFont}
          />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="record-voice-over" size={20} color="#0a7ea4" />
            <Text style={styles.sectionTitle}>{t("settings.enVoices")}</Text>
          </View>
          {loadingVoices ? (
            <Text style={styles.dim}>{t("settings.loadingVoices")}</Text>
          ) : (
            <View style={styles.voiceList}>
              <View style={{ flex: 1, borderWidth: 2, borderColor: "#ddd", borderRadius: 10, overflow: "hidden" }}>
                <Picker
                  selectedValue={voiceEn ?? ""}
                  onValueChange={(val) => onPickVoice("en", val === "" ? null : String(val))}
                >
                  <Picker.Item label={t("settings.systemDefault")} value="" />
                  {enVoices.map((v) => (
                    <Picker.Item key={v.identifier} label={v.name || v.identifier} value={v.identifier} />
                  ))}
                </Picker>
              </View>
              <View style={styles.voiceRow}>
                <Text style={styles.voiceName} numberOfLines={1}>
                  {currentEnName}
                </Text>
                <Pressable
                  onPress={() => onPreviewVoice("en")}
                  accessibilityLabel={t("settings.previewEn")}
                  style={{ paddingHorizontal: 8 }}
                >
                  <MaterialIcons name="play-circle-outline" size={28} color="#0a7ea4" />
                </Pressable>
              </View>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="language" size={20} color="#0a7ea4" />
            <Text style={styles.sectionTitle}>{t("settings.zhVoices")}</Text>
          </View>
          {loadingVoices ? (
            <Text style={styles.dim}>{t("settings.loadingVoices")}</Text>
          ) : (
            <View style={styles.voiceList}>
              <View style={{ flex: 1, borderWidth: 2, borderColor: "#ddd", borderRadius: 10, overflow: "hidden" }}>
                <Picker
                  selectedValue={voiceZh ?? ""}
                  onValueChange={(val) => onPickVoice("zh", val === "" ? null : String(val))}
                >
                  <Picker.Item label={t("settings.systemDefault")} value="" />
                  {zhVoices.map((v) => (
                    <Picker.Item key={v.identifier} label={v.name || v.identifier} value={v.identifier} />
                  ))}
                </Picker>
              </View>
              <View style={styles.voiceRow}>
                <Text style={styles.voiceName} numberOfLines={1}>
                  {currentZhName}
                </Text>
                <Pressable
                  onPress={() => onPreviewVoice("zh")}
                  accessibilityLabel={t("settings.previewZh")}
                  style={{ paddingHorizontal: 8 }}
                >
                  <MaterialIcons name="play-circle-outline" size={28} color="#0a7ea4" />
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f7fa", paddingTop: 16 },
  header: { paddingHorizontal: 16, marginBottom: 20 },
  title: { fontSize: 32, fontWeight: "700", color: "#1a1a1a" },
  section: { marginHorizontal: 16, marginBottom: 16, backgroundColor: "#fff", borderRadius: 14, padding: 16, borderWidth: 2, borderColor: "#ddd" },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#1a1a1a", flex: 1 },
  settingLabel: { fontSize: 14, fontWeight: "600", color: "#1a1a1a", marginBottom: 8 },
  actionButton: { flex: 1, minWidth: 100, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: "#e8f4f8", borderRadius: 10, alignItems: "center", borderWidth: 2, borderColor: "#0a7ea4" },
  actionButtonText: { color: "#0a7ea4", fontSize: 13, fontWeight: "600" },
  row: { flexDirection: "row", gap: 8 },
  speedButton: { flex: 1, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: "#f0f0f0", borderRadius: 10, alignItems: "center", borderWidth: 2, borderColor: "#ddd" },
  speedButtonActive: { backgroundColor: "#0a7ea4", borderColor: "#0a7ea4" },
  speedButtonText: { color: "#1a1a1a", fontSize: 13, fontWeight: "600" },
  speedButtonTextActive: { color: "#fff" },
  voiceList: { marginBottom: 12, gap: 8 },
  voiceRow: { flexDirection: "row", alignItems: "center", marginTop: 8, padding: 8, backgroundColor: "#f9fafb", borderRadius: 10 },
  voiceName: { maxWidth: 180, flexShrink: 1, marginRight: 6, color: "#1a1a1a", fontWeight: "500", fontSize: 13 },
  dim: { color: "#999", fontSize: 13, marginTop: 4 },
  pickerContainer: { borderWidth: 2, borderColor: "#ddd", borderRadius: 10, overflow: "hidden", backgroundColor: "#f9fafb" },
});
