import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, Button, ScrollView, StyleSheet, Text, TextInput, View, Pressable } from "react-native";
import { loadWords, saveWords, Word, REVIEW_TAG } from "@/utils/storage";
import { aiCompleteWord, resolveOpenAIKey } from "@/utils/ai";
import { useTabMark } from "@/context/TabMarkContext";
import * as Speech from "expo-speech";
import { getSpeechOptions } from "@/utils/tts";
import { useI18n } from "@/i18n";

// AI 探索頁：輸入單字或中文關鍵字後，呼叫 OpenAI 產生翻譯、例句並快速寫入字庫。
// 亦提供朗讀、標籤預設與結果提示，協助使用者快速擴充單字量。
// 使用流程：讀取既有單字 → 呼叫 AI → 以 `saveWords` 寫回 → 以 `TabMarkContext` 提醒其他分頁刷新。

const AI_NOTE_CALLING = "\u0041\u0049\u003a\u0020\u547c\u53eb\u4e2d\u002e\u002e\u002e";
const AI_NOTE_NO_FIELDS = "\u0041\u0049\u003a\u0020\u5df2\u56de\u50b3\uff0c\u4f46\u627e\u4e0d\u5230\u53ef\u586b\u5165\u7684\u6b04\u4f4d";
const AI_ALERT_PREFIX = "\u8a3a\u65b7";
const AI_ALERT_BODY_PREFIX =
  "\u0041\u0049\u0020\u5df2\u56de\u50b3\u8cc7\u6599\uff0c\u4f46\u627e\u4e0d\u5230\u53ef\u586b\u5165\u7684\u6b04\u4f4d\u3002\u000a\u56de\u50b3\u7247\u6bb5\uff1a";
const AI_NOTE_UPDATED_PREFIX = "\u0041\u0049\u003a\u0020\u5df2\u66f4\u65b0\u0020\u2192\u0020";
const AI_NOTE_FAILED_PREFIX = "\u0041\u0049\u003a\u0020\u5931\u6557\u0020";

// 畫面負責：維護輸入欄位狀態、處理 AI 回傳結果、寫入 AsyncStorage，並依情境導向新增或測驗頁。
export default function Explore() {
  const router = useRouter();
  const { setMarkedTab } = useTabMark();
  const { t } = useI18n();
  const params = useLocalSearchParams<{ tag?: string | string[] }>();
  const defaultTag = (Array.isArray(params.tag) ? params.tag[0] : params.tag || "").toString();

  const [en, setEn] = useState("");
  const [zh, setZh] = useState("");
  const [exEn, setExEn] = useState("");
  const [exZh, setExZh] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiNote, setAiNote] = useState<string>("");
  const [zhHeight, setZhHeight] = useState(40);
  const [exEnHeight, setExEnHeight] = useState(40);
  const [exZhHeight, setExZhHeight] = useState(40);

  const speakWordTwice = async (text: string) => {
    const value = (text || "").toString().trim();
    if (!value) return;
    try {
      Speech.stop();
    } catch {}
    const opts = await getSpeechOptions("en-US");
    Speech.speak(value, { language: "en-US", voice: opts.voice, rate: opts.rate, pitch: opts.pitch });
    setTimeout(() => {
      try {
        Speech.speak(value, { language: "en-US", voice: opts.voice, rate: opts.rate, pitch: opts.pitch });
      } catch {}
    }, 600);
  };

  const onClear = () => {
    setEn("");
    setZh("");
    setExEn("");
    setExZh("");
    setAiNote("");
    setZhHeight(40);
    setExEnHeight(40);
    setExZhHeight(40);
  };

  const addWord = async () => {
    const _en = en.trim();
    const _zh = zh.trim();
    const _exEn = exEn.trim();
    const _exZh = exZh.trim();
    if (!_en || !_zh) return;
    const list = await loadWords();
    if (list.some((w) => w.en.toLowerCase() === _en.toLowerCase())) {
      Alert.alert(t("explore.exists"), t("explore.exists.message", { word: _en }));
      return;
    }
    const tagsSet = new Set<string>([REVIEW_TAG]);
    if (defaultTag && defaultTag !== REVIEW_TAG) tagsSet.add(defaultTag);
    const next: Word[] = [
      ...list,
      {
        en: _en,
        zh: _zh,
        exampleEn: _exEn,
        exampleZh: _exZh,
        status: "unknown",
        createdAt: new Date().toISOString(),
        reviewCount: 0,
        tags: Array.from(tagsSet),
      },
    ];
    await saveWords(next);
    onClear();
    setTimeout(() => {
      setMarkedTab(null);
    }, 0);
    Alert.alert(t("explore.added"), t("explore.added.message", { word: _en }));
  };

  const onAIFill = async () => {
    const _en = en.trim();
    const _zh = zh.trim();
    const onlyEn = !!_en && !_zh;
    const onlyZh = !!_zh && !_en;
    if (!onlyEn && !onlyZh) {
      Alert.alert(t("explore.ai.onlyOne"), t("explore.ai.onlyOne.message"));
      return;
    }
    try {
      setAiLoading(true);
      try {
        setAiNote(AI_NOTE_CALLING);
      } catch {}
      try {
        const hasKey = !!resolveOpenAIKey();
        console.log("[Explore] AI call start", { onlyEn, onlyZh, hasKey, en: _en, zh: _zh });
      } catch {}

      const prev = { en, zh, exEn, exZh };
      const res = await aiCompleteWord({ en: onlyEn ? _en : undefined, zh: onlyZh ? _zh : undefined });
      try {
        console.log("[Explore] AI response", res);
      } catch {}

      const changed: string[] = [];
      if (res.en !== undefined) setEn(res.en || "");
      if (res.en !== undefined && (res.en || "") !== prev.en) changed.push("en");
      if (res.zh !== undefined) setZh(res.zh || "");
      if (res.zh !== undefined && (res.zh || "") !== prev.zh) changed.push("zh");
      if (res.exampleEn !== undefined) setExEn(res.exampleEn || "");
      if (res.exampleEn !== undefined && (res.exampleEn || "") !== prev.exEn) changed.push("exampleEn");
      if (res.exampleZh !== undefined) setExZh(res.exampleZh || "");
      if (res.exampleZh !== undefined && (res.exampleZh || "") !== prev.exZh) changed.push("exampleZh");

      if (changed.length === 0) {
        const raw = (() => {
          try {
            return JSON.stringify(res).slice(0, 400);
          } catch {
            return "[unserializable]";
          }
        })();
        setAiNote(AI_NOTE_NO_FIELDS);
        Alert.alert(AI_ALERT_PREFIX, `${AI_ALERT_BODY_PREFIX}${raw}`);
      } else {
        try {
          setAiNote(`${AI_NOTE_UPDATED_PREFIX}${changed.join(", ")}`);
        } catch {}
      }

      const speakText = (res.en || _en || "").toString();
      if (speakText) await speakWordTwice(speakText);
    } catch (e: any) {
      try {
        console.error("[Explore] AI error", e);
      } catch {}
      Alert.alert(t("explore.ai.failed"), e?.message ?? "");
      try {
        setAiNote(`${AI_NOTE_FAILED_PREFIX}${e?.message || ""}`);
      } catch {}
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 20 }}>
        <View style={styles.header}>
          <Text style={styles.title}>✨ {t("explore.title")}</Text>
        </View>

        <View style={styles.quickActions}>
          <Pressable
            style={styles.quickButton}
            onPress={() => speakWordTwice(en)}
          >
            <Text style={styles.quickButtonText}>🔊 {t("explore.preview")}</Text>
          </Pressable>
          <Pressable
            style={[styles.quickButton, styles.clearButton]}
            onPress={onClear}
          >
            <Text style={styles.quickButtonText}>🗑️ {t("explore.clear")}</Text>
          </Pressable>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.sectionLabel}>📝 英文單字</Text>
          <TextInput
            style={styles.input}
            placeholder={t("explore.input.en")}
            value={en}
            onChangeText={setEn}
            autoCapitalize="none"
            placeholderTextColor="#999"
            onFocus={() => {
              if (en.trim() && zh.trim()) setZh("");
            }}
          />

          <Text style={styles.sectionLabel}>🌐 中文翻譯</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline, { height: zhHeight }]}
            placeholder={t("explore.input.zh")}
            value={zh}
            onChangeText={setZh}
            multiline
            scrollEnabled={false}
            placeholderTextColor="#999"
            onFocus={() => {
              if (en.trim() && zh.trim()) setEn("");
            }}
            onContentSizeChange={(e) => setZhHeight(Math.max(40, e.nativeEvent.contentSize.height))}
          />

          <Text style={styles.sectionLabel}>💬 英文例句</Text>
          <Text style={[styles.input, styles.inputMultiline, styles.hiddenMeasure]} onLayout={(e) => setExEnHeight(Math.max(40, e.nativeEvent.layout.height))}>
            {exEn || " "}
          </Text>
          <TextInput
            style={[styles.input, styles.inputMultiline, { height: exEnHeight }]}
            placeholder={t("explore.input.exEn")}
            value={exEn}
            onChangeText={setExEn}
            multiline
            scrollEnabled={false}
            placeholderTextColor="#999"
            onContentSizeChange={(e) => setExEnHeight(Math.max(40, e.nativeEvent.contentSize.height))}
          />

          <Text style={styles.sectionLabel}>📖 例句翻譯</Text>
          <Text style={[styles.input, styles.inputMultiline, styles.hiddenMeasure]} onLayout={(e) => setExZhHeight(Math.max(40, e.nativeEvent.layout.height))}>
            {exZh || " "}
          </Text>
          <TextInput
            style={[styles.input, styles.inputMultiline, { height: exZhHeight }]}
            placeholder={t("explore.input.exZh")}
            value={exZh}
            onChangeText={setExZh}
            multiline
            scrollEnabled={false}
            placeholderTextColor="#999"
            onContentSizeChange={(e) => setExZhHeight(Math.max(40, e.nativeEvent.contentSize.height))}
          />
        </View>

        <View style={styles.aiSection}>
          <Pressable
            style={[styles.aiButton, aiLoading && styles.aiButtonLoading]}
            onPress={onAIFill}
            disabled={aiLoading}
          >
            <Text style={styles.aiButtonText}>
              {aiLoading ? '⏳ ' : '🤖 '}{aiLoading ? t("explore.ai.loading") : t("explore.ai")}
            </Text>
          </Pressable>
          {aiLoading && <ActivityIndicator style={{ marginLeft: 12 }} />}
        </View>

        {!!aiNote && (
          <View style={styles.noteContainer}>
            <Text style={styles.noteText}>{aiNote}</Text>
          </View>
        )}

        <View style={styles.actionButtons}>
          <Pressable
            style={styles.primaryButton}
            onPress={addWord}
          >
            <Text style={styles.primaryButtonText}>➕ {t("explore.add")}</Text>
          </Pressable>

          {defaultTag ? (
            <Pressable
              style={styles.secondaryButton}
              onPress={() => router.push({ pathname: "/tags/[tag]", params: { tag: defaultTag } })}
            >
              <Text style={styles.secondaryButtonText}>⬅️ {t("explore.backToTag")}</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f7fa" },
  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 28, fontWeight: "700", color: "#1a1a1a" },
  quickActions: { paddingHorizontal: 16, paddingBottom: 16, flexDirection: "row", gap: 12 },
  quickButton: { flex: 1, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: "#e8f4f8", borderRadius: 10, borderWidth: 2, borderColor: "#0a7ea4", alignItems: "center" },
  clearButton: { backgroundColor: "#ffebee", borderColor: "#e74c3c" },
  quickButtonText: { color: "#0a7ea4", fontSize: 14, fontWeight: "700" },
  formCard: { marginHorizontal: 16, marginBottom: 16, padding: 16, backgroundColor: "#fff", borderRadius: 14, borderWidth: 2, borderColor: "#ddd" },
  sectionLabel: { fontSize: 14, fontWeight: "700", color: "#1a1a1a", marginBottom: 8, marginTop: 12 },
  input: { borderWidth: 2, borderColor: "#ddd", padding: 12, borderRadius: 10, marginBottom: 12, backgroundColor: "#f9fafb", width: "100%", fontSize: 16, color: "#1a1a1a" },
  inputMultiline: { textAlignVertical: "top" as const },
  aiSection: { marginHorizontal: 16, marginBottom: 16, flexDirection: "row", alignItems: "center" },
  aiButton: { flex: 1, paddingVertical: 14, backgroundColor: "#4CAF50", borderRadius: 12, alignItems: "center", elevation: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4 },
  aiButtonLoading: { opacity: 0.8 },
  aiButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  noteContainer: { marginHorizontal: 16, marginBottom: 16, padding: 12, backgroundColor: "#e8f4f8", borderLeftWidth: 4, borderLeftColor: "#0a7ea4", borderRadius: 8 },
  noteText: { color: "#0a7ea4", fontSize: 13, fontWeight: "600" },
  actionButtons: { marginHorizontal: 16, gap: 12 },
  primaryButton: { paddingVertical: 16, backgroundColor: "#2196F3", borderRadius: 12, alignItems: "center", elevation: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4 },
  primaryButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  secondaryButton: { paddingVertical: 14, backgroundColor: "#f0f0f0", borderRadius: 12, alignItems: "center", borderWidth: 2, borderColor: "#ddd" },
  secondaryButtonText: { color: "#1a1a1a", fontSize: 15, fontWeight: "600" },
  hiddenMeasure: { position: "absolute", opacity: 0, zIndex: -1, left: 0, right: 0, includeFontPadding: true },
});
