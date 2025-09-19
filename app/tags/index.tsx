import { addTag, loadTags, removeTag, removeTags, renameTag, REVIEW_TAG } from "@/utils/storage";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

export default function TagsManage() {
  const router = useRouter();
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameText, setRenameText] = useState("");
  const [search, setSearch] = useState("");
  const [asc, setAsc] = useState(true);

  const refresh = async () => setTags(await loadTags());

  useEffect(() => {
    refresh();
  }, []);

  const onAdd = async () => {
    const name = newTag.trim();
    if (!name) { Alert.alert("請輸入標籤名稱"); return; }
    await addTag(name);
    setNewTag("");
    await refresh();
  };

  const onDelete = async (t: string) => {
    Alert.alert(
      "刪除標籤",
      `確定要刪除「${t}」這個標籤嗎？\n刪除後無法復原。`,
      [
        { text: "取消" },
        { text: "刪除", style: "destructive", onPress: async () => { await removeTag(t); await refresh(); } },
      ]
    );
  };

  const onToggleSelect = (t: string) => {
    if (t === REVIEW_TAG) return;
    const next = new Set(selected);
    if (next.has(t)) next.delete(t); else next.add(t);
    setSelected(next);
  };

  const onBulkDelete = async () => {
    const list = Array.from(selected);
    if (list.length === 0) return;
    Alert.alert(
      "批次刪除標籤",
      `確定要刪除 ${list.length} 個標籤嗎？\n刪除後無法復原。`,
      [
        { text: "取消" },
        { text: "刪除", style: "destructive", onPress: async () => { await removeTags(list); setSelected(new Set()); await refresh(); } },
      ]
    );
  };

  const startRename = (t: string) => { setRenaming(t); setRenameText(t); };
  const cancelRename = () => { setRenaming(null); setRenameText(""); };
  const confirmRename = async () => {
    const from = renaming || "";
    const to = renameText.trim();
    if (!from) return;
    if (!to) { Alert.alert("請輸入新名稱"); return; }
    await renameTag(from, to);
    cancelRename();
    await refresh();
  };

  const viewTags = useMemo(() => {
    const q = search.trim();
    const filtered = q ? tags.filter((t) => t.toLowerCase().includes(q.toLowerCase())) : tags;
    const sorted = [...filtered].sort((a, b) => asc ? a.localeCompare(b) : b.localeCompare(a));
    return sorted;
  }, [tags, search, asc]);

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 20 }}>
      <Text style={styles.title}>標籤管理</Text>

      <View style={styles.rowAdd}>
        <Button title="新增標籤" onPress={onAdd} />
        <TextInput
          style={styles.input}
          placeholder="輸入標籤名稱"
          value={newTag}
          onChangeText={setNewTag}
          returnKeyType="done"
          onSubmitEditing={onAdd}
        />
      </View>

      <Text style={styles.label}>標籤列表</Text>
      <View style={styles.bulkRow}>
        <Button title={`批次刪除 (${selected.size})`} onPress={onBulkDelete} disabled={selected.size === 0} color={selected.size === 0 ? undefined : "#c62828"} />
      </View>
      <View style={styles.searchRow}>
        <TextInput style={[styles.input, { flex: 1 }]} placeholder="搜尋標籤" value={search} onChangeText={setSearch} />
        <View style={{ width: 8 }} />
        <Button title={asc ? "排序 A→Z" : "排序 Z→A"} onPress={() => setAsc((v) => !v)} />
      </View>
      <View style={styles.tagsWrap}>
        {viewTags.map((t) => {
          const isRenaming = renaming === t;
          const isSelected = selected.has(t);
          return (
            <View key={t} style={styles.tagItem}>
              <Pressable onPress={() => onToggleSelect(t)}>
                <View style={[styles.chkbox, isSelected && styles.chkboxChecked]}>
                  <Text style={styles.chkMark}>{isSelected ? "✓" : ""}</Text>
                </View>
              </Pressable>
              {isRenaming ? (
                <>
                  <TextInput style={[styles.input, { flex: 0, width: 140, marginRight: 6 }]} value={renameText} onChangeText={setRenameText} placeholder="輸入新名稱" />
                  <Button title="確認" onPress={confirmRename} />
                  <View style={{ width: 6 }} />
                  <Button title="取消" onPress={cancelRename} />
                </>
              ) : (
                <>
                  <View style={{ marginRight: 6 }}>
                    <Button title={t + (t === REVIEW_TAG ? " (內建)" : "")} onPress={() => router.push({ pathname: "/tags/[tag]", params: { tag: t } })} />
                  </View>
                  {t !== REVIEW_TAG && <Button title="改名" onPress={() => startRename(t)} />}
                  <View style={{ width: 6 }} />
                  {t !== REVIEW_TAG && <Button title="刪除" color="#c62828" onPress={() => onDelete(t)} />}
                </>
              )}
            </View>
          );
        })}
        {tags.length === 0 && <Text style={styles.hint}>目前沒有標籤，請新增。</Text>}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#fff" },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 12 },
  label: { marginTop: 16, marginBottom: 6, fontSize: 14, color: "#333" },
  rowAdd: { flexDirection: "row", alignItems: "center", gap: 10 },
  input: { flex: 1, borderWidth: 1, borderColor: "#ccc", padding: 10, borderRadius: 6, backgroundColor: "#fff" },
  bulkRow: { marginBottom: 6 },
  searchRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  tagsWrap: { flexDirection: "row", flexWrap: 'wrap', gap: 10, alignItems: 'center' },
  tagItem: { flexDirection: 'row', alignItems: 'center' },
  chkbox: { width: 22, height: 22, borderWidth: 1, borderColor: '#777', marginRight: 6, borderRadius: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  chkboxChecked: { backgroundColor: '#1976d2', borderColor: '#1976d2' },
  chkMark: { color: '#fff', fontWeight: 'bold' },
  hint: { color: '#777' },
});

