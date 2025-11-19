import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View, Pressable } from "react-native";
import { loadWords, saveWords, Word, REVIEW_TAG } from "@/utils/storage";
import { aiCompleteWord, resolveOpenAIKey } from "@/utils/ai";
import { useTabMark } from "@/context/TabMarkContext";
import * as Speech from "expo-speech";
import { getSpeechOptions } from "@/utils/tts";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAlert } from "@/components/ui/AlertManager";
import { THEME } from "@/constants/Colors";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

// AI 探索頁：輸入單字或中文關鍵字後，呼叫 OpenAI 產生翻譯、例句並快速寫入字庫。
// 亦提供朗讀、標籤預設與結果提示，協助使用者快速擴充單字量。
// 使用流程：讀取既有單字 → 呼叫 AI → 以 `saveWords` 寫回 → 以 `TabMarkContext` 提醒其他分頁刷新。

const AI_NOTE_CALLING = "\u0041\u0049\u003a\u0020\u547c\u53eb\u4e2d\u002e\u002e\u002e";
const AI_NOTE_NO_FIELDS = "\u0041\u0049\u003a\u0020\u5df2\u56de\u50b3\uff0c\u4f46\u627e\u4e0d\u5230\u53ef\u586b\u5165\u7684\u6b04\u4f4d";
const AI_ALERT_PREFIX = "\u8a3a\u65b7";
const AI_ALERT_BODY_PREFIX =
  "\u0041\u0049\u0020\u5df2\u56de\u50b3\u8cc7\u6599\uff0c\u4f46\u627e\u4e0d\u5230\u53ef\u586b\u5165\u7684\u6b04\u4f4d\u3002\u000a\u56de\u50b3\u7247\u6bb5\uff1a";
const AI_NOTE_UPDATED_PREFIX = "\u0041\u0049\u003a\u0020\u5df2\u66f4\u65b0\u0020\u2192\u0020";
const AI_NOTE_FAILED_PREFIX = "\u0041\u0049\u003a\u0020\u5931\u6557\u0020";

// 畫面負責：維護輸入欄位狀態、處理 AI 回傳結果、寫入 AsyncStorage，並依情境導向新增或測驗頁。
export default function Explore() {
  const router = useRouter();
  const { setMarkedTab } = useTabMark();
  const { t } = useI18n();
  const alert = useAlert();
  const params = useLocalSearchParams<{ tag?: string | string[] }>();
  const defaultTag = (Array.isArray(params.tag) ? params.tag[0] : params.tag || "").toString();

  const [en, setEn] = useState("");
  const [zh, setZh] = useState("");
  const [exEn, setExEn] = useState("");
  const [exZh, setExZh] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiNote, setAiNote] = useState<string>("");
  const [zhHeight, setZhHeight] = useState(40);
  const [exEnHeight, setExEnHeight] = useState(40);
  const [exZhHeight, setExZhHeight] = useState(40);

  const speakWordTwice = async (text: string) => {
    const value = (text || "").toString().trim();
    if (!value) return;
    try {
      Speech.stop();
    } catch {}
    const opts = await getSpeechOptions("en-US");
    Speech.speak(value, { language: "en-US", voice: opts.voice, rate: opts.rate, pitch: opts.pitch });
    setTimeout(() => {
      try {
        Speech.speak(value, { language: "en-US", voice: opts.voice, rate: opts.rate, pitch: opts.pitch });
      } catch {}
    }, 600);
  };

  const onClear = () => {
    setEn("");
    setZh("");
    setExEn("");
    setExZh("");
    setAiNote("");
    setZhHeight(40);
    setExEnHeight(40);
    setExZhHeight(40);
  };

  const addWord = async () => {
    const _en = en.trim();
    const _zh = zh.trim();
    const _exEn = exEn.trim();
    const _exZh = exZh.trim();
    if (!_en || !_zh) {
      alert.warning(t("explore.fillRequired") || "Please fill in required fields");
      return;
    }
    const list = await loadWords();
    if (list.some((w) => w.en.toLowerCase() === _en.toLowerCase())) {
      alert.warning(t("explore.exists.message", { word: _en }));
      return;
    }
    const tagsSet = new Set<string>([REVIEW_TAG]);
    if (defaultTag && defaultTag !== REVIEW_TAG) tagsSet.add(defaultTag);
    const next: Word[] = [
      ...list,
      {
        en: _en,
        zh: _zh,
        exampleEn: _exEn,
        exampleZh: _exZh,
        status: "unknown",
        createdAt: new Date().toISOString(),
        reviewCount: 0,
        tags: Array.from(tagsSet),
      },
    ];
    await saveWords(next);
    onClear();
    setTimeout(() => {
      setMarkedTab(null);
    }, 0);
    alert.success(t("explore.added.message", { word: _en }));
  };

  const onAIFill = async () => {
    const _en = en.trim();
    const _zh = zh.trim();
    const onlyEn = !!_en && !_zh;
    const onlyZh = !!_zh && !_en;
    if (!onlyEn && !onlyZh) {
      alert.warning(t("explore.ai.onlyOne.message") || "Please enter either English or Chinese only");
      return;
    }
    try {
      setAiLoading(true);
      alert.info("🤖 AI processing...");

      const prev = { en, zh, exEn, exZh };
      const res = await aiCompleteWord({ en: onlyEn ? _en : undefined, zh: onlyZh ? _zh : undefined });

      const changed: string[] = [];
      if (res.en !== undefined) setEn(res.en || "");
      if (res.en !== undefined && (res.en || "") !== prev.en) changed.push("en");
      if (res.zh !== undefined) setZh(res.zh || "");
      if (res.zh !== undefined && (res.zh || "") !== prev.zh) changed.push("zh");
      if (res.exampleEn !== undefined) setExEn(res.exampleEn || "");
      if (res.exampleEn !== undefined && (res.exampleEn || "") !== prev.exEn) changed.push("exampleEn");
      if (res.exampleZh !== undefined) setExZh(res.exampleZh || "");
      if (res.exampleZh !== undefined && (res.exampleZh || "") !== prev.exZh) changed.push("exampleZh");

      if (changed.length === 0) {
        alert.warning("AI response received but no fields were updated");
      } else {
        alert.success(`✨ Updated: ${changed.join(", ")}`);
      }

      const speakText = (res.en || _en || "").toString();
      if (speakText) await speakWordTwice(speakText);
    } catch (e: any) {
      alert.error(e?.message ?? "AI call failed");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <PageHeader icon="✨" title={t("explore.title")} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollContent}>
        <View style={styles.quickActions}>
          <Button
            variant="secondary"
            size="sm"
            icon={<MaterialIcons name="volume-up" size={16} color={THEME.colors.gray[900]} />}
            onPress={() => speakWordTwice(en)}
          >
            {t("explore.preview")}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<MaterialIcons name="delete" size={16} color={THEME.colors.semantic.error} />}
            onPress={onClear}
          >
            {t("explore.clear")}
          </Button>
        </View>

        <Card style={styles.formCard}>
          <Input
            label="📝 English Word"
            placeholder={t("explore.input.en")}
            value={en}
            onChangeText={setEn}
            autoCapitalize="none"
            onFocus={() => {
              if (en.trim() && zh.trim()) setZh("");
            }}
          />

          <Input
            label="🌐 Chinese Translation"
            placeholder={t("explore.input.zh")}
            value={zh}
            onChangeText={setZh}
            multiline
            numberOfLines={3}
            onFocus={() => {
              if (en.trim() && zh.trim()) setEn("");
            }}
          />

          <Input
            label="💬 English Example"
            placeholder={t("explore.input.exEn")}
            value={exEn}
            onChangeText={setExEn}
            multiline
            numberOfLines={2}
          />

          <Input
            label="📖 Example Translation"
            placeholder={t("explore.input.exZh")}
            value={exZh}
            onChangeText={setExZh}
            multiline
            numberOfLines={2}
          />
        </Card>

        <Button
          variant="success"
          size="lg"
          fullWidth
          loading={aiLoading}
          onPress={onAIFill}
          icon={<MaterialIcons name="smart-toy" size={20} color="#fff" />}
        >
          {t("explore.ai")}
        </Button>

        <View style={styles.actionButtons}>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onPress={addWord}
            icon={<MaterialIcons name="add-circle" size={20} color="#fff" />}
          >
            {t("explore.add")}
          </Button>

          {defaultTag && (
            <Button
              variant="secondary"
              size="lg"
              fullWidth
              onPress={() => router.push({ pathname: "/tags/[tag]", params: { tag: defaultTag } })}
              icon={<MaterialIcons name="arrow-back" size={20} color={THEME.colors.gray[900]} />}
            >
              {t("explore.backToTag")}
            </Button>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.surfaceAlt
  },
  scrollContent: {
    paddingHorizontal: THEME.spacing.lg,
    paddingVertical: THEME.spacing.lg,
    paddingBottom: THEME.spacing.xxxl * 2,
  },
  quickActions: {
    flexDirection: "row",
    gap: THEME.spacing.md,
    marginBottom: THEME.spacing.lg,
  },
  formCard: {
    marginBottom: THEME.spacing.lg,
    padding: THEME.spacing.lg,
    gap: THEME.spacing.lg,
  },
  actionButtons: {
    gap: THEME.spacing.md,
    marginTop: THEME.spacing.xl,
  },
});
