import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as Speech from "expo-speech";
import { loadWords, Word } from "@/utils/storage";
import { getSpeechOptions } from "@/utils/tts";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { THEME } from "@/constants/Colors";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

const EN_DELAY = 300;
const ZH_DELAY = 300;
const AUTO_NEXT_DELAY = 1000;

export default function ListeningRunner() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tag?: string | string[] }>();
  const tag = (Array.isArray(params.tag) ? params.tag[0] : params.tag || "").toString();
  const { t } = useI18n();

  const [words, setWords] = useState<Word[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [stage, setStage] = useState(0);
  const [loading, setLoading] = useState(true);

  const autoNextRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sequenceRef = useRef(0);
  const speechOptsRef = useRef<{ en: Awaited<ReturnType<typeof getSpeechOptions>> | null; zh: Awaited<ReturnType<typeof getSpeechOptions>> | null }>({ en: null, zh: null });

  const clearAutoNext = useCallback(() => {
    if (autoNextRef.current) {
      clearTimeout(autoNextRef.current);
      autoNextRef.current = null;
    }
  }, []);

  const stopSpeech = useCallback(() => {
    try {
      Speech.stop();
    } catch {}
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      (async () => {
        try {
          const list = await loadWords();
          if (cancelled) return;
          const filtered = list
            .filter((w) => (w.tags || []).includes(tag))
            .sort((a, b) => {
              const at = new Date(a.createdAt || 0).getTime();
              const bt = new Date(b.createdAt || 0).getTime();
              return bt - at;
            });
          setWords(filtered);
          setCurrentIndex(0);
          setStage(0);
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
        sequenceRef.current += 1;
        clearAutoNext();
        stopSpeech();
      };
    }, [tag, clearAutoNext, stopSpeech])
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [enOpts, zhOpts] = await Promise.all([getSpeechOptions("en-US"), getSpeechOptions("zh-TW")]);
        if (!cancelled) {
          speechOptsRef.current = { en: enOpts, zh: zhOpts };
        }
      } catch (err) {
        console.error("load speech options failed", err);
        if (!cancelled) speechOptsRef.current = { en: null, zh: null };
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const currentWord = useMemo(() => {
    if (!words.length) return null;
    return words[Math.min(currentIndex, words.length - 1)] || null;
  }, [words, currentIndex]);

  const goBackToSelection = useCallback(() => {
    clearAutoNext();
    stopSpeech();
    sequenceRef.current += 1;
    setStage(0);
    router.replace("/listening");
  }, [clearAutoNext, router, stopSpeech]);

  const goNextWord = useCallback(() => {
    clearAutoNext();
    stopSpeech();
    sequenceRef.current += 1;
    if (currentIndex < words.length - 1) {
      setStage(0);
      setCurrentIndex((idx) => Math.min(idx + 1, words.length - 1));
    } else if (words.length > 0) {
      goBackToSelection();
    }
  }, [clearAutoNext, currentIndex, goBackToSelection, stopSpeech, words.length]);

  const speak = useCallback(
    (text: string, language: "en" | "zh") =>
      new Promise<void>((resolve) => {
        const trimmed = (text || "").trim();
        if (!trimmed) {
          resolve();
          return;
        }
        const opts = language === "en" ? speechOptsRef.current.en : speechOptsRef.current.zh;
        const langCode = language === "en" ? "en-US" : "zh-TW";
        try {
          Speech.speak(trimmed, {
            language: langCode,
            rate: opts?.rate,
            pitch: opts?.pitch,
            voice: opts?.voice,
            onDone: resolve,
            onStopped: resolve,
            onError: (err) => {
              console.error("speech speak failed", err);
              resolve();
            },
          });
        } catch (err) {
          console.error("speech speak failed", err);
          resolve();
        }
      }),
    []
  );

  const runSequence = useCallback(() => {
    if (!currentWord) return;
    clearAutoNext();
    stopSpeech();
    setStage(0);
    sequenceRef.current += 1;
    const token = sequenceRef.current;
    const zhText = currentWord.zh?.trim() ? currentWord.zh : t("listening.noTranslation");

    const waitFor = (ms: number) =>
      new Promise<void>((resolve) => {
        setTimeout(resolve, ms);
      });

    const step = async (nextStage: number, lang: "en" | "zh", text: string, pause: number) => {
      if (sequenceRef.current !== token) return false;
      setStage(nextStage);
      await speak(text, lang);
      if (sequenceRef.current !== token) return false;
      await waitFor(pause);
      return sequenceRef.current === token;
    };

    void (async () => {
      if (!(await step(1, "en", currentWord.en, EN_DELAY))) return;
      if (!(await step(2, "en", currentWord.en, EN_DELAY))) return;
      if (!(await step(3, "en", currentWord.en, EN_DELAY))) return;
      if (!(await step(4, "zh", zhText, ZH_DELAY))) return;
      if (sequenceRef.current !== token) return;
      setStage(5);
      autoNextRef.current = setTimeout(() => {
        if (sequenceRef.current !== token) return;
        autoNextRef.current = null;
        goNextWord();
      }, AUTO_NEXT_DELAY);
    })();
  }, [clearAutoNext, currentWord, goNextWord, speak, stopSpeech, t]);

  useEffect(() => {
    if (!currentWord || loading) return;
    runSequence();
  }, [currentWord, runSequence, loading]);

  if (!tag) {
    return (
      <View style={styles.container}>
        <PageHeader title={t("listening.practiceTitle", { tag: "" })} icon="🎧" showBackButton onBackPress={goBackToSelection} />
        <View style={styles.content}>
          <EmptyState
            icon="🎧"
            title={t("listening.noWordsForTag")}
            description={t("listening.noTagsDescription")}
            action={<Button onPress={goBackToSelection}>{t("listening.backToSelection")}</Button>}
          />
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <PageHeader title={t("listening.practiceTitle", { tag })} icon="🎧" />
        <View style={styles.content}>
          <LoadingSpinner size="lg" color={THEME.colors.feature.listening} />
        </View>
      </View>
    );
  }

  if (!currentWord) {
    return (
      <View style={styles.container}>
        <PageHeader title={t("listening.practiceTitle", { tag })} icon="🎧" showBackButton onBackPress={goBackToSelection} />
        <View style={styles.content}>
          <EmptyState
            icon="🎧"
            title={t("listening.noWordsForTag")}
            description={t("listening.noTagsDescription")}
            action={<Button onPress={goBackToSelection}>{t("listening.backToSelection")}</Button>}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <PageHeader
        title={t("listening.practiceTitle", { tag })}
        icon="🎧"
        subtitle={t("listening.progress", { index: currentIndex + 1, total: words.length })}
        showBackButton
        onBackPress={goBackToSelection}
      />
      <View style={styles.content}>
        <View style={styles.playingCard}>
          <View style={styles.progressIndicator}>
            <View style={[styles.progressBar, { width: `${((currentIndex + 1) / words.length) * 100}%` }]} />
          </View>

          <View style={styles.displayArea}>
            {stage >= 1 && (
              <Text style={styles.wordDisplay}>{currentWord.en}</Text>
            )}
            {stage >= 2 && (
              <View style={styles.repeatIndicator}>
                <MaterialIcons name="repeat" size={16} color={THEME.colors.gray[500]} />
                <Text style={styles.repeatText}>{t("listening.repeat")}</Text>
              </View>
            )}
            {stage >= 3 && (
              <View style={styles.finalRepeatIndicator}>
                <MaterialIcons name="repeat" size={16} color={THEME.colors.feature.listening} />
                <Text style={styles.finalRepeatText}>{t("listening.finalRepeat")}</Text>
              </View>
            )}
            {stage >= 4 && (
              <View style={styles.translationBox}>
                <Text style={styles.translation}>{currentWord.zh?.trim() ? currentWord.zh : t("listening.noTranslation")}</Text>
              </View>
            )}
          </View>

          {stage >= 5 && (
            <View style={styles.actions}>
              <Button
                variant="secondary"
                size="lg"
                fullWidth
                onPress={runSequence}
                icon={<MaterialIcons name="repeat" size={20} color={THEME.colors.gray[900]} />}
              >
                {t("listening.againButton")}
              </Button>
              {currentIndex < words.length - 1 && (
                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  onPress={goNextWord}
                  icon={<MaterialIcons name="arrow-forward" size={20} color="#fff" />}
                  iconPosition="right"
                >
                  {t("listening.nextWord")}
                </Button>
              )}
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.surfaceAlt
  },
  content: {
    flex: 1,
    padding: THEME.spacing.lg,
    justifyContent: "center",
  },
  playingCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    padding: THEME.spacing.xl,
    ...THEME.shadows.md,
  },
  progressIndicator: {
    height: 4,
    backgroundColor: THEME.colors.gray[200],
    borderRadius: 2,
    overflow: "hidden",
    marginBottom: THEME.spacing.xl,
  },
  progressBar: {
    height: "100%",
    backgroundColor: THEME.colors.feature.listening,
  },
  displayArea: {
    minHeight: 280,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: THEME.spacing.xl,
  },
  wordDisplay: {
    fontSize: 48,
    fontWeight: "700",
    color: THEME.colors.gray[900],
    textAlign: "center",
  },
  repeatIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: THEME.spacing.md,
    marginTop: THEME.spacing.lg,
  },
  repeatText: {
    fontSize: 14,
    color: THEME.colors.gray[500],
    fontWeight: "500",
  },
  finalRepeatIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: THEME.spacing.md,
    marginTop: THEME.spacing.lg,
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: THEME.spacing.sm,
    backgroundColor: THEME.colors.primaryLight,
    borderRadius: THEME.radius.md,
  },
  finalRepeatText: {
    fontSize: 14,
    color: THEME.colors.primary,
    fontWeight: "600",
  },
  translationBox: {
    marginTop: THEME.spacing.xl,
    paddingHorizontal: THEME.spacing.lg,
    paddingVertical: THEME.spacing.md,
    backgroundColor: THEME.colors.gray[50],
    borderLeftWidth: 4,
    borderLeftColor: THEME.colors.semantic.warning,
    borderRadius: THEME.radius.md,
  },
  translation: {
    fontSize: 18,
    color: THEME.colors.gray[900],
    fontWeight: "600",
    textAlign: "center",
  },
  actions: {
    gap: THEME.spacing.md,
    marginTop: THEME.spacing.lg,
  },
});
