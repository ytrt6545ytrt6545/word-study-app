import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Alert, Button, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { loadWords, saveWords, Word, WordStatus, loadTags, saveTags, getDueCount } from "@/utils/storage";
import { useEffect, useState } from "react";

export default function Index() {
  const router = useRouter();
  const [dueToday, setDueToday] = useState<number>(0);
  const exportJson = async () => {
    const words = await loadWords();
    const tags = await loadTags();
    const sortPrefRaw = await AsyncStorage.getItem("@word_sort_desc");
    const sortDesc = sortPrefRaw === "1" || sortPrefRaw === "true";
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      prefs: { sortDesc },
      words,
      tags,
    };
    const fileUri = FileSystem.documentDirectory! + "WordList.json";
    await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(payload, null, 2));
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri);
    } else {
      Alert.alert("已輸出", "已寫入匯出檔，請使用系統分享。");
    }
  };

  const importJson = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: "application/json", copyToCacheDirectory: true });
    if (result.canceled || !result.assets?.[0]) return;
    const uri = result.assets[0].uri;
    const raw = await FileSystem.readAsStringAsync(uri);
    try {
      const parsed = JSON.parse(raw);
      const incoming: Word[] = Array.isArray(parsed) ? parsed : (parsed?.words ?? []);
      const incomingTags: string[] = Array.isArray((parsed as any)?.tags)
        ? ((parsed as any).tags as any[]).filter((t) => typeof t === 'string').map((t) => (t as string).trim()).filter(Boolean)
        : [];
      if (!Array.isArray(incoming)) throw new Error("format error");
      const incomingPref = Array.isArray(parsed) ? undefined : parsed?.prefs;
      if (incomingPref && typeof incomingPref.sortDesc === 'boolean') {
        await AsyncStorage.setItem("@word_sort_desc", incomingPref.sortDesc ? "1" : "0");
      }
      const current = await loadWords();
      const map = new Map<string, Word>(current.map(w => [w.en.toLowerCase(), w]));
      for (const w of incoming) {
        const status: WordStatus = (w.status === 'unknown' || w.status === 'learning' || w.status === 'mastered') ? w.status : 'unknown';
        const key = (w.en || '').toLowerCase();
        const existing = map.get(key);
        const incomingRC = typeof (w as any).reviewCount === 'number' ? (w as any).reviewCount : 0;
        const existingRC = typeof existing?.reviewCount === 'number' ? existing!.reviewCount! : 0;
        const reviewCount = Math.max(incomingRC, existingRC);
        const incomingLR = (w as any).lastReviewedAt ? Date.parse((w as any).lastReviewedAt) : 0;
        const existingLR = existing?.lastReviewedAt ? Date.parse(existing.lastReviewedAt) : 0;
        const lastReviewedAt = (incomingLR > existingLR ? (w as any).lastReviewedAt : existing?.lastReviewedAt) || undefined;
        const incomingTagsWord: string[] = Array.isArray((w as any).tags)
          ? ((w as any).tags as any[]).filter((t) => typeof t === 'string').map((t) => (t as string).trim()).filter(Boolean)
          : [];
        const existingTagsWord: string[] = Array.isArray((existing as any)?.tags)
          ? (((existing as any).tags as any[]).filter((t) => typeof t === 'string').map((t) => (t as string).trim()).filter(Boolean))
          : [];
        const tags = Array.from(new Set([...existingTagsWord, ...incomingTagsWord]));
        map.set(key, {
          en: w.en,
          zh: w.zh,
          exampleEn: w.exampleEn,
          exampleZh: w.exampleZh,
          status,
          createdAt: (w as any).createdAt || existing?.createdAt || new Date().toISOString(),
          reviewCount,
          lastReviewedAt,
          tags,
        });
      }
      const next = Array.from(map.values()).sort((a, b) => a.en.localeCompare(b.en));
      await saveWords(next);
      // merge tag registry
      const currentTagList = await loadTags();
      const mergedTagList = Array.from(new Set([...currentTagList, ...incomingTags]));
      await saveTags(mergedTagList);
      Alert.alert("已匯入", `已合併 ${incoming.length} 筆`);
    } catch (e) {
      Alert.alert("匯入失敗", "請確認為 JSON 檔案，格式：[{\n  \\\"en\\\":\\\"apple\\\", \\\"zh\\\":\\\"蘋果\\\", \\\"status\\\":\\\"learning\\\"\n}]");
    }
  };

  useEffect(() => {
    (async () => {
      setDueToday(await getDueCount());
    })();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>清單 匯入/匯出</Text>
      <Text>{`今日到期：${dueToday}`}</Text>
      <View style={styles.rowButtons}>
        <Button title="匯入 JSON" onPress={importJson} />
        <Button title="匯出 JSON" onPress={exportJson} />
        <Button title="標籤編輯" onPress={() => router.push('/tags')} />
        <Button title="複習" onPress={() => router.push('/review')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "#fff" },
  title: { fontSize: 28, fontWeight: "bold", marginBottom: 8 },
  rowButtons: { flexDirection: "row", gap: 10, marginTop: 8 },
});
