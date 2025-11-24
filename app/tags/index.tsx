import {
  addTag,
  loadTags,
  removeTagSubtree,
  renameTagSubtree,
  REVIEW_TAG,
  EXAM_TAG,
  buildOrderedTagTree,
  parseTagPath,
  joinTagPath,
  reorderTagSibling,
  loadTagOrder,
  TagOrder,
  copyTagSubtree,
} from "@/utils/storage";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View, ActivityIndicator, Button, Platform } from "react-native";
import { useI18n } from "@/i18n";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { Ionicons } from "@expo/vector-icons";

// Reusable styled button component
const StyledButton = ({
  title,
  onPress,
  icon,
  color,
  variant = 'default',
}: {
  title?: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  color?: string;
  variant?: 'default' | 'primary' | 'outline' | 'ghost' | 'destructive';
}) => {
  const theme = useThemeColor({}, 'text');
  const primaryColor = useThemeColor({}, 'tint');
  const destructiveColor = useThemeColor({ light: '#ef4444', dark: '#f87171' });
  const bgColor = variant === 'primary' ? primaryColor : 'transparent';
  const textColor = variant === 'primary' 
    ? useThemeColor({}, 'background') 
    : variant === 'destructive' 
    ? destructiveColor 
    : color || theme;
  const borderColor = variant === 'outline' ? textColor : 'transparent';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.buttonBase,
        {
          backgroundColor: bgColor,
          borderColor: borderColor,
          borderWidth: variant === 'outline' ? 1 : 0,
          opacity: pressed ? 0.7 : 1,
        },
        (variant === 'ghost' || variant === 'destructive') && { paddingHorizontal: 4 },
      ]}
    >
      {icon && <Ionicons name={icon} size={18} color={textColor} style={title ? styles.iconWithText : {}} />}
      {title && <ThemedText style={{ color: textColor, fontWeight: '500' }}>{title}</ThemedText>}
    </Pressable>
  );
};


export default function TagsManage() {
  const router = useRouter();
  const { t } = useI18n();

  // Colors
  const cardColor = useThemeColor({ light: '#f9f9f9', dark: '#1c1c1e' });
  const inputBgColor = useThemeColor({ light: '#f0f0f0', dark: '#2c2c2e' });
  const inputTextColor = useThemeColor({}, 'text');
  const subtleColor = useThemeColor({ light: '#6b7280', dark: '#9ca3af' });
  const tint = useThemeColor({}, 'tint');
  const destructiveColor = useThemeColor({ light: '#ef4444', dark: '#f87171' });
  const borderColor = useThemeColor({ light: '#e5e7eb', dark: '#374151' });
  const moveActionBgColor = useThemeColor({ light: 'rgba(59, 130, 246, 0.1)', dark: 'rgba(255, 255, 255, 0.1)' });

  // State
  const [tags, setTags] = useState<string[]>([]);
  const [order, setOrder] = useState<TagOrder>({});
  const [isLoading, setIsLoading] = useState(true);
  const [newTag, setNewTag] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [moving, setMoving] = useState<string | null>(null);
  const [copying, setCopying] = useState<string | null>(null);
  const [addingFor, setAddingFor] = useState<string | null>(null);
  const [addingText, setAddingText] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameText, setRenameText] = useState("");
  const [search, setSearch] = useState("");
  const [treeNodes, setTreeNodes] = useState<any[]>([]);

  const refresh = async () => {
    setIsLoading(true);
    const [loadedTags, loadedOrder] = await Promise.all([loadTags(), loadTagOrder()]);
    setTags(loadedTags);
    setOrder(loadedOrder);
    setIsLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    buildOrderedTagTree(tags, order)
      .then(nodes => {
        // Ensure nodes is always an array
        setTreeNodes(Array.isArray(nodes) ? nodes : (nodes ? [nodes] : []));
      })
      .catch(error => {
        console.error("Failed to build tag tree:", error);
        setTreeNodes([]);
      });
  }, [tags, order]);

  const onAdd = async (parentPath: string | null = null) => {
    const name = (parentPath ? addingText : newTag).trim();
    if (!name) {
      Alert.alert(t('tags.input.name'));
      return;
    }

    const path = parentPath ? joinTagPath([...parseTagPath(parentPath), name]) : name;
    if (parentPath && parseTagPath(path).length > 3) {
      Alert.alert(t('common.ok'), '已達三層上限');
      return;
    }
    
    await addTag(path);

    if (parentPath) {
      setAddingFor(null);
      setAddingText("");
      setExpanded(new Set(expanded).add(parentPath));
    } else {
      setNewTag("");
    }
    
    await refresh();
  };
  
  const performDelete = async (tagPath: string) => {
    await removeTagSubtree(tagPath);
    await refresh();
  };

  const onDeleteSubtree = (tagPath: string) => {
    console.log("onDeleteSubtree called for:", tagPath);
    if (Platform.OS === 'web') {
      const message = `${t('tags.confirmDelete.title')}\n\n${t('tags.confirmDelete.message', { tag: tagPath })}`;
      if (window.confirm(message)) {
        console.log("Delete pressed for:", tagPath);
        performDelete(tagPath);
      } else {
        console.log("Cancel pressed on web");
      }
    } else {
      Alert.alert(
        t('tags.confirmDelete.title'),
        t('tags.confirmDelete.message', { tag: tagPath }),
        [
          { text: t('common.cancel'), style: 'cancel', onPress: () => console.log("Cancel pressed") },
          {
            text: t('common.delete'),
            style: "destructive",
            onPress: () => {
              console.log("Delete pressed for:", tagPath); 
              performDelete(tagPath)
            }
          },
        ]
      );
    }
  };

  const onRename = async () => {
    const from = renaming;
    if (!from) return;
    const to = renameText.trim();
    if (!to) { Alert.alert(t('tags.rename.input')); return; }

    const parts = parseTagPath(from);
    parts[parts.length - 1] = to;
    const dst = joinTagPath(parts);
    
    await renameTagSubtree(from, dst);
    setRenaming(null);
    setRenameText("");
    await refresh();
  };

  const onMove = async (targetParentPath: string) => {
    if (!moving) return;
    const movingParts = parseTagPath(moving);
    const name = movingParts[movingParts.length - 1];
    const destParts = parseTagPath(targetParentPath);
    const dst = joinTagPath([...destParts, name]);
    
    await renameTagSubtree(moving, dst);
    setMoving(null);
    setExpanded(new Set(expanded).add(targetParentPath));
    await refresh();
  };
  
  const matchesSearch = (path: string, q: string) => !q || path.toLowerCase().includes(q);

  const renderTree = (nodes: any[], depth = 0) => {
    const searchQuery = search.trim().toLowerCase();
    
    return (
      <>
        {Array.isArray(nodes) && nodes.map((node) => {
          const hasChildren = (node.children && node.children.length > 0) || false;
          const isOpen = expanded.has(node.path);

          if (!matchesSearch(node.path, searchQuery) && !(node.children || []).some((c: any) => matchesSearch(c.path, searchQuery))) {
            return null;
          }

          const isMovingThis = moving === node.path;

          return (
            <View key={node.path} style={{ marginLeft: depth * 20 }}>
              <ThemedView style={[styles.card, { backgroundColor: cardColor, borderColor: isMovingThis ? tint : 'transparent' }]}>
                {/* Main tag info */}
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitleArea}>
                    <Pressable onPress={() => toggleExpand(node.path)} hitSlop={10}>
                      <Ionicons name={hasChildren ? (isOpen ? 'chevron-down' : 'chevron-forward') : 'remove'} size={18} color={subtleColor} style={{ width: 20 }} />
                    </Pressable>
                    <Pressable onPress={() => router.push({ pathname: "/tags/[tag]", params: { tag: node.path } })}>
                      <ThemedText style={styles.tagName}>{node.name}</ThemedText>
                    </Pressable>
                  </View>

                  {/* Actions */}
                  <View style={styles.actions}>
                    {moving !== node.path && <StyledButton icon="pencil" onPress={() => { setRenaming(node.path); setRenameText(node.name); }} variant="ghost" color={subtleColor} />}
                    <StyledButton title="刪除" onPress={() => onDeleteSubtree(node.path)} variant="destructive" />
                  </View>
                </View>

                {/* More actions and inline forms */}
                <View>
                  {renaming === node.path ? (
                    <View style={styles.inlineForm}>
                      <TextInput style={[styles.input, { backgroundColor: inputBgColor, color: inputTextColor, flex: 1 }]} value={renameText} onChangeText={setRenameText} placeholder={t('tags.rename.input')} />
                      <StyledButton icon="checkmark" onPress={onRename} variant="ghost" color={tint} />
                      <StyledButton icon="close" onPress={() => setRenaming(null)} variant="ghost" color={subtleColor} />
                    </View>
                  ) : addingFor === node.path ? (
                     <View style={styles.inlineForm}>
                       <TextInput style={[styles.input, { backgroundColor: inputBgColor, color: inputTextColor, flex: 1 }]} value={addingText} onChangeText={setAddingText} placeholder={t('tags.input.name')} />
                       <StyledButton icon="add" onPress={() => onAdd(node.path)} variant="ghost" color={tint} />
                       <StyledButton icon="close" onPress={() => setAddingFor(null)} variant="ghost" color={subtleColor} />
                     </View>
                  ) : null}
                </View>

                {/* Drop target for moving */}
                {moving && !isMovingThis && !moving.startsWith(node.path) && (
                   <View style={[styles.dropTarget, { borderColor: borderColor }]}>
                     <StyledButton title={`將 "${parseTagPath(moving).slice(-1)[0]}" 移至此處`} onPress={() => onMove(node.path)} variant="outline" />
                   </View>
                )}
                
                {/* Secondary Actions */}
                <View style={styles.cardFooter}>
                    <StyledButton icon={'arrow-up'} onPress={async () => { const p = parseTagPath(node.path); const parent = p.length > 1 ? joinTagPath(p.slice(0, -1)) : ''; await reorderTagSibling(parent, node.name, 'up'); await refresh(); }} variant="ghost" color={subtleColor} />
                    <StyledButton icon={'arrow-down'} onPress={async () => { const p = parseTagPath(node.path); const parent = p.length > 1 ? joinTagPath(p.slice(0, -1)) : ''; await reorderTagSibling(parent, node.name, 'down'); await refresh(); }} variant="ghost" color={subtleColor} />
                    {parseTagPath(node.path).length < 3 && <StyledButton title="新增子標籤" icon="add" onPress={() => setAddingFor(node.path)} variant="ghost" color={subtleColor} />}
                    <StyledButton title={isMovingThis ? "取消移動" : "移動"} icon="move" onPress={() => setMoving(isMovingThis ? null : node.path)} variant="ghost" color={isMovingThis ? tint: subtleColor} />
                </View>

              </ThemedView>

              {hasChildren && isOpen && <View style={[styles.childrenContainer, { borderLeftColor: borderColor }]}>{renderTree(node.children || [], 1)}</View>}
            </View>
          );
        })}
      </>
    )
  };

  const toggleExpand = (path: string) => {
    const next = new Set(expanded);
    if (next.has(path)) next.delete(path); else next.add(path);
    setExpanded(next);
  };
  
  if (isLoading) {
    return <ThemedView style={styles.centered}><ActivityIndicator /></ThemedView>
  }

  const systemTagIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
    [REVIEW_TAG]: 'bookmark-outline',
    [EXAM_TAG]: 'school-outline',
  };

  return (
    <ThemedView style={{ flex: 1 }}>
      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.contentContainer}>
        <ThemedText type="title" style={styles.title}>{t('tags.manage.title')}</ThemedText>

        {/* Add new root tag */}
        <View style={styles.rowAdd}>
          <TextInput style={[styles.input, { backgroundColor: inputBgColor, color: inputTextColor }]} placeholder={t('tags.input.name')} value={newTag} onChangeText={setNewTag} returnKeyType="done" onSubmitEditing={() => onAdd()} />
          <StyledButton title={t('tags.add')} onPress={() => onAdd()} variant="primary" />
        </View>

        {/* Search */}
        <View style={styles.searchRow}>
          <TextInput style={[styles.input, { backgroundColor: inputBgColor, color: inputTextColor }]} placeholder={t('tags.search')} value={search} onChangeText={setSearch} />
          <StyledButton icon="close-circle" onPress={() => setSearch('')} variant="ghost" color={subtleColor} />
        </View>
        
        {/* System Tags */}
        <View style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>系統標籤</ThemedText>
          <View style={styles.systemTagsContainer}>
            {[REVIEW_TAG, EXAM_TAG].map(tag => (
              <Pressable key={tag} style={[styles.systemTag, { backgroundColor: inputBgColor }]} onPress={() => router.push({ pathname: "/tags/[tag]", params: { tag } })}>
                <Ionicons name={systemTagIcons[tag] || 'pricetag-outline'} size={16} color={subtleColor} />
                <ThemedText style={{ marginLeft: 6 }}>{tag}</ThemedText>
              </Pressable>
            ))}
          </View>
          <ThemedText style={[styles.hint, { color: subtleColor }]}>加入「{EXAM_TAG}」標籤的單字會進入考試範圍</ThemedText>
        </View>

        {/* User Tags Tree */}
        <View style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>我的標籤</ThemedText>
          {moving && (
            <View style={[styles.moveActionRoot, { backgroundColor: moveActionBgColor }]}>
              <StyledButton title={'移至根目錄'} onPress={async () => { const name = parseTagPath(moving).slice(-1)[0]; await renameTagSubtree(moving, name); setMoving(null); await refresh(); }} variant="outline"/>
              <StyledButton title={'取消移動'} onPress={() => setMoving(null)} variant="ghost" color={subtleColor}/>
            </View>
          )}
          {renderTree(treeNodes)}
          {treeNodes.length === 0 && !isLoading && (
            <View style={styles.emptyStateContainer}>
              <Ionicons name="pricetags-outline" size={48} color={subtleColor} />
              <ThemedText type="subtitle" style={{ marginTop: 16, color: subtleColor }}>{t('tags.none')}</ThemedText>
            </View>
          )}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  contentContainer: { padding: 16, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { marginBottom: 16, textAlign: 'center' },
  section: { marginBottom: 24 },
  sectionTitle: { marginBottom: 12 },
  rowAdd: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 },
  input: { flex: 1, borderWidth: 1, borderColor: "transparent", padding: 12, borderRadius: 8, fontSize: 16 },
  searchRow: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  hint: { fontSize: 13, marginTop: 8 },
  systemTagsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  systemTag: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  
  card: {
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 8,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingLeft: 8,
    paddingRight: 4,
  },
  cardTitleArea: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tagName: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  childrenContainer: {
    paddingLeft: 8,
    borderLeftWidth: 1,
    marginLeft: 18, // Align with the icon
  },
  inlineForm: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 8,
    gap: 4,
  },
  dropTarget: {
    margin: 8,
    padding: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 8,
  },
  moveActionRoot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    padding: 8,
    borderRadius: 8
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  
  // Reusable Button
  buttonBase: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  iconWithText: {
    marginRight: 6,
  },
});
