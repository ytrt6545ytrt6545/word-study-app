import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useI18n } from "@/i18n";
import Constants from "expo-constants";
import * as Updates from "expo-updates";

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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>{t("index.title")}</Text>
        <Text style={styles.updated}>{buildDateLabel}</Text>
      </View>

      <View style={styles.noticeCard}>
        <Text style={styles.noticeIcon}>💡</Text>
        <Text style={styles.noticeText}>{t("index.notice")}</Text>
      </View>

      <View style={styles.cardGrid}>
        <Pressable
          style={[styles.card, styles.cardTags]}
          onPress={() => router.push("/tags")}
        >
          <Text style={styles.cardIcon}>🏷️</Text>
          <Text style={styles.cardTitle}>{t("index.tagsManage")}</Text>
          <Text style={styles.cardDescription}>管理學習標籤</Text>
        </Pressable>

        <Pressable
          style={[styles.card, styles.cardReview]}
          onPress={() => router.push("/review")}
        >
          <Text style={styles.cardIcon}>🔄</Text>
          <Text style={styles.cardTitle}>{t("index.review")}</Text>
          <Text style={styles.cardDescription}>複習單字</Text>
        </Pressable>

        <Pressable
          style={[styles.card, styles.cardExam]}
          onPress={() => router.push("/exam")}
        >
          <Text style={styles.cardIcon}>📝</Text>
          <Text style={styles.cardTitle}>{t("index.exam")}</Text>
          <Text style={styles.cardDescription}>考試練習</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f7fa" },
  content: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 40 },
  header: { marginBottom: 24 },
  title: { fontSize: 32, fontWeight: "700", color: "#1a1a1a", marginBottom: 4 },
  updated: { fontSize: 14, color: "#999", fontWeight: "500" },
  noticeCard: {
    backgroundColor: "#fff3cd",
    borderLeftWidth: 4,
    borderLeftColor: "#ffc107",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    flexDirection: "row",
    alignItems: "center"
  },
  noticeIcon: { fontSize: 20, marginRight: 12 },
  noticeText: { flex: 1, color: "#856404", fontWeight: "600", fontSize: 14, lineHeight: 20 },
  cardGrid: { gap: 12 },
  card: {
    borderRadius: 16,
    padding: 20,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    backgroundColor: "#fff",
    minHeight: 140,
  },
  cardTags: { borderTopWidth: 4, borderTopColor: "#2196F3" },
  cardReview: { borderTopWidth: 4, borderTopColor: "#4CAF50" },
  cardExam: { borderTopWidth: 4, borderTopColor: "#FF9800" },
  cardIcon: { fontSize: 36, marginBottom: 8 },
  cardTitle: { fontSize: 18, fontWeight: "700", color: "#1a1a1a", marginBottom: 4 },
  cardDescription: { fontSize: 13, color: "#999", fontWeight: "500" },
});
