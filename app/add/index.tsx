import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, Button, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { loadWords, saveWords, Word, REVIEW_TAG } from "@/utils/storage";
import { aiCompleteWord } from "@/utils/ai";
import * as Speech from "expo-speech";
import { getSpeechOptions } from "@/utils/tts";
import { useI18n } from "@/i18n";

export default function AddWord() {
  const router = useRouter();
  const { t } = useI18n();
  const params = useLocalSearchParams<{ tag?: string | string[] }>();
  const defaultTag = (Array.isArray(params.tag) ? params.tag[0] : params.tag || "").toString();

  const [en, setEn] = useState("");
  const [zh, setZh] = useState("");
  const [exEn, setExEn] = useState("");
  const [exZh, setExZh] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [zhHeight, setZhHeight] = useState(40);
  const [exEnHeight, setExEnHeight] = useState(40);
  const [exZhHeight, setExZhHeight] = useState(40);

  const speakWordTwice = async (text: string) => {
    const t0 = (text || "").toString().trim();
    if (!t0) return;
    try { Speech.stop(); } catch {}
    const opts = await getSpeechOptions("en-US");
    Speech.speak(t0, { language: "en-US", voice: opts.voice, rate: opts.rate, pitch: opts.pitch });
    setTimeout(() => {
      try { Speech.speak(t0, { language: "en-US", voice: opts.voice, rate: opts.rate, pitch: opts.pitch }); } catch {}
    }, 600);
  };

  const onClear = () => {
    setEn("");
    setZh("");
    setExEn("");
    setExZh("");
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
      Alert.alert(t('explore.exists'), t('explore.exists.message', { word: _en }));
      return;
    }
    const tagsSet = new Set<string>([REVIEW_TAG]);
    if (defaultTag && defaultTag !== REVIEW_TAG) tagsSet.add(defaultTag);
    const next: Word[] = [
      ...list,
      { en: _en, zh: _zh, exampleEn: _exEn, exampleZh: _exZh, status: "unknown", createdAt: new Date().toISOString(), reviewCount: 0, tags: Array.from(tagsSet) },
    ];
    await saveWords(next);
    onClear();
    Alert.alert(t('explore.added'), t('explore.added.message', { word: _en }));
  };

  const onAIFill = async () => {
    const _en = en.trim();
    const _zh = zh.trim();
    const onlyEn = !!_en && !_zh;
    const onlyZh = !!_zh && !_en;
    if (!onlyEn && !onlyZh) {
      Alert.alert(t('explore.ai.onlyOne'), t('explore.ai.onlyOne.message'));
      return;
    }
    try {
      setAiLoading(true);
      const prev = { en, zh, exEn, exZh };
      const res = await aiCompleteWord({ en: onlyEn ? _en : undefined, zh: onlyZh ? _zh : undefined });
      // Update fields without showing AI raw/notes
      if (res.en !== undefined) setEn(res.en || "");
      if (res.zh !== undefined) setZh(res.zh || "");
      if (res.exampleEn !== undefined) setExEn(res.exampleEn || "");
      if (res.exampleZh !== undefined) setExZh(res.exampleZh || "");

      // Preview pronounce the English word twice if available
      const speakText = (res.en || _en || "").toString();
      if (speakText) await speakWordTwice(speakText);
    } catch (e: any) {
      try { console.error('[AddWord] AI error', e); } catch {}
      Alert.alert(t('explore.ai.failed'), e?.message ?? '');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 20 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <Text style={styles.title}>{t('explore.title')}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Button title={t('explore.clear')} onPress={onClear} />
            <Button title={t('explore.preview')} onPress={() => speakWordTwice(en)} />
          </View>
        </View>
        <TextInput
          style={styles.input}
          placeholder={t('explore.input.en')}
          value={en}
          onChangeText={setEn}
          autoCapitalize="none"
          onFocus={() => {
            if (en.trim() && zh.trim()) setZh("");
          }}
        />
        <TextInput
          style={[styles.input, styles.inputMultiline, { height: zhHeight }]}
          placeholder={t('explore.input.zh')}
          value={zh}
          onChangeText={setZh}
          multiline
          scrollEnabled={false}
          onFocus={() => {
            if (en.trim() && zh.trim()) setEn("");
          }}
          onContentSizeChange={(e) => setZhHeight(Math.max(40, e.nativeEvent.contentSize.height))}
        />
        {/* Hidden measurers to auto-fit heights when content is set by AI */}
        <Text style={[styles.input, styles.inputMultiline, styles.hiddenMeasure]} onLayout={(e) => setExEnHeight(Math.max(40, e.nativeEvent.layout.height))}>
          {exEn || " "}
        </Text>
        <TextInput
          style={[styles.input, styles.inputMultiline, { height: exEnHeight }]}
          placeholder={t('explore.input.exEn')}
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
          placeholder={t('explore.input.exZh')}
          value={exZh}
          onChangeText={setExZh}
          multiline
          scrollEnabled={false}
          onContentSizeChange={(e) => setExZhHeight(Math.max(40, e.nativeEvent.contentSize.height))}
        />
        <View style={styles.rowButtons}>
          <Button title={aiLoading ? t('explore.ai.loading') : t('explore.ai')} onPress={onAIFill} disabled={aiLoading} />
          {aiLoading && <ActivityIndicator style={{ marginLeft: 8 }} />}
        </View>
        <Button title={t('explore.add')} onPress={addWord} />
        {/* NOTE: Intentionally no AI response area or TXT box below the add button */}
        {defaultTag ? (
          <View style={{ marginTop: 10 }}>
            <Button title={t('explore.backToTag')} onPress={() => router.push({ pathname: "/tags/[tag]", params: { tag: defaultTag } })} />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#fff" },
  title: { fontSize: 24, fontWeight: "bold" },
  subtitle: { fontSize: 20, marginTop: 16, marginBottom: 8, fontWeight: "bold" },
  input: { borderWidth: 1, borderColor: "#ccc", padding: 10, borderRadius: 6, marginBottom: 8, backgroundColor: "#fff", width: "100%" },
  inputMultiline: { textAlignVertical: "top" as const },
  rowButtons: { flexDirection: "row", gap: 10, marginBottom: 12 },
  hiddenMeasure: { position: "absolute", opacity: 0, zIndex: -1, left: 0, right: 0, includeFontPadding: true },
});

