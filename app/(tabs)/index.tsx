import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { THEME } from "@/constants/Colors";
import { useI18n } from "@/i18n";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import * as Updates from "expo-updates";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

function formatBuildDate(raw: string): string {
  const trimmed = (raw || "").trim();
  if (!trimmed) return "";
  const attempt = (value: string) => {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };
  const normalized =
    attempt(trimmed) ||
    attempt(trimmed.replace(/\//g, "-")) ||
    attempt(trimmed.replace(/-/g, "/"));
  if (!normalized) return trimmed;
  const yyyy = normalized.getFullYear();
  const mm = String(normalized.getMonth() + 1).padStart(2, "0");
  const dd = String(normalized.getDate()).padStart(2, "0");
  return `${yyyy}/${mm}/${dd}`;
}

const MODULE_CARDS = [
  {
    id: "add",
    icon: "✨",
    title: "explore.title",
    description: "快速新增單字",
    color: THEME.colors.feature.add,
    path: "/add",
  },
  {
    id: "reading",
    icon: "📖",
    title: "tabs.reading",
    description: "載入文章並學習",
    color: THEME.colors.feature.reading,
    path: "/reading",
  },
  {
    id: "articles",
    icon: "📚",
    title: "tabs.articles",
    description: "檢視已收藏的文章",
    color: THEME.colors.feature.articles,
    path: "/(tabs)/articles",
  },
  {
    id: "tags",
    icon: "🏷️",
    title: "index.tagsManage",
    description: "管理學習標籤",
    color: THEME.colors.feature.tags,
    path: "/tags",
  },
  {
    id: "review",
    icon: "🔄",
    title: "index.review",
    description: "複習單字",
    color: THEME.colors.feature.review,
    path: "/review",
  },
  {
    id: "exam",
    icon: "📝",
    title: "index.exam",
    description: "考試練習",
    color: THEME.colors.feature.exam,
    path: "/exam",
  },
  {
    id: "listening",
    icon: "🎧",
    title: "index.listening",
    description: "index.listeningDescription",
    color: THEME.colors.feature.listening,
    path: "/listening",
  },
  {
    id: "settings",
    icon: "⚙️",
    title: "tabs.settings",
    description: "調整應用程式行為",
    color: THEME.colors.gray[500],
    path: "/(tabs)/settings",
  },
];

export default function Index() {
  const router = useRouter();
  const { t } = useI18n();

  const extra = {
    ...(((Updates.manifest as any)?.extra) ?? {}),
    ...((Constants.manifestExtra as any) ?? {}),
    ...((Constants.expoConfig as any)?.extra ?? {}),
  };
  const buildDate = "2025/11/27";
  const buildDateLabel = t("index.lastUpdated", { date: buildDate });

  return (
    <View style={styles.container}>
      <PageHeader
        title={t("index.title")}
        subtitle={buildDateLabel}
        backgroundColor={THEME.colors.primaryLight}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>📚 {t("index.modules")}</Text>
        <View style={styles.cardGrid}>
          {MODULE_CARDS.map((module) => (
            <Pressable
              key={module.id}
              onPress={() => router.push(module.path as any)}
              style={({ pressed }) => [
                styles.moduleCard,
                { borderTopColor: module.color },
                pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] },
              ]}
            >
              <View style={styles.moduleCardHeader}>
                <Text style={styles.cardIcon}>{module.icon}</Text>
                <MaterialIcons
                  name="arrow-forward"
                  size={20}
                  color={module.color}
                  style={{ marginLeft: "auto" }}
                />
              </View>
              <Text style={styles.cardTitle}>{t(module.title)}</Text>
              <Text style={styles.cardDescription}>{module.description}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.surfaceAlt,
  },
  content: {
    paddingHorizontal: THEME.spacing.lg,
    paddingTop: THEME.spacing.lg,
    paddingBottom: THEME.spacing.xxxl * 2,
  },
  sectionTitle: {
    ...THEME.typography.h3,
    color: THEME.colors.gray[900],
    marginBottom: THEME.spacing.lg,
    marginTop: THEME.spacing.lg,
  },
  cardGrid: {
    gap: THEME.spacing.lg,
    marginBottom: THEME.spacing.xl,
  },
  moduleCard: {
    padding: THEME.spacing.lg,
    minHeight: 140,
    borderTopWidth: 4,
    justifyContent: "flex-start",
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    ...THEME.shadows.md,
  },
  moduleCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: THEME.spacing.md,
  },
  cardIcon: {
    fontSize: 40,
  },
  cardTitle: {
    ...THEME.typography.subtitle,
    color: THEME.colors.gray[900],
    marginBottom: THEME.spacing.sm,
  },
  cardDescription: {
    ...THEME.typography.bodySmall,
    color: THEME.colors.gray[500],
  },
});
