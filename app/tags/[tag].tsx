import { useCallback, useMemo, useState } from "react";
import { Alert, Button, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { bumpReview, loadWords, saveWords, Word, WordStatus } from "@/utils/storage";
import * as Speech from "expo-speech";
import { getSpeechOptions } from "@/utils/tts";

export default function TagWords() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tag?: string | string[] }>();
  const tag = (Array.isArray(params.tag) ? params.tag[0] : params.tag || "").toString();

  const [words, setWords] = useState<Word[]>([]);
  const [sortDesc, setSortDesc] = useState(true);

  useFocusEffect(useCallback(() => {
    (async () => {
      const list = await loadWords();
      const filtered = list.filter((w) => (w.tags || []).includes(tag));
      setWords(filtered);
    })();
  }, [tag]));

  const removeWord = (target: string) => {
    Alert.alert("刪除單字", `確定要刪除 ${target} 嗎？`, [
      { text: "取消" },
      {
        text: "刪除", style: "destructive", onPress: async () => {
          const full = await loadWords();
          const next = full.filter(w => w.en !== target);
          await saveWords(next);
          setWords(next.filter((w) => (w.tags || []).includes(tag)));
        }
      }
    ]);
  };

  const setStatus = async (en: string, status: WordStatus) => {
    const list = await loadWords();
    const next = list.map(w => w.en === en ? { ...w, status } : w);
    await saveWords(next);
    setWords(next.filter((w) => (w.tags || []).includes(tag)));
  };

  const nextStatus = (s: WordStatus): WordStatus => (s === 'unknown' ? 'learning' : s === 'learning' ? 'mastered' : 'unknown');

  const data = useMemo(() => {
    const arr = [...words];
    arr.sort((a, b) => {
      const at = new Date(a.createdAt || 0).getTime();
      const bt = new Date(b.createdAt || 0).getTime();
      return sortDesc ? bt - at : at - bt;
    });
    return arr;
  }, [words, sortDesc]);

  const formatYMD = (iso?: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const yy = String(d.getFullYear()).slice(-2);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yy}/${mm}/${dd}`;
  };

  const onSpeak = async (text: string, en: string) => {
    try {
      await bumpReview(en);
    } finally {
      try { Speech.stop(); } catch {}
      const opts = await getSpeechOptions('en-US');
      Speech.speak(text, { language: "en-US", voice: opts.voice, rate: opts.rate, pitch: opts.pitch });
      const list = await loadWords();
      setWords(list.filter((w) => (w.tags || []).includes(tag)));
    }
  };

  const onOpenDetail = async (en: string) => {
    await bumpReview(en);
    router.push({ pathname: "/word/[en]", params: { en } });
  };

  const renderItem = ({ item }: { item: Word }) => (
    <View style={styles.item}>
      <Pressable style={styles.contentArea} onPress={() => onOpenDetail(item.en)}>
        <Text style={styles.metaStamp}>{`${formatYMD(item.createdAt)}    ${(item.reviewCount || 0)}`}</Text>
        <View style={styles.itemTextBlock}>
          <Text style={styles.itemEn} numberOfLines={1} ellipsizeMode="tail">{item.en}</Text>
          <Text style={styles.itemZh}>{item.zh}</Text>
          {(item.tags && item.tags.length > 0) && (
            <View style={styles.tagRow}>
              {item.tags!.map((t) => (
                <View key={t} style={styles.tagPill}><Text style={styles.tagPillText}>{t}</Text></View>
              ))}
            </View>
          )}
        </View>
      </Pressable>
      <View style={styles.actions}>
        <Pressable style={styles.statusBox} onPress={() => setStatus(item.en, nextStatus(item.status))}>
          <Text style={styles.tiny}>熟悉度</Text>
          <View style={styles.pillRow}>
            <View style={[styles.dot, item.status === 'unknown'  && styles.dotRed]} />
            <View style={[styles.dot, item.status === 'learning' && styles.dotYellow]} />
            <View style={[styles.dot, item.status === 'mastered' && styles.dotGreen]} />
          </View>
        </Pressable>
        <View style={{ marginRight: 8 }}>
          <Button title="讀" onPress={() => onSpeak(item.en, item.en)} />
        </View>
        <Button title="刪" color="#c62828" onPress={() => removeWord(item.en)} />
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>標籤：{tag}</Text>
      <View style={styles.sortRow}>
        <Button title={sortDesc ? "最新在前" : "最舊在前"} onPress={() => setSortDesc((v) => !v)} />
      </View>
      <FlatList
        data={data}
        keyExtractor={(item, idx) => item.en + idx}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#fff" },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 12 },
  sortRow: { marginBottom: 8, alignSelf: 'flex-start' },
  item: { flexDirection: "row", alignItems: "center", padding: 12, backgroundColor: "#f5f7fb", borderRadius: 12 },
  contentArea: { flex: 1, minWidth: 0, position: 'relative', paddingRight: 8 },
  itemTextBlock: { paddingTop: 16 },
  itemEn: { fontSize: 18, fontWeight: "bold" },
  itemZh: { fontSize: 16 },
  metaStamp: { position: 'absolute', right: 0, top: 0, fontSize: 11, color: '#666' },
  dot: { width: 14, height: 14, borderRadius: 7, marginHorizontal: 3, backgroundColor: "#ddd", borderWidth: 1, borderColor: "#bbb" },
  dotRed: { backgroundColor: "#f44336" },
  dotYellow: { backgroundColor: "#ffb300" },
  dotGreen: { backgroundColor: "#43a047" },
  pillRow: { flexDirection: "row", alignItems: "center" },
  tiny: { fontSize: 12, color: "#666", marginBottom: 4 },
  actions: { flexDirection: 'row', alignItems: 'center', marginLeft: 8 },
  statusBox: { alignItems: 'center', marginRight: 8 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  tagPill: { paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#e3f2fd', borderRadius: 12, borderWidth: 1, borderColor: '#90caf9' },
  tagPillText: { fontSize: 12, color: '#1565c0' },
});
