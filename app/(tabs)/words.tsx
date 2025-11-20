import { THEME } from "@/constants/Colors";
import { useI18n } from "@/i18n";
import { bumpReview, getWordFontSize, loadWords, saveWords, Word, WordStatus } from "@/utils/storage";
import { getSpeechOptions } from "@/utils/tts";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import * as Speech from "expo-speech";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, FlatList, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

const SORT_PREF_KEY = "@word_sort_desc";

export default function Words() {
  const router = useRouter();
  const { t } = useI18n();
  const [words, setWords] = useState<Word[]>([]);
  const [sortDesc, setSortDesc] = useState(true);
  const [search, setSearch] = useState("");
  const [wordFont, setWordFont] = useState<number>(18);
  const speechOptsRef = useRef<{ en: Awaited<ReturnType<typeof getSpeechOptions>> | null }>({ en: null });

  const refreshSpeechOptions = useCallback(async () => {
    try {
      const enOpts = await getSpeechOptions("en-US");
      speechOptsRef.current = { en: enOpts };
    } catch (err) {
      console.error("load speech options failed", err);
      speechOptsRef.current = { en: null };
    }
  }, []);

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
      let active = true;
      (async () => {
        try {
          const [list, fontSize] = await Promise.all([loadWords(), getWordFontSize()]);
          if (!active) return;
          setWords(list);
          setWordFont(fontSize);
        } finally {
          await refreshSpeechOptions();
        }
      })();
      return () => {
        active = false;
      };
    }, [refreshSpeechOptions])
  );

  const deleteAndPersist = async (target: string) => {
    const next = (await loadWords()).filter((w) => w.en !== target);
    await saveWords(next);
    setWords(next);
  };

  const removeWord = (target: string) => {
    const title = t("words.confirmDelete.title");
    const message = t("words.confirmDelete.message", { word: target });

    if (Platform.OS === "web" && typeof window !== "undefined") {
      if (window.confirm(`${title}\n\n${message}`)) {
        deleteAndPersist(target).catch((err) => console.error("delete word failed", err));
      }
      return;
    }

    Alert.alert(title, message, [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: () => {
          deleteAndPersist(target).catch((err) => console.error("delete word failed", err));
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
          // NOTE: per request, do not include tag text in the main word list search/filter
          return fields.some((s) => s.includes(q));
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

  const onSpeak = (text: string, en: string) => {
    const opts = speechOptsRef.current?.en;

    try {
      Speech.stop();
    } catch {}

    try {
      Speech.speak(text, {
        language: "en-US",
        voice: opts?.voice,
        rate: opts?.rate,
        pitch: opts?.pitch,
      });
    } catch (err) {
      console.error("speech speak failed", err);
    }

    void (async () => {
      try {
        await bumpReview(en);
        setWords(await loadWords());
      } catch (err) {
        console.error("update review after speak failed", err);
      }
    })();
  };

  const onOpenDetail = async (en: string) => {
    await bumpReview(en);
    router.push({ pathname: "/word/[en]", params: { en } });
  };

  const renderItem = ({ item }: { item: Word }) => (
    <Pressable
      style={styles.item}
      onPress={() => onOpenDetail(item.en)}
    >
      {/* Top: word + translation */}
      <View style={styles.topArea}>
        <Text style={[styles.itemEn, { fontSize: wordFont }]} numberOfLines={1} ellipsizeMode="tail">
          {item.en}
        </Text>
        <Text style={styles.itemZh}>{item.zh || '—'}</Text>
      </View>

      {/* Tags removed from list view per request */}

      {/* Bottom: date, review count, status, read, delete */}
      <View style={styles.bottomRow}>
        <View style={styles.metaGroup}>
          <Text style={styles.metaIcon}>📅</Text>
          <Text style={styles.metaText}>{formatYMD(item.createdAt)}</Text>
        </View>
        <View style={styles.metaGroup}>
          <Text style={styles.metaIcon}>🔁</Text>
          <Text style={styles.metaText}>{item.reviewCount || 0}</Text>
        </View>
        <Pressable
          style={styles.statusButton}
          onPress={(e) => {
            e.stopPropagation();
            setStatus(item.en, nextStatus(item.status));
          }}
        >
          <View style={styles.pillRow}>
            <View style={[styles.dot, item.status === "unknown" && styles.dotRed]} />
            <View style={[styles.dot, item.status === "learning" && styles.dotYellow]} />
            <View style={[styles.dot, item.status === "mastered" && styles.dotGreen]} />
          </View>
        </Pressable>
        <View style={{ marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Pressable
            style={styles.actionButton}
            onPress={(e) => {
              e.stopPropagation();
              onSpeak(item.en, item.en);
            }}
          >
            <Text style={styles.actionButtonText}>🔊</Text>
          </Pressable>
          <Pressable
            style={[styles.actionButton, styles.deleteButton]}
            onPress={(e) => {
              e.stopPropagation();
              removeWord(item.en);
            }}
          >
            <Text style={styles.actionButtonText}>🗑️</Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>📚 {t('words.title')}</Text>
      </View>

      <View style={styles.searchContainer}>
        <MaterialIcons name="search" size={20} color={THEME.colors.gray[500]} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder={t('words.search.placeholder')}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
          placeholderTextColor={THEME.colors.gray[400]}
        />
      </View>

      <View style={styles.sortRow}>
        <Pressable
          style={styles.sortButton}
          onPress={() => setSortDesc((v) => !v)}
        >
          <Text style={styles.sortButtonIcon}>{sortDesc ? '⬇️' : '⬆️'}</Text>
          <Text style={styles.sortButtonText}>{sortDesc ? t('words.sort.new2old') : t('words.sort.old2new')}</Text>
        </Pressable>
      </View>

      {data.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🔍</Text>
          <Text style={styles.emptyTitle}>暫無結果</Text>
          <Text style={styles.emptySubtitle}>
            {search ? '搜尋不到符合條件的單字' : '暫無單字，前往「新增單字」頁面新增'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item, idx) => item.en + idx}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f7fa" },
  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 28, fontWeight: "700", color: "#1a1a1a" },
  searchContainer: { marginHorizontal: 16, marginBottom: 16, flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderWidth: 2, borderColor: "#ddd", borderRadius: 12, paddingHorizontal: 12 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, paddingHorizontal: 8, paddingVertical: 12, fontSize: 16, color: "#1a1a1a" },
  sortRow: { marginHorizontal: 16, marginBottom: 16, alignSelf: "flex-start" },
  sortButton: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: "#fff", borderRadius: 10, borderWidth: 2, borderColor: "#ddd" },
  sortButtonIcon: { fontSize: 16 },
  sortButtonText: { fontSize: 14, fontWeight: "600", color: "#1a1a1a" },
  item: { marginHorizontal: 16, padding: 16, backgroundColor: "#fff", borderRadius: 14, borderWidth: 2, borderColor: "#ddd", elevation: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4 },
  topArea: { marginBottom: 12 },
  itemEn: { fontSize: 18, fontWeight: "700", color: "#1a1a1a", marginBottom: 4 },
  itemZh: { fontSize: 15, color: "#666", fontWeight: "500" },
  bottomRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 10, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#f0f0f0" },
  metaGroup: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaIcon: { fontSize: 14 },
  metaText: { fontSize: 12, color: "#666", fontWeight: "500" },
  statusButton: { paddingHorizontal: 8, paddingVertical: 6, backgroundColor: "#f0f0f0", borderRadius: 8 },
  pillRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: "#ddd", borderWidth: 1, borderColor: "#bbb" },
  dotRed: { backgroundColor: "#e74c3c", borderColor: "#c0392b" },
  dotYellow: { backgroundColor: "#f39c12", borderColor: "#d68910" },
  dotGreen: { backgroundColor: "#4CAF50", borderColor: "#388e3c" },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  tagPill: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: "#f9fafb", borderRadius: 14, borderWidth: 2, borderColor: "#ddd" },
  tagPillReview: { backgroundColor: "#e3f2fd", borderColor: "#0a7ea4" },
  tagPillText: { fontSize: 12, color: "#666", fontWeight: "600" },
  tagPillTextReview: { color: "#0a7ea4", fontWeight: "700" },
  actionButton: { paddingHorizontal: 10, paddingVertical: 8, backgroundColor: "#f0f0f0", borderRadius: 8, borderWidth: 1, borderColor: "#ddd", alignItems: "center", justifyContent: "center" },
  actionButtonText: { fontSize: 16 },
  deleteButton: { backgroundColor: "#ffebee", borderColor: "#e74c3c" },
  emptyContainer: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, paddingBottom: 40 },
  emptyIcon: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: "700", color: "#1a1a1a", marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: "#999", textAlign: "center", lineHeight: 20 },
});
