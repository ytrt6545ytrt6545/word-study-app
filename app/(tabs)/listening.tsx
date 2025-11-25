import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, StyleSheet, Text, View, Animated, Pressable } from "react-native";
import { loadTags, loadWords, Word } from "@/utils/storage";
import { useI18n } from "@/i18n";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { THEME } from "@/constants/Colors";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

type TagCandidate = {
  name: string;
  count: number;
};

function TagCardItem({ item, onPress }: { item: TagCandidate; onPress: () => void }) {
  const [scaleAnim] = useState(new Animated.Value(1));

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View
      style={[
        styles.tagCardWrapper,
        {
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={({ pressed }) => [
          styles.tagCardContent,
          pressed && styles.tagCardPressed,
        ]}
      >
        <View style={styles.tagInfo}>
          <Text style={styles.tagName}>{item.name}</Text>
          <View style={styles.tagCountContainer}>
            <MaterialIcons name="audiotrack" size={14} color={THEME.colors.gray[500]} />
            <Text style={styles.tagCount}>
              {item.count} {item.count === 1 ? "word" : "words"}
            </Text>
          </View>
        </View>
        <View style={styles.arrowContainer}>
          <MaterialIcons name="arrow-forward" size={22} color={THEME.colors.feature.listening} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function ListeningTagPicker() {
  const router = useRouter();
  const { t } = useI18n();
  const [tags, setTags] = useState<TagCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [fadeAnim] = useState(new Animated.Value(0));

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
      fadeAnim.setValue(0);

      fetchTagStats()
        .then((available) => {
          if (!cancelled) {
            setTags(available);
            Animated.timing(fadeAnim, {
              toValue: 1,
              duration: 400,
              useNativeDriver: true,
            }).start();
          }
        })
        .catch((err) => {
          console.error("load listening tags failed", err);
          if (!cancelled) {
            setTags([]);
            Animated.timing(fadeAnim, {
              toValue: 1,
              duration: 400,
              useNativeDriver: true,
            }).start();
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [fetchTagStats, fadeAnim])
  );

  const renderItem = ({ item }: { item: TagCandidate }) => (
    <TagCardItem
      item={item}
      onPress={() => router.push({ pathname: "/listening/[tag]", params: { tag: item.name } })}
    />
  );

  return (
    <View style={styles.container}>
      <PageHeader
        icon="🎧"
        title={t("listening.selectTitle")}
        subtitle={t("listening.selectSubtitle")}
        backgroundColor={THEME.colors.feature.listening + "15"}
      />

      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
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
      </Animated.View>
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
    paddingVertical: THEME.spacing.sm,
  },
  tagCardWrapper: {
    marginBottom: THEME.spacing.md,
  },
  tagCardContent: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    paddingHorizontal: THEME.spacing.lg,
    paddingVertical: THEME.spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderLeftWidth: 4,
    borderLeftColor: THEME.colors.feature.listening,
    ...THEME.shadows.md,
  },
  tagCardPressed: {
    backgroundColor: THEME.colors.surfaceAlt,
  },
  tagInfo: {
    flex: 1,
    gap: THEME.spacing.sm,
  },
  tagName: {
    ...THEME.typography.subtitle,
    color: THEME.colors.gray[900],
    fontWeight: "700",
  },
  tagCountContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: THEME.spacing.sm,
  },
  tagCount: {
    ...THEME.typography.bodySmall,
    color: THEME.colors.gray[500],
  },
  arrowContainer: {
    marginLeft: THEME.spacing.lg,
    justifyContent: "center",
    alignItems: "center",
  },
});
