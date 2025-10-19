import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, Button, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { loadWords, saveWords, Word, REVIEW_TAG } from "@/utils/storage";
import { aiCompleteWord, resolveOpenAIKey } from "@/utils/ai";
import { useTabMark } from "@/context/TabMarkContext";
import * as Speech from "expo-speech";
import { getSpeechOptions } from "@/utils/tts";
import { useI18n } from "@/i18n";

const AI_NOTE_CALLING = "\u0041\u0049\u003a\u0020\u547c\u53eb\u4e2d\u002e\u002e\u002e";
const AI_NOTE_NO_FIELDS = "\u0041\u0049\u003a\u0020\u5df2\u56de\u50b3\uff0c\u4f46\u627e\u4e0d\u5230\u53ef\u586b\u5165\u7684\u6b04\u4f4d";
const AI_ALERT_PREFIX = "\u8a3a\u65b7";
const AI_ALERT_BODY_PREFIX =
  "\u0041\u0049\u0020\u5df2\u56de\u50b3\u8cc7\u6599\uff0c\u4f46\u627e\u4e0d\u5230\u53ef\u586b\u5165\u7684\u6b04\u4f4d\u3002\u000a\u56de\u50b3\u7247\u6bb5\uff1a";
const AI_NOTE_UPDATED_PREFIX = "\u0041\u0049\u003a\u0020\u5df2\u66f4\u65b0\u0020\u2192\u0020";
const AI_NOTE_FAILED_PREFIX = "\u0041\u0049\u003a\u0020\u5931\u6557\u0020";
const AI_RESPONSE_TITLE = "\u0041\u0049\u0020\u56de\u61c9";
const AI_RESPONSE_PLACEHOLDER = "\u6309\u4e0b\u0020\u0041\u0049\u0020\u88dc\u9f4a\u5f8c\uff0c\u9019\u88e1\u6703\u986f\u793a\u539f\u59cb\u56de\u61c9\u0020\u004a\u0053\u004f\u004e";

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
  const [aiRaw, setAiRaw] = useState<string>("");
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
    setAiRaw("");
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
        // eslint-disable-next-line no-console
        console.log("[Explore] AI call start", { onlyEn, onlyZh, hasKey, en: _en, zh: _zh });
      } catch {}

      const prev = { en, zh, exEn, exZh };
      const res = await aiCompleteWord({ en: onlyEn ? _en : undefined, zh: onlyZh ? _zh : undefined });
      try {
        setAiRaw(JSON.stringify(res, null, 2));
      } catch {
        setAiRaw(String(res));
      }
      try {
        // eslint-disable-next-line no-console
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
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <Text style={styles.title}>{t("explore.title")}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Button title={t("explore.clear")} onPress={onClear} />
            <Button title={t("explore.preview")} onPress={() => speakWordTwice(en)} />
          </View>
        </View>
        <TextInput
          style={styles.input}
          placeholder={t("explore.input.en")}
          value={en}
          onChangeText={setEn}
          autoCapitalize="none"
          onFocus={() => {
            if (en.trim() && zh.trim()) setZh("");
          }}
        />
        <TextInput
          style={[styles.input, styles.inputMultiline, { height: zhHeight }]}
          placeholder={t("explore.input.zh")}
          value={zh}
          onChangeText={setZh}
          multiline
          scrollEnabled={false}
          onFocus={() => {
            if (en.trim() && zh.trim()) setEn("");
          }}
          onContentSizeChange={(e) => setZhHeight(Math.max(40, e.nativeEvent.contentSize.height))}
        />
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
          onContentSizeChange={(e) => setExEnHeight(Math.max(40, e.nativeEvent.contentSize.height))}
        />
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
          onContentSizeChange={(e) => setExZhHeight(Math.max(40, e.nativeEvent.contentSize.height))}
        />
        <View style={styles.rowButtons}>
          <Button title={aiLoading ? t("explore.ai.loading") : t("explore.ai")} onPress={onAIFill} disabled={aiLoading} />
          {aiLoading && <ActivityIndicator style={{ marginLeft: 8 }} />}
        </View>
        {!!aiNote && <Text style={{ color: "#666", marginBottom: 8 }}>{aiNote}</Text>}
        <Button title={t("explore.add")} onPress={addWord} />
        <View style={{ marginTop: 10 }}>
          <Text style={{ marginBottom: 6, color: "#333", fontWeight: "bold" }}>{AI_RESPONSE_TITLE}</Text>
          <TextInput
            style={[
              styles.input,
              styles.inputMultiline,
              { height: Math.max(100, Math.min(260, (aiRaw.split("\n").length + 1) * 18)) },
            ]}
            value={aiRaw}
            multiline
            editable={false}
            scrollEnabled
            placeholder={AI_RESPONSE_PLACEHOLDER}
          />
        </View>
        {defaultTag ? (
          <View style={{ marginTop: 10 }}>
            <Button title={t("explore.backToTag")} onPress={() => router.push({ pathname: "/tags/[tag]", params: { tag: defaultTag } })} />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#fff" },
  title: { fontSize: 24, fontWeight: "bold" },
  input: { borderWidth: 1, borderColor: "#ccc", padding: 10, borderRadius: 6, marginBottom: 8, backgroundColor: "#fff", width: "100%" },
  inputMultiline: { textAlignVertical: "top" as const },
  rowButtons: { flexDirection: "row", gap: 10, marginBottom: 12, alignItems: "center" },
  hiddenMeasure: { position: "absolute", opacity: 0, zIndex: -1, left: 0, right: 0, includeFontPadding: true },
});
