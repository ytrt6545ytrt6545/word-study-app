import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View, Animated } from "react-native";
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

interface PlayingCardProps {
  word: Word;
  stage: number;
  progress: number;
  onPlayAgain: () => void;
  onNextWord: () => void;
  canGoNext: boolean;
  t: any;
}

function PlayingCard({
  word,
  stage,
  progress,
  onPlayAgain,
  onNextWord,
  canGoNext,
  t,
}: PlayingCardProps) {
  const [wordOpacity] = useState(new Animated.Value(0));
  const [pulseAnim] = useState(new Animated.Value(1));
  const loopRef = useRef<any>(null);
  const wordFontSize = useMemo(() => {
    const len = (word.en || "").length;
    if (len <= 8) return 52;
    const shrink = Math.min(18, (len - 8) * 2);
    return Math.max(34, 52 - shrink);
  }, [word.en]);

  useEffect(() => {
    if (stage >= 1) {
      Animated.timing(wordOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      wordOpacity.setValue(0);
    }
  }, [stage, wordOpacity]);

  useEffect(() => {
    if (stage >= 4 && stage < 5) {
      loopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      );
      loopRef.current.start();
    } else {
      if (loopRef.current) {
        loopRef.current.stop();
        loopRef.current = null;
      }
      pulseAnim.setValue(1);
    }

    return () => {
      if (loopRef.current) {
        loopRef.current.stop();
      }
    };
  }, [stage, pulseAnim]);

  return (
    <View style={styles.playingCard}>
      <View style={styles.progressIndicator}>
        <View style={[styles.progressBar, { width: `${progress}%` }]} />
      </View>

      <Animated.View
        style={[
          styles.displayArea,
          {
            opacity: wordOpacity,
          },
        ]}
      >
        {stage >= 1 && (
          <Animated.Text
            style={[
              styles.wordDisplay,
              {
                fontSize: wordFontSize,
                lineHeight: wordFontSize * 1.1,
                transform: [{ scale: stage >= 4 ? pulseAnim : 1 }],
              },
            ]}
          >
            {word.en}
          </Animated.Text>
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
          <Animated.View
            style={[
              styles.translationBox,
              {
                transform: [{ scale: pulseAnim }],
              },
            ]}
          >
            <Text style={styles.translation}>
              {word.zh?.trim() ? word.zh : t("listening.noTranslation")}
            </Text>
          </Animated.View>
        )}
      </Animated.View>

      {stage >= 5 && (
        <View style={styles.actions}>
          <Button
            variant="secondary"
            size="lg"
            fullWidth
            onPress={onPlayAgain}
            icon={<MaterialIcons name="repeat" size={20} color={THEME.colors.gray[900]} />}
          >
            {t("listening.againButton")}
          </Button>
          {canGoNext && (
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onPress={onNextWord}
              icon={<MaterialIcons name="arrow-forward" size={20} color="#fff" />}
              iconPosition="right"
            >
              {t("listening.nextWord")}
            </Button>
          )}
        </View>
      )}
    </View>
  );
}

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
        {currentWord && (
          <PlayingCard
            word={currentWord}
            stage={stage}
            progress={((currentIndex + 1) / words.length) * 100}
            onPlayAgain={runSequence}
            onNextWord={goNextWord}
            canGoNext={currentIndex < words.length - 1}
            t={t}
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
    padding: THEME.spacing.lg,
    justifyContent: "center",
  },
  playingCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.xl,
    padding: THEME.spacing.xl,
    ...THEME.shadows.lg,
  },
  progressIndicator: {
    height: 6,
    backgroundColor: THEME.colors.gray[200],
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: THEME.spacing.xl,
  },
  progressBar: {
    height: "100%",
    backgroundColor: THEME.colors.feature.listening,
    borderRadius: 3,
  },
  displayArea: {
    minHeight: 280,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: THEME.spacing.xl,
  },
  wordDisplay: {
    fontSize: 52,
    fontWeight: "800",
    color: THEME.colors.gray[900],
    textAlign: "center",
    letterSpacing: -1,
  },
  repeatIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: THEME.spacing.md,
    marginTop: THEME.spacing.lg,
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: THEME.spacing.sm,
    backgroundColor: THEME.colors.gray[100],
    borderRadius: THEME.radius.md,
  },
  repeatText: {
    fontSize: 14,
    color: THEME.colors.gray[600],
    fontWeight: "600",
  },
  finalRepeatIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: THEME.spacing.md,
    marginTop: THEME.spacing.lg,
    paddingHorizontal: THEME.spacing.lg,
    paddingVertical: THEME.spacing.md,
    backgroundColor: THEME.colors.feature.listening + "15",
    borderLeftWidth: 4,
    borderLeftColor: THEME.colors.feature.listening,
    borderRadius: THEME.radius.md,
  },
  finalRepeatText: {
    fontSize: 14,
    color: THEME.colors.feature.listening,
    fontWeight: "700",
  },
  translationBox: {
    marginTop: THEME.spacing.xl,
    paddingHorizontal: THEME.spacing.lg,
    paddingVertical: THEME.spacing.lg,
    backgroundColor: THEME.colors.semantic.warning + "15",
    borderLeftWidth: 4,
    borderLeftColor: THEME.colors.semantic.warning,
    borderRadius: THEME.radius.md,
  },
  translation: {
    fontSize: 18,
    color: THEME.colors.gray[900],
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 24,
  },
  actions: {
    gap: THEME.spacing.md,
    marginTop: THEME.spacing.lg,
  },
});
