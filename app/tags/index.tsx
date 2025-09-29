import { addTag, loadTags, removeTag, removeTags, renameTag, REVIEW_TAG } from "@/utils/storage";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useI18n } from "@/i18n";

export default function TagsManage() {
  const router = useRouter();
  const { t } = useI18n();
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
    if (!name) {
      Alert.alert(t('tags.input.name'));
      return;
    }
    await addTag(name);
    setNewTag("");
    await refresh();
  };

  const onDelete = async (t: string) => {
    Alert.alert(
      t('tags.confirmDelete.title'),
      t('tags.confirmDelete.message', { tag: t }),
      [
        { text: t('common.cancel') },
        { text: t('common.delete'), style: "destructive", onPress: async () => { await removeTag(t); await refresh(); } },
      ]
    );
  };

  const onToggleSelect = (t: string) => {
    if (t === REVIEW_TAG) return;
    const next = new Set(selected);
    if (next.has(t)) next.delete(t);
    else next.add(t);
    setSelected(next);
  };

  const onBulkDelete = async () => {
    const list = Array.from(selected);
    if (list.length === 0) return;
    Alert.alert(
      t('tags.bulkDelete.title'),
      t('tags.bulkDelete.message', { count: list.length }),
      [
        { text: t('common.cancel') },
        { text: t('common.delete'), style: "destructive", onPress: async () => { await removeTags(list); setSelected(new Set()); await refresh(); } },
      ]
    );
  };

  const startRename = (t: string) => { setRenaming(t); setRenameText(t); };
  const cancelRename = () => { setRenaming(null); setRenameText(""); };
  const confirmRename = async () => {
    const from = renaming || "";
    const to = renameText.trim();
    if (!from) return;
    if (!to) { Alert.alert(t('tags.rename.input')); return; }
    await renameTag(from, to);
    cancelRename();
    await refresh();
  };

  const viewTags = useMemo(() => {
    const q = search.trim();
    const filtered = q ? tags.filter((t) => t.toLowerCase().includes(q.toLowerCase())) : tags;
    const sorted = [...filtered].sort((a, b) => (asc ? a.localeCompare(b) : b.localeCompare(a)));
    return sorted;
  }, [tags, search, asc]);

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 20 }}>
      <Text style={styles.title}>{t('tags.manage.title')}</Text>

      <View style={styles.rowAdd}>
        <Button title={t('tags.add')} onPress={onAdd} />
        <TextInput style={styles.input} placeholder={t('tags.input.name')} value={newTag} onChangeText={setNewTag} returnKeyType="done" onSubmitEditing={onAdd} />
      </View>

      <Text style={styles.label}>{t('tags.list')}</Text>
      <View style={styles.bulkRow}>
        <Button title={t('tags.bulkDelete', { count: selected.size })} onPress={onBulkDelete} disabled={selected.size === 0} color={selected.size === 0 ? undefined : "#c62828"} />
      </View>
      <View style={styles.searchRow}>
        <TextInput style={[styles.input, { flex: 1 }]} placeholder={t('tags.search')} value={search} onChangeText={setSearch} />
        <View style={{ width: 8 }} />
        <Button title={asc ? t('tags.sort.az') : t('tags.sort.za')} onPress={() => setAsc((v) => !v)} />
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
                  <TextInput style={[styles.input, { flex: 0, width: 140, marginRight: 6 }]} value={renameText} onChangeText={setRenameText} placeholder={t('tags.rename.input')} />
                  <Button title={t('tags.rename.ok')} onPress={confirmRename} />
                  <View style={{ width: 6 }} />
                  <Button title={t('tags.rename.cancel')} onPress={cancelRename} />
                </>
              ) : (
                <>
                  <View style={{ marginRight: 6 }}>
                    <Button title={t + (t === REVIEW_TAG ? (t('tags.item.suggested') as string) : '')} onPress={() => router.push({ pathname: "/tags/[tag]", params: { tag: t } })} />
                  </View>
                  {t !== REVIEW_TAG && <Button title={t('tags.item.rename')} onPress={() => startRename(t)} />}
                  <View style={{ width: 6 }} />
                  {t !== REVIEW_TAG && <Button title={t('tags.item.delete')} color="#c62828" onPress={() => onDelete(t)} />}
                </>
              )}
            </View>
          );
        })}
        {tags.length === 0 && <Text style={styles.hint}>{t('tags.none')}</Text>}
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
  searchRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  tagsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 10, alignItems: "center" },
  tagItem: { flexDirection: "row", alignItems: "center" },
  chkbox: { width: 22, height: 22, borderWidth: 1, borderColor: "#777", marginRight: 6, borderRadius: 4, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  chkboxChecked: { backgroundColor: "#1976d2", borderColor: "#1976d2" },
  chkMark: { color: "#fff", fontWeight: "bold" },
  hint: { color: "#777" },
});
