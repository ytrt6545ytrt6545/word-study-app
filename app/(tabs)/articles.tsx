import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  Pressable,
  Platform,
  type GestureResponderEvent,
} from 'react-native';

import { useI18n } from '@/i18n';
import {
  Article,
  deleteArticle,
  loadArticleTags,
  loadArticles,
} from '@/utils/articles';

// 收藏庫頁面：讀取 AsyncStorage 中的文章列表，提供標籤篩選、閱讀跳轉與刪除操作。
// 資料來源來自 `utils/articles`，每次返回此頁時會透過 `useFocusEffect` 重新載入，確保閱讀頁的修改能即時同步。

type Banner = { kind: 'success' | 'error'; text: string };

// 主要畫面負責：載入文章、依標籤過濾、顯示摘要片段並支援刪除提醒。
// 刪除成功後會更新 local state 並透過 banner 告知使用者，錯誤則以多語系訊息顯示。
export default function ArticleLibraryScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const [articles, setArticles] = useState<Article[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [banner, setBanner] = useState<Banner | null>(null);

  const fetchAll = useCallback(async (showLoader: boolean) => {
    if (showLoader) setLoading(true);
    try {
      const [list, tagList] = await Promise.all([loadArticles(), loadArticleTags()]);
      setArticles(list);
      setTags(tagList);
    } catch (err: any) {
      setBanner({ kind: 'error', text: t('articles.loadError', { message: err?.message || 'unknown' }) });
    } finally {
      if (showLoader) setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      fetchAll(true);
    }, [fetchAll])
  );

  useEffect(() => {
    if (!banner) return;
    const timer = setTimeout(() => setBanner(null), 4000);
    return () => clearTimeout(timer);
  }, [banner]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAll(false);
  }, [fetchAll]);

  const filteredArticles = useMemo(() => {
    if (!activeTag) return articles;
    return articles.filter((item) => item.tags.includes(activeTag));
  }, [articles, activeTag]);

  const handleOpen = useCallback(
    (item: Article) => {
      router.push({ pathname: '/(tabs)/reading', params: { articleId: item.id } });
    },
    [router]
  );

  const executeDelete = useCallback(
    async (item: Article) => {
      try {
        const removed = await deleteArticle(item.id);
        if (removed) {
          setArticles((prev) => prev.filter((article) => article.id !== item.id));
          setBanner({ kind: 'success', text: t('articles.delete.success', { title: item.title }) });
        }
      } catch (err: any) {
        setBanner({
          kind: 'error',
          text: t('articles.delete.error', { message: err?.message || 'unknown' }),
        });
      }
    },
    [t]
  );

  const handleDelete = useCallback(
    (item: Article) => {
      if (Platform.OS === 'web') {
        const confirmed =
          typeof globalThis !== 'undefined' && typeof (globalThis as any).confirm === 'function'
            ? (globalThis as any).confirm(t('articles.delete.confirmMessage', { title: item.title }))
            : true;
        if (confirmed) {
          executeDelete(item);
        }
        return;
      }
      Alert.alert(t('articles.delete.confirmTitle'), t('articles.delete.confirmMessage', { title: item.title }), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('articles.delete'), style: 'destructive', onPress: () => executeDelete(item) },
      ]);
    },
    [executeDelete, t]
  );

  const renderItem = useCallback(
    ({ item }: { item: Article }) => (
      <Pressable
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.card,
          pressed && styles.cardPressed,
          Platform.OS === 'web' && styles.cardWeb,
        ]}
        onPress={() => handleOpen(item)}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.cardDate}>{formatDate(item.updatedAt || item.createdAt)}</Text>
        </View>
        {item.tags.length ? (
          <View style={styles.tagRow}>
            {item.tags.map((tag) => (
              <View style={styles.tagPill} key={tag}>
                <Text style={styles.tagPillText}>{tag}</Text>
              </View>
            ))}
          </View>
        ) : null}
        <Text style={styles.cardSnippet}>{buildSnippet(item)}</Text>
        <Pressable
          style={styles.cardDelete}
          onPress={(event: GestureResponderEvent) => {
            event.stopPropagation();
            handleDelete(item);
          }}>
          <Text style={styles.cardDeleteText}>{t('articles.delete')}</Text>
        </Pressable>
      </Pressable>
    ),
    [handleDelete, handleOpen, t]
  );

  if (loading && !refreshing && articles.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1976d2" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {banner ? (
        <View style={[styles.banner, banner.kind === 'success' ? styles.bannerSuccess : styles.bannerError]}>
          <Text style={styles.bannerText}>{banner.text}</Text>
        </View>
      ) : null}
      <View style={styles.filterContainer}>
        <Text style={styles.filterLabel}>{t('articles.filter.tagPrefix')}</Text>
        <View style={styles.filterChips}>
          <Pressable
            key="__all__"
            style={[styles.filterChip, activeTag === null && styles.filterChipActive]}
            onPress={() => setActiveTag(null)}>
            <Text style={[styles.filterChipText, activeTag === null && styles.filterChipTextActive]}>
              {t('articles.filter.all')}
            </Text>
          </Pressable>
          {tags.map((tag) => {
            const isActive = activeTag === tag;
            return (
              <Pressable
                key={tag}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
                onPress={() => setActiveTag(tag)}>
                <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>{tag}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <FlatList
        data={filteredArticles}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={filteredArticles.length === 0 ? styles.emptyContainer : styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>{t('articles.empty')}</Text>
          </View>
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      />
    </View>
  );
}

function formatDate(iso: string | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso || '';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day} ${hours}:${minutes}`;
}

function buildSnippet(article: Article): string {
  const source = article.summary || article.rawText || '';
  const firstLine = source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0) || '';
  if (firstLine.length <= 160) return firstLine;
  return `${firstLine.slice(0, 157)}...`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fb' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 16, gap: 12 },
  filterContainer: { paddingHorizontal: 16, paddingTop: 16 },
  filterLabel: { fontSize: 14, color: '#555', marginBottom: 8 },
  filterChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#c5d1e5',
    backgroundColor: '#fff',
  },
  filterChipActive: { backgroundColor: '#1e88e5', borderColor: '#1e88e5' },
  filterChipText: { fontSize: 13, color: '#1a237e' },
  filterChipTextActive: { color: '#fff' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e0e6f0',
    gap: 8,
  },
  cardPressed: { backgroundColor: '#eef3ff', transform: [{ scale: 0.99 }] },
  cardWeb: { cursor: 'pointer' as const },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  cardTitle: { fontSize: 18, fontWeight: '600', color: '#1a237e', flexShrink: 1 },
  cardDate: { fontSize: 12, color: '#78909c' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tagPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#e3f2fd',
  },
  tagPillText: { fontSize: 12, color: '#0d47a1' },
  cardSnippet: { fontSize: 14, color: '#37474f', lineHeight: 20 },
  cardDelete: { alignSelf: 'flex-end', paddingVertical: 4, paddingHorizontal: 8 },
  cardDeleteText: { fontSize: 13, color: '#d32f2f' },
  emptyContainer: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyState: { alignItems: 'center', gap: 8 },
  emptyText: { fontSize: 16, color: '#607d8b', textAlign: 'center' },
  banner: { marginHorizontal: 16, marginTop: 12, padding: 12, borderRadius: 8, borderWidth: 1 },
  bannerSuccess: { backgroundColor: '#e8f5e9', borderColor: '#66bb6a' },
  bannerError: { backgroundColor: '#ffebee', borderColor: '#ef5350' },
  bannerText: { fontSize: 14, color: '#263238' },
});
