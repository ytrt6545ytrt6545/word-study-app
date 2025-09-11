import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, Button, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { loadWords, saveWords, Word } from "../../utils/storage";
import { aiCompleteWord } from "@/utils/ai";
import { useTabMark } from "@/context/TabMarkContext";
import * as Speech from "expo-speech";
import { getSpeechOptions } from "@/utils/tts";

export default function Explore() {
  const router = useRouter();
  const { setMarkedTab } = useTabMark();
  const [en, setEn] = useState("");
  const [zh, setZh] = useState("");
  const [exEn, setExEn] = useState("");
  const [exZh, setExZh] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [zhHeight, setZhHeight] = useState(40);
  const [exEnHeight, setExEnHeight] = useState(40);
  const [exZhHeight, setExZhHeight] = useState(40);

  const addWord = async () => {
    const _en = en.trim(), _zh = zh.trim();
    const _exEn = exEn.trim(), _exZh = exZh.trim();
    if (!_en || !_zh) return;
    const list = await loadWords();
    if (list.some(w => w.en.toLowerCase() === _en.toLowerCase())) {
      Alert.alert("重複了", `${_en} 已在清單`);
      return;
    }
    const next: Word[] = [...list, { en: _en, zh: _zh, exampleEn: _exEn, exampleZh: _exZh, status: "unknown", createdAt: new Date().toISOString(), reviewCount: 0 }];
    await saveWords(next);
    setEn(""); setZh(""); setExEn(""); setExZh("");
    setTimeout(() => { setMarkedTab(null); router.push('/(tabs)/words'); }, 0);
    Alert.alert("已新增", `${_en} 已加入清單`);
  };

  const onAIFill = async () => {
    const _en = en.trim();
    const _zh = zh.trim();
    const onlyEn = !!_en && !_zh;
    const onlyZh = !!_zh && !_en;
    if (!onlyEn && !onlyZh) {
      Alert.alert("AI補齊", "請只填「英文單字」或「中文翻譯」其一");
      return;
    }
    try {
      setAiLoading(true);
      const res = await aiCompleteWord({ en: onlyEn ? _en : undefined, zh: onlyZh ? _zh : undefined });
      // 強制更新：只要有回傳就覆寫
      if (res.en !== undefined) setEn(res.en || "");
      if (res.zh !== undefined) setZh(res.zh || "");
      if (res.exampleEn !== undefined) setExEn(res.exampleEn || "");
      if (res.exampleZh !== undefined) setExZh(res.exampleZh || "");

      // 念一次英文單字（以回傳為主，否則用原輸入）
      const speakText = (res.en || _en || "").toString();
      if (speakText) {
        try { Speech.stop(); } catch {}
        const opts = await getSpeechOptions('en-US');
        Speech.speak(speakText, { language: 'en-US', voice: opts.voice, rate: opts.rate, pitch: opts.pitch });
      }
    } catch (e: any) {
      Alert.alert("AI 失敗", e?.message ?? "請稍後再試");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 20 }}>
        <Text style={styles.title}>{"新增單字"}</Text>
        <TextInput style={styles.input}
          placeholder={"英文單字"}
          value={en}
          onChangeText={setEn}
          autoCapitalize="none"
        />
        <TextInput style={[styles.input, styles.inputMultiline, { height: zhHeight }]}
          placeholder={"英文單字中文翻譯"}
          value={zh}
          onChangeText={setZh}
          multiline
          scrollEnabled={false}
          onContentSizeChange={(e) => setZhHeight(Math.max(40, e.nativeEvent.contentSize.height))}
        />
        {/* Hidden measurer to auto-fit height when content is set by AI */}
        <Text
          style={[styles.input, styles.inputMultiline, styles.hiddenMeasure]}
          onLayout={(e) => setExEnHeight(Math.max(40, e.nativeEvent.layout.height))}
        >
          {exEn || " "}
        </Text>
        <TextInput style={[styles.input, styles.inputMultiline, { height: exEnHeight }]}
          placeholder={"英文例句"}
          value={exEn}
          onChangeText={setExEn}
          multiline
          scrollEnabled={false}
          onContentSizeChange={(e) => setExEnHeight(Math.max(40, e.nativeEvent.contentSize.height))}
        />
        {/* Hidden measurer to auto-fit height when content is set by AI */}
        <Text
          style={[styles.input, styles.inputMultiline, styles.hiddenMeasure]}
          onLayout={(e) => setExZhHeight(Math.max(40, e.nativeEvent.layout.height))}
        >
          {exZh || " "}
        </Text>
        <TextInput style={[styles.input, styles.inputMultiline, { height: exZhHeight }]}
          placeholder={"英文例句中文翻譯"}
          value={exZh}
          onChangeText={setExZh}
          multiline
          scrollEnabled={false}
          onContentSizeChange={(e) => setExZhHeight(Math.max(40, e.nativeEvent.contentSize.height))}
        />
        <View style={styles.rowButtons}>
          <Button title={aiLoading ? "AI補齊中..." : "AI補齊"} onPress={onAIFill} disabled={aiLoading} />
          {aiLoading && <ActivityIndicator style={{ marginLeft: 8 }} />}
        </View>
        <Button title={"加入清單"} onPress={addWord} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#fff" },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 12 },
  subtitle: { fontSize: 20, marginTop: 16, marginBottom: 8, fontWeight: "bold" },
  input: { borderWidth: 1, borderColor: "#ccc", padding: 10, borderRadius: 6, marginBottom: 8, backgroundColor: "#fff", width: "100%" },
  inputMultiline: { textAlignVertical: "top" as const },
  rowButtons: { flexDirection: "row", gap: 10, marginBottom: 12 },
  hiddenMeasure: { position: 'absolute', opacity: 0, zIndex: -1, left: 0, right: 0, includeFontPadding: true },
});
