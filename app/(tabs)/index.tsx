import { Button, StyleSheet, Text, View } from "react-native";
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
    <View style={styles.container}>
      <Text style={styles.title}>{t("index.title")}</Text>
      <Text style={styles.updated}>{buildDateLabel}</Text>
      <Text style={styles.notice}>{t("index.notice")}</Text>
      <View style={styles.colButtons}>
        <Button title={t("index.tagsManage")} onPress={() => router.push("/tags")} />
        <View style={{ height: 10 }} />
        <Button title={t("index.review")} onPress={() => router.push("/review")} />
        <View style={{ height: 10 }} />
        <Button title={t("index.exam")} onPress={() => router.push("/exam")} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "#fff" },
  title: { fontSize: 28, fontWeight: "bold", marginBottom: 4 },
  updated: { color: "#666", marginBottom: 8 },
  notice: { color: "#2e7d32", fontWeight: "bold", marginBottom: 8 },
  colButtons: { marginTop: 8, alignSelf: "stretch", paddingHorizontal: 20 },
});
