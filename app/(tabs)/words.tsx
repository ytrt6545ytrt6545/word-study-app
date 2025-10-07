import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Button, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { bumpReview, loadWords, saveWords, Word, WordStatus, REVIEW_TAG, getWordFontSize } from "@/utils/storage";
import * as Speech from "expo-speech";
import { getSpeechOptions } from "@/utils/tts";
import { useTabMark } from "@/context/TabMarkContext";
import { useI18n } from "@/i18n";

const SORT_PREF_KEY = "@word_sort_desc";

export default function Words() {
  const router = useRouter();
  const { setMarkedTab } = useTabMark();
  const { t } = useI18n();
  const [words, setWords] = useState<Word[]>([]);
  const [sortDesc, setSortDesc] = useState(true);
  const [search, setSearch] = useState("");
  const [wordFont, setWordFont] = useState<number>(18);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(SORT_PREF_KEY);
        if (raw !== null) setSortDesc(raw === "1" || raw === "true");
      } catch {}
    })();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(SORT_PREF_KEY, sortDesc ? "1" : "0").catch(() => {});
  }, [sortDesc]);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        setWords(await loadWords());
        setWordFont(await getWordFontSize());
      })();
    }, [])
  );

  const removeWord = (target: string) => {
    Alert.alert(t('words.confirmDelete.title'), t('words.confirmDelete.message', { word: target }), [
      { text: t('common.cancel') },
      {
        text: t('common.delete'),
        style: "destructive",
        onPress: async () => {
          const next = (await loadWords()).filter((w) => w.en !== target);
          await saveWords(next);
          setWords(next);
        },
      },
    ]);
  };

  const setStatus = async (en: string, status: WordStatus) => {
    const list = await loadWords();
    const next = list.map((w) => (w.en === en ? { ...w, status } : w));
    await saveWords(next);
    setWords(next);
  };

  const nextStatus = (s: WordStatus): WordStatus => (s === "unknown" ? "learning" : s === "learning" ? "mastered" : "unknown");

  const data = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? words.filter((w) => {
          const fields = [w.en, w.zh, w.exampleEn, w.exampleZh].map((s) => (s || "").toLowerCase());
          const tags = (w.tags || []).map((t) => (t || "").toLowerCase());
          return fields.some((s) => s.includes(q)) || tags.some((t) => t.includes(q));
        })
      : words;
    const arr = [...filtered];
    arr.sort((a, b) => {
      const at = new Date(a.createdAt || 0).getTime();
      const bt = new Date(b.createdAt || 0).getTime();
      return sortDesc ? bt - at : at - bt;
    });
    return arr;
  }, [words, sortDesc, search]);

  const formatYMD = (iso?: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const yy = String(d.getFullYear()).slice(-2);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yy}/${mm}/${dd}`;
  };

  const onSpeak = async (text: string, en: string) => {
    try {
      await bumpReview(en);
    } finally {
      try {
        Speech.stop();
      } catch {}
      const opts = await getSpeechOptions("en-US");
      Speech.speak(text, { language: "en-US", voice: opts.voice, rate: opts.rate, pitch: opts.pitch });
      setWords(await loadWords());
    }
  };

  const onOpenDetail = async (en: string) => {
    await bumpReview(en);
    router.push({ pathname: "/word/[en]", params: { en } });
  };

  const renderItem = ({ item }: { item: Word }) => (
    <View style={styles.item}>
      {/* Top: word + translation */}
      <Pressable style={styles.topArea} onPress={() => onOpenDetail(item.en)}>
        <Text style={[styles.itemEn, { fontSize: wordFont }]} numberOfLines={1} ellipsizeMode="tail">
          {item.en}
        </Text>
        <Text style={styles.itemZh}>{item.zh}</Text>
      </Pressable>

      {/* Middle: tags */}
      {item.tags && item.tags.length > 0 && (
        <View style={styles.tagRow}>
          {item.tags!.map((tagName) => (
            <Pressable key={tagName} onPress={() => router.push({ pathname: "/tags/[tag]", params: { tag: tagName } })} style={[styles.tagPill, tagName === REVIEW_TAG && styles.tagPillReview]}>
              <Text style={[styles.tagPillText, tagName === REVIEW_TAG && styles.tagPillTextReview]}>{tagName}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Bottom: date, review count, status, read, delete */}
      <View style={styles.bottomRow}>
        <Text style={styles.metaLeft}>{formatYMD(item.createdAt)}</Text>
        <Text style={[styles.metaLeft, styles.reviewCount]}>{item.reviewCount || 0}</Text>
        <Pressable style={styles.statusBoxInline} onPress={() => setStatus(item.en, nextStatus(item.status))}>
          <Text style={styles.tiny}>{t('words.familiarity')}</Text>
          <View style={styles.pillRow}>
            <View style={[styles.dot, item.status === "unknown" && styles.dotRed]} />
            <View style={[styles.dot, item.status === "learning" && styles.dotYellow]} />
            <View style={[styles.dot, item.status === "mastered" && styles.dotGreen]} />
          </View>
        </Pressable>
        <View style={{ marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Button title={t('words.read')} onPress={() => onSpeak(item.en, item.en)} />
          <Button title={t('words.delete')} color="#c62828" onPress={() => removeWord(item.en)} />
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('words.title')}</Text>
      <TextInput
        style={styles.searchInput}
        placeholder={t('words.search.placeholder')}
        value={search}
        onChangeText={setSearch}
        returnKeyType="search"
      />
      <View style={styles.addRow}>
        <Button
          title={t('words.add')}
          onPress={() => {
            router.push("/add");
          }}
        />
        <View style={{ width: 10 }} />
        <Button title={t('words.import')} onPress={() => router.push("/(tabs)/reading")} />
      </View>
      <View style={styles.sortRow}>
        <Button title={sortDesc ? t('words.sort.new2old') : t('words.sort.old2new')} onPress={() => setSortDesc((v) => !v)} />
      </View>
      <FlatList data={data} keyExtractor={(item, idx) => item.en + idx} renderItem={renderItem} ItemSeparatorComponent={() => <View style={{ height: 10 }} />} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#fff" },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 12 },
  searchInput: { width: "100%", borderWidth: 1, borderColor: "#ccc", padding: 10, borderRadius: 6, backgroundColor: "#fff", marginBottom: 8 },
  addRow: { marginBottom: 8, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 10 },
  sortRow: { marginBottom: 8, alignSelf: "flex-start" },
  item: { padding: 12, backgroundColor: "#f5f7fb", borderRadius: 12 },
  topArea: { marginBottom: 8 },
  itemEn: { fontSize: 18, fontWeight: "bold" },
  itemZh: { fontSize: 16 },
  bottomRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 10, marginTop: 10 },
  metaLeft: { fontSize: 11, color: "#666" },
  reviewCount: { color: "#c62828" },
  tiny: { fontSize: 12, color: "#666", marginBottom: 4 },
  statusBoxInline: { alignItems: "center" },
  pillRow: { flexDirection: "row", alignItems: "center" },
  dot: { width: 14, height: 14, borderRadius: 7, marginHorizontal: 3, backgroundColor: "#ddd", borderWidth: 1, borderColor: "#bbb" },
  dotRed: { backgroundColor: "#f44336" },
  dotYellow: { backgroundColor: "#ffb300" },
  dotGreen: { backgroundColor: "#43a047" },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  tagPill: { paddingHorizontal: 8, paddingVertical: 4, backgroundColor: "#eceff1", borderRadius: 12, borderWidth: 1, borderColor: "#cfd8dc" },
  tagPillReview: { backgroundColor: "#e3f2fd", borderColor: "#90caf9" },
  tagPillText: { fontSize: 12, color: "#37474f" },
  tagPillTextReview: { color: "#1565c0" },
});
