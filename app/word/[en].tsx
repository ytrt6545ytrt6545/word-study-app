import { useEffect, useState } from "react";
import { Alert, Button, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as Speech from "expo-speech";
import { useLocalSearchParams, useRouter } from "expo-router";
import { bumpReview, loadWords, saveWords, Word, WordStatus, loadTags, toggleWordTag } from "../../utils/storage";
import { getSpeechOptions } from "../../utils/tts";
import { useI18n } from "@/i18n";

export default function WordDetail() {
  const router = useRouter();
  const params = useLocalSearchParams<{ en?: string | string[] }>();
  const enParam = Array.isArray(params.en) ? params.en[0] : params.en || "";
  const { t } = useI18n();

  const [word, setWord] = useState<Word | null>(null);
  const [zh, setZh] = useState("");
  const [exampleEn, setExampleEn] = useState("");
  const [exampleZh, setExampleZh] = useState("");
  const [status, setStatus] = useState<WordStatus>("unknown");
  const [zhHeight, setZhHeight] = useState(40);
  const [exEnHeight, setExEnHeight] = useState(40);
  const [exZhHeight, setExZhHeight] = useState(40);
  const [listening, setListening] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [tagsExpanded, setTagsExpanded] = useState(false);

  useEffect(() => {
    (async () => {
      const list = await loadWords();
      const found = list.find((w) => w.en.toLowerCase() === enParam.toLowerCase());
      if (!found) {
        Alert.alert(t('index.review'), `${enParam} 不在清單中`);
        router.back();
        return;
      }
      setWord(found);
      setZh(found.zh || "");
      setExampleEn(found.exampleEn || "");
      setExampleZh(found.exampleZh || "");
      setStatus(found.status);
      setTags(await loadTags());
    })();
  }, [enParam, router]);

  useEffect(() => {
    return () => {
      try {
        Speech.stop();
      } catch {}
    };
  }, []);

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const formatYMD = (iso?: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const yy = String(d.getFullYear()).slice(-2);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yy}/${mm}/${dd}`;
  };

  const refreshWordFromStorage = async () => {
    const list = await loadWords();
    const found = list.find((w) => w.en.toLowerCase() === enParam.toLowerCase());
    if (found) setWord(found);
  };

  const onToggleTag = async (tag: string, enabled: boolean) => {
    if (!word) return;
    await toggleWordTag(word.en, tag, enabled);
    await refreshWordFromStorage();
  };

  const speakOnce = async (text: string, language?: string) => {
    const opts = await getSpeechOptions(language);
    return new Promise<void>((resolve, reject) => {
      try {
        Speech.speak(text, {
          language,
          voice: opts.voice,
          rate: opts.rate,
          pitch: opts.pitch,
          onDone: () => resolve(),
          onStopped: () => resolve(),
          onError: () => resolve(),
        });
      } catch (e) {
        reject(e);
      }
    });
  };

  const repeatSpeak = async (text: string, times: number, gapMs: number, language?: string) => {
    for (let i = 0; i < times; i++) {
      await speakOnce(text, language);
      if (i < times - 1) await sleep(gapMs);
    }
  };

  const onListen = async () => {
    if (!word) return;
    if (listening) return;
    try {
      setListening(true);
      await bumpReview(word.en);
      await refreshWordFromStorage();
      const en = word.en;
      const zhT = zh.trim();
      const exEnT = exampleEn.trim();
      const exZhT = exampleZh.trim();

      await speakOnce(en, "en-US");
      if (zhT) await speakOnce(zhT, "zh-TW");
      await repeatSpeak(en, 3, 0, "en-US");
      if (exEnT) await speakOnce(exEnT, "en-US");
      if (exZhT) await speakOnce(exZhT, "zh-TW");
      if (exEnT) await repeatSpeak(exEnT, 3, 0, "en-US");
    } catch (e: any) {
      Alert.alert(t('common.ok'), e?.message ?? '');
    } finally {
      setListening(false);
    }
  };

  const save = async () => {
    if (!word) return;
    const list = await loadWords();
    const updated: Word = { ...word, zh: zh.trim(), exampleEn: exampleEn.trim(), exampleZh: exampleZh.trim(), status };
    const merged = list.map((w) => (w.en === word.en ? updated : w));
    await saveWords(merged);
    Alert.alert(t('word.saved'), t('word.saved.message', { word: word.en }));
  };

  const remove = async () => {
    if (!word) return;
    Alert.alert(t('word.confirmDelete.title'), t('word.confirmDelete.message', { word: word.en }), [
      { text: t('common.cancel') },
      {
        text: t('common.delete'),
        style: "destructive",
        onPress: async () => {
          const list = await loadWords();
          const next = list.filter((w) => w.en !== word.en);
          await saveWords(next);
          router.back();
        },
      },
    ]);
  };

  if (!word)
    return (
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 20 }}>
        <Text style={styles.title}>{"載入中..."}</Text>
      </ScrollView>
    );

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 20 }}>
      <Text style={styles.title}>{word.en}</Text>
      <View style={styles.metaRow}>
        <Text style={styles.metaText}>{t('word.createdAt', { date: formatYMD(word.createdAt) })}</Text>
        <Text style={styles.metaTextStrong}>{t('word.reviewCount', { count: (word.reviewCount || 0).toString() })}</Text>
      </View>

      <Text style={styles.label}>{t('word.zh')}</Text>
      <TextInput
        style={[styles.input, styles.inputMultiline, { height: zhHeight }]}
        value={zh}
        onChangeText={setZh}
        placeholder={"中文翻譯"}
        multiline
        scrollEnabled={false}
        onContentSizeChange={(e) => setZhHeight(Math.max(40, e.nativeEvent.contentSize.height))}
      />

      <Text style={styles.label}>{t('word.exEn')}</Text>
      <TextInput
        style={[styles.input, styles.inputMultiline, { height: exEnHeight }]}
        value={exampleEn}
        onChangeText={setExampleEn}
        placeholder={"英文例句"}
        multiline
        scrollEnabled={false}
        onContentSizeChange={(e) => setExEnHeight(Math.max(40, e.nativeEvent.contentSize.height))}
      />

      <Text style={styles.label}>{t('word.exZh')}</Text>
      <TextInput
        style={[styles.input, styles.inputMultiline, { height: exZhHeight }]}
        value={exampleZh}
        onChangeText={setExampleZh}
        placeholder={"例句中文翻譯"}
        multiline
        scrollEnabled={false}
        onContentSizeChange={(e) => setExZhHeight(Math.max(40, e.nativeEvent.contentSize.height))}
      />

      <Pressable onPress={() => setStatus(status === "unknown" ? "learning" : status === "learning" ? "mastered" : "unknown")}>
        <Text style={styles.label}>{t('word.familiarity')}</Text>
        <View style={styles.pillRow}>
          <View style={[styles.dot, status === "unknown" && styles.dotRed]} />
          <View style={[styles.dot, status === "learning" && styles.dotYellow]} />
          <View style={[styles.dot, status === "mastered" && styles.dotGreen]} />
        </View>
      </Pressable>

      <Pressable onPress={() => setTagsExpanded((v) => !v)}>
        <Text style={styles.label}>{t('word.tags')}</Text>
      </Pressable>
      {tagsExpanded && (
        <View style={styles.tagsList}>
          {tags.map((t) => {
            const checked = (word.tags || []).includes(t);
            return (
              <Pressable key={t} style={styles.tagRow} onPress={() => onToggleTag(t, !checked)}>
                <View style={[styles.checkbox, checked && styles.checkboxChecked]} />
                <Text style={styles.tagText}>{t}</Text>
              </Pressable>
            );
          })}
          {tags.length === 0 && <Text style={styles.hint}>{t('word.tags.none')}</Text>}
        </View>
      )}

      <View style={styles.rowButtons}>
        <Button title={listening ? t('word.playing') : t('word.play')} onPress={onListen} disabled={listening} />
        <Button title={t('word.save')} onPress={save} />
        <Button title={t('word.delete')} color="#c62828" onPress={remove} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#fff" },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 12 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: -6, marginBottom: 8 },
  metaText: { fontSize: 12, color: "#666" },
  metaTextStrong: { fontSize: 12, color: "#c62828" },
  label: { marginTop: 12, marginBottom: 6, fontSize: 14, color: "#333" },
  input: { borderWidth: 1, borderColor: "#ccc", padding: 10, borderRadius: 6, backgroundColor: "#fff", width: "100%" },
  inputMultiline: { textAlignVertical: "top" as const },
  rowButtons: { flexDirection: "row", gap: 10, marginTop: 16 },
  tagsList: { marginTop: 8, gap: 8 },
  tagRow: { flexDirection: "row", alignItems: "center", paddingVertical: 6 },
  checkbox: { width: 18, height: 18, borderWidth: 1, borderColor: "#888", marginRight: 8, borderRadius: 3, backgroundColor: "#fff" },
  checkboxChecked: { backgroundColor: "#1976d2", borderColor: "#1976d2" },
  tagText: { fontSize: 14 },
  hint: { color: "#777" },
  pillRow: { flexDirection: "row", alignItems: "center", marginTop: 8 },
  dot: { width: 18, height: 18, borderRadius: 9, marginRight: 8, backgroundColor: "#ddd", borderWidth: 1, borderColor: "#bbb" },
  dotRed: { backgroundColor: "#f44336" },
  dotYellow: { backgroundColor: "#ffb300" },
  dotGreen: { backgroundColor: "#43a047" },
});
