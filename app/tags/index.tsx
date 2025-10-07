import { addTag, loadTags, removeTagSubtree, renameTagSubtree, REVIEW_TAG, EXAM_TAG, buildOrderedTagTree, parseTagPath, joinTagPath, reorderTagSibling, loadTagOrder, TagOrder, copyTagSubtree } from "@/utils/storage";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useI18n } from "@/i18n";

export default function TagsManage() {
  const router = useRouter();
  const { t } = useI18n();
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [moving, setMoving] = useState<string | null>(null);
  const [copying, setCopying] = useState<string | null>(null);
  const [addingFor, setAddingFor] = useState<string | null>(null);
  const [addingText, setAddingText] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameText, setRenameText] = useState("");
  const [search, setSearch] = useState("");
  const [order, setOrder] = useState<TagOrder>({});

  const refresh = async () => { setTags(await loadTags()); setOrder(await loadTagOrder()); };

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

  const onDeleteSubtree = async (tagPath: string) => {
    Alert.alert(
      t('tags.confirmDelete.title'),
      t('tags.confirmDelete.message', { tag: tagPath }),
      [
        { text: t('common.cancel') },
        { text: t('common.delete'), style: "destructive", onPress: async () => { await removeTagSubtree(tagPath); await refresh(); } },
      ]
    );
  };

  const toggleExpand = (path: string) => {
    const next = new Set(expanded);
    if (next.has(path)) next.delete(path); else next.add(path);
    setExpanded(next);
  };

  const startAddChild = (parentPath: string) => { setAddingFor(parentPath); setAddingText(""); };
  const confirmAddChild = async (parentPath: string) => {
    const seg = addingText.trim();
    if (!seg) { setAddingFor(null); return; }
    const parts = parseTagPath(parentPath);
    if (parts.length >= 3) { Alert.alert(t('common.ok'), '已達三層上限'); return; }
    const target = joinTagPath([...parts, seg]);
    await addTag(target);
    setAddingFor(null); setAddingText("");
    setExpanded(new Set(expanded).add(parentPath));
    await refresh();
  };

  const startRename = (path: string) => { setRenaming(path); const parts = parseTagPath(path); setRenameText(parts[parts.length - 1] || ""); };
  const cancelRename = () => { setRenaming(null); setRenameText(""); };
  const confirmRename = async () => {
    const from = renaming || "";
    const to = renameText.trim();
    if (!from) return;
    if (!to) { Alert.alert(t('tags.rename.input')); return; }
    const parts = parseTagPath(from);
    parts[parts.length - 1] = to;
    const dst = joinTagPath(parts);
    await renameTagSubtree(from, dst);
    cancelRename();
    await refresh();
  };

  const tree = useMemo(() => {
    // ordered build via helper that reads order internally
    // we rely on local order state only to force re-render when changed
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return tags; // placeholder to satisfy deps; actual tree built in JSX via async builder
  }, [tags, order]);
  const [treeNodes, setTreeNodes] = useState<any[]>([]);
  useEffect(() => { (async () => setTreeNodes(await buildOrderedTagTree(tags)))(); }, [tags, order]);
  const matchesSearch = (path: string) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return path.toLowerCase().includes(q);
  };
  const renderTree = (nodes: any[], depth = 0) => (
    <>
      {nodes.map((node) => {
        const hasChildren = (node.children && node.children.length > 0) || false;
        const isOpen = expanded.has(node.path);
        if (!matchesSearch(node.path)) {
          const anyChild = (node.children || []).some((c: any) => matchesSearch(c.path));
          if (!anyChild) return null;
        }
        return (
          <View key={node.path} style={styles.treeRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ width: depth * 14 }} />
              {hasChildren ? (
                <Pressable onPress={() => toggleExpand(node.path)}>
                  <Text style={styles.expander}>{isOpen ? '▾' : '▸'}</Text>
                </Pressable>
              ) : (
                <Text style={[styles.expander, { opacity: 0.3 }]}>•</Text>
              )}
              {renaming === node.path ? (
                <>
                  <TextInput style={[styles.input, { flex: 0, width: 140, marginHorizontal: 6 }]} value={renameText} onChangeText={setRenameText} placeholder={t('tags.rename.input')} />
                  <Button title={t('tags.rename.ok')} onPress={confirmRename} />
                  <View style={{ width: 6 }} />
                  <Button title={t('tags.rename.cancel')} onPress={cancelRename} />
                </>
              ) : (
                <>
                  <View style={{ marginHorizontal: 6 }}>
                    <Button title={node.name} onPress={() => router.push({ pathname: "/tags/[tag]", params: { tag: node.path } })} />
                  </View>
                  <Button title={t('tags.item.rename')} onPress={() => startRename(node.path)} />
                  <View style={{ width: 6 }} />
                  <Button title={t('tags.item.delete')} color="#c62828" onPress={() => onDeleteSubtree(node.path)} />
                  <View style={{ width: 6 }} />
                  {/* Reorder within parent */}
                  <Button title={'↑'} onPress={async () => { const p = parseTagPath(node.path); const parent = p.length > 1 ? joinTagPath(p.slice(0, -1)) : ''; await reorderTagSibling(parent, node.name, 'up'); setOrder(await loadTagOrder()); }} />
                  <View style={{ width: 4 }} />
                  <Button title={'↓'} onPress={async () => { const p = parseTagPath(node.path); const parent = p.length > 1 ? joinTagPath(p.slice(0, -1)) : ''; await reorderTagSibling(parent, node.name, 'down'); setOrder(await loadTagOrder()); }} />
                  <View style={{ width: 6 }} />
                  {/* Move mode */}
                  {moving === node.path ? (
                    <Button title={'取消移動'} onPress={() => setMoving(null)} />
                  ) : (
                    <Button title={'移動'} onPress={() => setMoving(node.path)} />
                  )}
                  <View style={{ width: 6 }} />
                  {parseTagPath(node.path).length < 3 && (
                    addingFor === node.path ? (
                      <>
                        <TextInput style={[styles.input, { flex: 0, width: 140 }]} value={addingText} onChangeText={setAddingText} placeholder={t('tags.input.name')} />
                        <View style={{ width: 6 }} />
                        <Button title={t('tags.add')} onPress={() => confirmAddChild(node.path)} />
                        <View style={{ width: 6 }} />
                        <Button title={t('tags.rename.cancel')} onPress={() => { setAddingFor(null); setAddingText(''); }} />
                      </>
                    ) : (
                      <Button title={'新增'} onPress={() => startAddChild(node.path)} />
                    )
                  )}
                </>
              )}
            </View>
            {/* If in moving mode, allow dropping to this node as parent */}
            {moving && moving !== node.path && (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: depth * 14 + 18 }}>
                <Button title={'放到這裡'} onPress={async () => {
                  const movingParts = parseTagPath(moving);
                  const name = movingParts[movingParts.length - 1];
                  const destParts = parseTagPath(node.path);
                  const dst = joinTagPath([...destParts, name]);
                  await renameTagSubtree(moving, dst);
                  setMoving(null);
                  await refresh();
                  setExpanded(new Set(expanded).add(node.path));
                }} />
              </View>
            )}
            {hasChildren && isOpen && (
              <View>
                {renderTree(node.children || [], depth + 1)}
              </View>
            )}
          </View>
        );
      })}
    </>
  );

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 20 }}>
      <Text style={styles.title}>{t('tags.manage.title')}</Text>

      <View style={styles.rowAdd}>
        <Button title={t('tags.add')} onPress={onAdd} />
        <TextInput style={styles.input} placeholder={t('tags.input.name')} value={newTag} onChangeText={setNewTag} returnKeyType="done" onSubmitEditing={onAdd} />
      </View>

      <Text style={styles.label}>{t('tags.list')}</Text>
      <View style={styles.searchRow}>
        <TextInput style={[styles.input, { flex: 1 }]} placeholder={t('tags.search')} value={search} onChangeText={setSearch} />
      </View>

      {/* Root-level drop/copy targets when in move/copy mode */}
      {!!moving && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <Button title={'Move to root'} onPress={async () => {
            const name = parseTagPath(moving).slice(-1)[0];
            const dst = name; // root-level path
            await renameTagSubtree(moving, dst);
            setMoving(null);
            await refresh();
          }} />
          <View style={{ width: 8 }} />
          <Button title={'Copy to root'} onPress={async () => {
            const name = parseTagPath(moving).slice(-1)[0];
            const dst = name; // root-level path
            await copyTagSubtree(moving, dst);
            setMoving(null);
            await refresh();
          }} />
          <View style={{ width: 8 }} />
          <Button title={'Cancel Move'} onPress={() => setMoving(null)} />
        </View>
      )}
      {!!copying && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <Button title={'Copy to root'} onPress={async () => {
            const name = parseTagPath(copying).slice(-1)[0];
            const dst = name; // root-level path
            await copyTagSubtree(copying, dst);
            setCopying(null);
            await refresh();
          }} />
          <View style={{ width: 8 }} />
          <Button title={'Cancel Copy'} onPress={() => setCopying(null)} />
        </View>
      )}

      {/* System tag */}
      <View style={{ marginBottom: 10 }}>
        <Text style={styles.label}>系統標籤</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
          <View style={{ marginRight: 6, marginBottom: 6 }}>
            <Button title={REVIEW_TAG} onPress={() => router.push({ pathname: "/tags/[tag]", params: { tag: REVIEW_TAG } })} />
          </View>
          <View style={{ marginRight: 6, marginBottom: 6 }}>
            <Button title={EXAM_TAG} onPress={() => router.push({ pathname: "/tags/[tag]", params: { tag: EXAM_TAG } })} />
          </View>
          <Text style={styles.hint}>加入「{EXAM_TAG}」標籤的單字會進入考試範圍</Text>
        </View>
      </View>

      {/* Tree */}
      <View style={styles.treeWrap}>
        {renderTree(treeNodes)}
        {treeNodes.length === 0 && <Text style={styles.hint}>{t('tags.none')}</Text>}
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
  searchRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  treeWrap: { gap: 6 },
  treeRow: { paddingVertical: 4 },
  expander: { width: 18, textAlign: 'center', fontSize: 16, color: '#555' },
  hint: { color: "#777" },
});
