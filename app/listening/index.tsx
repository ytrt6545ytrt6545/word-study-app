import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { loadTags, loadWords, Word } from "@/utils/storage";
import { useI18n } from "@/i18n";
import { Card } from "@/components/ui/Card";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { THEME } from "@/constants/Colors";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

type TagCandidate = {
  name: string;
  count: number;
};

export default function ListeningTagPicker() {
  const router = useRouter();
  const { t } = useI18n();
  const [tags, setTags] = useState<TagCandidate[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTagStats = useCallback(async (): Promise<TagCandidate[]> => {
    const [tagList, words] = await Promise.all([loadTags(), loadWords()]);
    const counts = new Map<string, number>();
    for (const word of words as Word[]) {
      for (const tag of word.tags || []) {
        const next = (counts.get(tag) || 0) + 1;
        counts.set(tag, next);
      }
    }
    return tagList
      .filter((tag) => (counts.get(tag) || 0) > 0)
      .map((tag) => ({ name: tag, count: counts.get(tag) || 0 }));
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      fetchTagStats()
        .then((available) => {
          if (!cancelled) setTags(available);
        })
        .catch((err) => {
          console.error("load listening tags failed", err);
          if (!cancelled) setTags([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [fetchTagStats])
  );

  const renderItem = ({ item }: { item: TagCandidate }) => (
    <Card
      pressable
      onPress={() => router.push({ pathname: "/listening/[tag]", params: { tag: item.name } })}
      style={styles.tagCard}
    >
      <View style={styles.cardContent}>
        <View>
          <Text style={styles.tagName}>{item.name}</Text>
          <Text style={styles.tagCount}>
            <MaterialIcons name="audiotrack" size={12} color={THEME.colors.gray[500]} />
            {" "}{item.count} {t("listening.words")}
          </Text>
        </View>
      </View>
      <MaterialIcons name="arrow-forward" size={24} color={THEME.colors.feature.listening} />
    </Card>
  );

  return (
    <View style={styles.container}>
      <PageHeader
        icon="🎧"
        title={t("listening.selectTitle")}
        subtitle={t("listening.selectSubtitle")}
        backgroundColor={THEME.colors.feature.listening + "15"}
      />

      <View style={styles.content}>
        {loading ? (
          <LoadingSpinner size="md" color={THEME.colors.feature.listening} />
        ) : tags.length === 0 ? (
          <EmptyState
            icon="🎧"
            title={t("listening.noAvailableTags")}
            description={t("listening.noTagsDescription")}
          />
        ) : (
          <FlatList
            data={tags}
            keyExtractor={(item) => item.name}
            renderItem={renderItem}
            ItemSeparatorComponent={() => <View style={{ height: THEME.spacing.md }} />}
            contentContainerStyle={styles.listContent}
            scrollEnabled={false}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.surfaceAlt,
  },
  content: {
    flex: 1,
    paddingHorizontal: THEME.spacing.lg,
    paddingTop: THEME.spacing.lg,
  },
  listContent: {
    paddingVertical: THEME.spacing.lg,
  },
  tagCard: {
    paddingHorizontal: THEME.spacing.lg,
    paddingVertical: THEME.spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 3,
    borderTopColor: THEME.colors.feature.listening,
  },
  cardContent: {
    flex: 1,
    gap: THEME.spacing.sm,
  },
  tagName: {
    ...THEME.typography.subtitle,
    color: THEME.colors.gray[900],
  },
  tagCount: {
    ...THEME.typography.bodySmall,
    color: THEME.colors.gray[500],
    marginTop: THEME.spacing.xs,
  },
});
