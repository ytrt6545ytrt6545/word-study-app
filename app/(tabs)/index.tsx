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
];

export default function Index() {
  const router = useRouter();
  const { t } = useI18n();

  const extra = {
    ...(((Updates.manifest as any)?.extra) ?? {}),
    ...((Constants.manifestExtra as any) ?? {}),
    ...((Constants.expoConfig as any)?.extra ?? {}),
  };
  const configDate: string | undefined = typeof extra.buildDate === "string" ? extra.buildDate : undefined;
  const envDate = process.env.EXPO_PUBLIC_BUILD_DATE;
  const rawDate =
    envDate ||
    configDate ||
    ((typeof __DEV__ !== "undefined" && __DEV__) ? new Date().toISOString().slice(0, 10) : "");
  const buildDate = rawDate ? formatBuildDate(rawDate) : "";
  const buildDateLabel = buildDate
    ? t("index.lastUpdated", { date: buildDate })
    : t("index.lastUpdated.missing");

  return (
    <View style={styles.container}>
      <PageHeader
        title={t("index.title")}
        subtitle={buildDateLabel}
        backgroundColor={THEME.colors.primaryLight}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <Card variant="outlined" style={styles.noticeCard}>
          <View style={styles.noticeContent}>
            <Text style={styles.noticeIcon}>💡</Text>
            <View style={styles.noticeTextWrapper}>
              <Text style={styles.noticeText}>{t("index.notice")}</Text>
            </View>
          </View>
        </Card>

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
  noticeCard: {
    marginBottom: THEME.spacing.xxl,
    padding: THEME.spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: THEME.colors.semantic.warning,
  },
  noticeContent: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: THEME.spacing.lg,
  },
  noticeIcon: {
    fontSize: 28,
    marginTop: THEME.spacing.xs,
  },
  noticeTextWrapper: {
    flex: 1,
  },
  noticeText: {
    ...THEME.typography.body,
    color: THEME.colors.gray[900],
    lineHeight: 24,
    fontWeight: "500",
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
