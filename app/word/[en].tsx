import { useEffect, useState } from "react";
import { Alert, Button, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as Speech from "expo-speech";
import { useLocalSearchParams, useRouter } from "expo-router";
import { bumpReview, loadWords, saveWords, Word, WordStatus, loadTags, toggleWordTag, buildOrderedTagTree, addTag, EXAM_TAG } from "../../utils/storage";
import { getSpeechOptions } from "../../utils/tts";
import { useI18n } from "@/i18n";
import { MaterialIcons, FontAwesome } from "@expo/vector-icons";

const Card = ({ children, style }: { children: React.ReactNode; style?: any }) => <View style={[styles.card, style]}>{children}</View>;

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
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [newTagText, setNewTagText] = useState("");
  const [tagTree, setTagTree] = useState<any[]>([]);

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
  }, [enParam, router, t]);

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
  const toggleExpand = (path: string) => {
    const next = new Set(expanded);
    if (next.has(path)) next.delete(path); else next.add(path);
    setExpanded(next);
  };
  useEffect(() => { (async () => setTagTree(await buildOrderedTagTree(tags)))(); }, [tags]);
  const renderTagTree = (nodes: any[], depth = 0) => (
    <>
      {nodes.map((node) => {
        const hasChildren = (node.children && node.children.length > 0) || false;
        const isOpen = expanded.has(node.path);
        const checked = (word?.tags || []).includes(node.path);
        return (
          <View key={node.path} style={{ flexDirection: 'column' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4, marginLeft: depth * 14 }}>
              {hasChildren ? (
                <Pressable onPress={() => toggleExpand(node.path)} style={{ padding: 2}}>
                  <MaterialIcons name={isOpen ? 'arrow-drop-down' : 'arrow-right'} size={24} color="#555" />
                </Pressable>
              ) : (
                <View style={{ width: 28 }} />
              )}
              <Pressable onPress={() => onToggleTag(node.path, !checked)} style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <MaterialIcons name={checked ? 'check-box' : 'check-box-outline-blank'} size={24} color={checked ? '#1976d2' : '#888'} />
                <Text style={styles.tagText}>{node.name}</Text>
              </Pressable>
            </View>
            {hasChildren && isOpen && (
              <View>
                {renderTagTree(node.children || [], depth + 1)}
              </View>
            )}
          </View>
        );
      })}
    </>
  );

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
      <View style={styles.container}>
        <Text style={styles.title}>{"載入中..."}</Text>
      </View>
    );

  const statusOptions: { key: WordStatus; label: string; icon: React.ComponentProps<typeof FontAwesome>['name'] }[] = [
    { key: "unknown", label: "新字", icon: 'question-circle' },
    { key: "learning", label: "學習中", icon: 'graduation-cap' },
    { key: "mastered", label: "已掌握", icon: 'check-circle' },
  ]

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
      <Card>
        <View style={styles.wordHeader}>
            <Text style={styles.title}>{word.en}</Text>
            <Pressable onPress={onListen} disabled={listening} style={styles.listenButton}>
                <MaterialIcons name="volume-up" size={32} color={listening ? "#ccc" : "#1976d2"} />
            </Pressable>
        </View>
        <TextInput
            style={[styles.input, styles.inputMultiline, { height: zhHeight, marginTop: 8 }]}
            value={zh}
            onChangeText={setZh}
            placeholder={"中文翻譯"}
            multiline
            scrollEnabled={false}
            onContentSizeChange={(e) => setZhHeight(Math.max(40, e.nativeEvent.contentSize.height))}
        />
        <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <FontAwesome name="calendar-o" size={13} color="#666" />
              <Text style={styles.metaText}>{t('word.createdAt', { date: formatYMD(word.createdAt) })}</Text>
            </View>
            <View style={styles.metaItem}>
              <MaterialIcons name="reviews" size={14} color="#666" />
              <Text style={styles.metaTextStrong}>{t('word.reviewCount', { count: (word.reviewCount || 0).toString() })}</Text>
            </View>
        </View>
      </Card>
      
      <Card>
        <Text style={styles.label}>{t('word.familiarity')}</Text>
        <View style={styles.statusContainer}>
            {statusOptions.map(opt => (
                <Pressable key={opt.key} style={[styles.statusButton, status === opt.key && styles.statusButtonSelected]} onPress={() => setStatus(opt.key)}>
                    <FontAwesome name={opt.icon} size={16} color={status === opt.key ? "#fff" : "#555"} />
                    <Text style={[styles.statusButtonText, status === opt.key && styles.statusButtonTextSelected]}>{opt.label}</Text>
                </Pressable>
            ))}
        </View>
      </Card>

      <Card>
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

        <Text style={[styles.label, { marginTop: 16 }]}>{t('word.exZh')}</Text>
        <TextInput
            style={[styles.input, styles.inputMultiline, { height: exZhHeight }]}
            value={exampleZh}
            onChangeText={setExampleZh}
            placeholder={"例句中文翻譯"}
            multiline
            scrollEnabled={false}
            onContentSizeChange={(e) => setExZhHeight(Math.max(40, e.nativeEvent.contentSize.height))}
        />
      </Card>

      <Card>
        <Pressable onPress={() => setTagsExpanded((v) => !v)} style={styles.cardHeader}>
            <Text style={styles.label}>{t('word.tags')}</Text>
            <MaterialIcons name={tagsExpanded ? 'expand-less' : 'expand-more'} size={28} color="#555" />
        </Pressable>
        {tagsExpanded && (
            <View style={styles.tagsList}>
            {renderTagTree(tagTree)}
            {tagTree.length === 0 && <Text style={styles.hint}>{t('word.tags.none')}</Text>}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16, gap: 8 }}>
                <TextInput style={[styles.input, { flex: 1 }]} value={newTagText} onChangeText={setNewTagText} placeholder={'輸入新標籤...'} />
                <Button title={'新增並勾選'} onPress={async () => {
                    const name = newTagText.trim();
                    if (!name || !word) return;
                    await addTag(name);
                    await toggleWordTag(word.en, name, true);
                    setNewTagText("");
                    await refreshWordFromStorage();
                    setTags(await loadTags());
                }} />
            </View>
            </View>
        )}
      </Card>

      <View style={styles.rowButtons}>
        <Pressable style={[styles.actionButton, styles.saveButton]} onPress={save}>
            <MaterialIcons name="save" size={20} color="#fff" />
            <Text style={styles.actionButtonText}>{t('word.save')}</Text>
        </Pressable>
        <Pressable style={[styles.actionButton, styles.deleteButton]} onPress={remove}>
            <MaterialIcons name="delete" size={20} color="#fff" />
            <Text style={styles.actionButtonText}>{t('word.delete')}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#f5f5f5" 
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    marginHorizontal: 16,
    marginTop: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  wordHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  title: { 
    fontSize: 34, 
    fontWeight: "bold",
    color: "#212121",
    flex: 1,
  },
  listenButton: {
    padding: 8,
  },
  metaRow: { 
    flexDirection: "row", 
    alignItems: "center", 
    gap: 16, 
    marginTop: 12 
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaText: { 
    fontSize: 13, 
    color: "#666" 
  },
  metaTextStrong: { 
    fontSize: 13, 
    color: "#c62828",
    fontWeight: "bold"
  },
  label: { 
      fontSize: 18, 
      fontWeight: '600',
      color: "#333",
      marginBottom: 10,
  },
  input: { 
    borderWidth: 1, 
    borderColor: "#e0e0e0", 
    padding: 12, 
    borderRadius: 8, 
    backgroundColor: "#f9f9f9", 
    width: "100%",
    fontSize: 16,
  },
  inputMultiline: { 
    textAlignVertical: "top" 
  },
  rowButtons: { 
    flexDirection: "row", 
    gap: 12, 
    marginTop: 32,
    marginHorizontal: 16,
  },
  tagsList: { 
    marginTop: 12, 
    gap: 2 
  },
  tagText: { 
    fontSize: 16,
    marginLeft: 8,
  },
  hint: { 
    color: "#777",
    paddingVertical: 8,
  },
  statusContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    gap: 8,
  },
  statusButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#ccc',
    gap: 8,
  },
  statusButtonSelected: {
    backgroundColor: '#1976d2',
    borderColor: '#1976d2',
  },
  statusButtonText: {
    fontSize: 14,
    color: '#555',
    fontWeight: '600',
  },
  statusButtonTextSelected: {
    color: '#fff',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    gap: 10,
  },
  saveButton: {
    backgroundColor: '#43a047',
  },
  deleteButton: {
    backgroundColor: '#d32f2f',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  }
});
