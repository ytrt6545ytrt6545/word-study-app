import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View, Platform } from "react-native";
import * as Speech from "expo-speech";
import { useLocalSearchParams, useRouter } from "expo-router";
import { REVIEW_TAG, bumpReview, loadWords, toggleWordTag, Word, srsAnswer, getDailyStats, bumpDailyStats, getSrsLimits } from "@/utils/storage";
import { getSpeechOptions } from "@/utils/tts";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useAlert } from "@/components/ui/AlertManager";
import { THEME } from "@/constants/Colors";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

type QuizChoice = { zh: string; correct: boolean };
type Quiz = { word: Word; en: string; choices: QuizChoice[] };

function shuffle<T>(arr: T[]): T[] {
  return arr.map((v) => [Math.random(), v] as const).sort((a, b) => a[0] - b[0]).map(([, v]) => v);
}

const SPEECH_REPEAT_DELAY = 450;
const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const safeStopSpeech = () => { try { Speech.stop(); } catch {} };
const speakAsync = (text: string, options: Parameters<typeof Speech.speak>[1] = {}) =>
  new Promise<void>((resolve) => {
    Speech.speak(text, {
      ...(options || {}),
      onDone: resolve,
      onStopped: resolve,
      onError: () => resolve(),
    });
  });
const speakWordTwice = async (text: string) => {
  const phrase = (text || "").trim();
  if (!phrase) return;
  const opts = await getSpeechOptions("en-US");
  const baseOptions: Parameters<typeof Speech.speak>[1] = {
    language: "en-US",
    voice: opts.voice,
    rate: opts.rate,
    pitch: opts.pitch,
  };
  safeStopSpeech();
  await speakAsync(phrase, baseOptions);
  await delay(SPEECH_REPEAT_DELAY);
  safeStopSpeech();
  await speakAsync(phrase, baseOptions);
};

export default function ReviewScreen() {
  const router = useRouter();
  const alert = useAlert();
  const params = useLocalSearchParams<{ tag?: string | string[]; mode?: string | string[] }>();
  const tagParam = (Array.isArray(params.tag) ? params.tag[0] : params.tag || "").toString();
  const modeParam = (Array.isArray(params.mode) ? params.mode[0] : params.mode || "").toString();
  const isLoopMode = modeParam === 'tag-loop' || modeParam === 'loop';
  const { t } = useI18n();
  const [showFinishDialog, setShowFinishDialog] = useState(false);

  const [allWords, setAllWords] = useState<Word[]>([]);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [limits, setLimits] = useState<{ dailyNewLimit: number; dailyReviewLimit: number }>({ dailyNewLimit: 10, dailyReviewLimit: 100 });
  const [stats, setStats] = useState<{ newUsed: number; reviewUsed: number }>({ newUsed: 0, reviewUsed: 0 });
  const [finished, setFinished] = useState(false);

  const speakingRef = useRef(false);
  const queueRef = useRef<Word[]>([]);
  const statsRef = useRef<{ newUsed: number; reviewUsed: number }>({ newUsed: 0, reviewUsed: 0 });
  const finishedRef = useRef(false);
  const lastInsufficientWordRef = useRef<string | null>(null);
  const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const candidates = useMemo(() => {
    const list = tagParam
      ? allWords.filter((w) => (w.tags || []).includes(tagParam))
      : allWords.filter((w) => (w.tags || []).includes(REVIEW_TAG));
    return list;
  }, [allWords, tagParam]);

  useEffect(() => {
    (async () => {
      const words = await loadWords();
      setAllWords(words);
      const s = await getDailyStats();
      statsRef.current = { newUsed: s.newUsed, reviewUsed: s.reviewUsed };
      setStats(statsRef.current);
      setLimits(await getSrsLimits());
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!quiz) return;
    let cancelled = false;
    safeStopSpeech();
    speakingRef.current = true;
    (async () => {
      try {
        await bumpReview(quiz.en);
        const latest = await loadWords();
        if (!cancelled) setAllWords(latest);
        if (!cancelled) await speakWordTwice(quiz.en);
      } catch (err) {
        if (__DEV__) console.warn('[Review] speak failed', err);
      } finally {
        speakingRef.current = false;
      }
    })();
    return () => {
      cancelled = true;
      safeStopSpeech();
    };
  }, [quiz]);

  const speakAgain = useCallback(async () => {
    if (!quiz || speakingRef.current) return;
    speakingRef.current = true;
    try {
      await speakWordTwice(quiz.en);
    } finally {
      speakingRef.current = false;
    }
  }, [quiz]);

  const markFinished = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    if (autoAdvanceTimer.current) {
      clearTimeout(autoAdvanceTimer.current);
      autoAdvanceTimer.current = null;
    }
    safeStopSpeech();
    queueRef.current = [];
    setSelected(null);
    setQuiz(null);
    setFinished(true);
  }, []);

  const refillQueue = useCallback(() => {
    if (isLoopMode) {
      queueRef.current = shuffle([...candidates]);
      if (queueRef.current.length === 0) {
        markFinished();
      } else {
        finishedRef.current = false;
        setFinished(false);
      }
      return;
    }
    const now = Date.now();
    const due = candidates.filter((w) => w.srsDue && Date.parse(w.srsDue) <= now);
    const notDue = candidates.filter((w) => !(w.srsDue && Date.parse(w.srsDue) <= now));
    const newOnes = notDue.filter((w) => (w.srsReps || 0) === 0);
    const newAllow = Math.max(0, (limits.dailyNewLimit || 0) - statsRef.current.newUsed);
    const reviewAllow = Math.max(0, (limits.dailyReviewLimit || 0) - statsRef.current.reviewUsed);
    const dueTake = shuffle(due).slice(0, reviewAllow);
    const takeNew: Word[] = [];
    for (const w of shuffle(newOnes)) {
      if (takeNew.length >= newAllow) break;
      if (dueTake.some((d) => d.en === w.en)) continue;
      takeNew.push(w);
    }
    queueRef.current = shuffle([...dueTake, ...takeNew]);
    if (queueRef.current.length === 0) {
      markFinished();
    } else {
      finishedRef.current = false;
      setFinished(false);
    }
  }, [isLoopMode, candidates, limits.dailyNewLimit, limits.dailyReviewLimit, markFinished]);

  const buildQuizFromWord = useCallback((correct: Word) => {
    const correctZh = (correct.zh || '').trim() || correct.en;
    const correctTagSet = new Set((correct.tags || []).filter(Boolean));
    const distinctWrong = (w: Word) => w.en !== correct.en && (w.zh || '').trim();
    const sameTagPool = shuffle(
      allWords.filter((w) => distinctWrong(w) && (w.tags || []).some((t) => correctTagSet.has(t)))
    );
    const othersPool = shuffle(
      allWords.filter((w) => distinctWrong(w) && !(w.tags || []).some((t) => correctTagSet.has(t)))
    );
    const candidatesForWrong = [...sameTagPool, ...othersPool];
    const wrongs: Word[] = [];
    const seenZh = new Set<string>();
    for (const w of candidatesForWrong) {
      if (wrongs.length >= 3) break;
      const zh = (w.zh || '').trim();
      if (!zh) continue;
      const key = zh.toLowerCase();
      if (key === correctZh.toLowerCase()) continue;
      if (seenZh.has(key)) continue;
      seenZh.add(key);
      wrongs.push(w);
    }
    if (wrongs.length < 3 && lastInsufficientWordRef.current !== correct.en) {
      lastInsufficientWordRef.current = correct.en;
      alert.warning("⚠️ 選項不足：建議新增更多單字或標籤");
    }
    const choices: QuizChoice[] = shuffle([
      { zh: correctZh, correct: true },
      ...wrongs.slice(0, 3).map((w) => ({ zh: (w.zh || '').trim() || w.en, correct: false })),
    ]);
    setQuiz({ word: correct, en: correct.en, choices });
  }, [allWords]);

  const loadNextFromQueue = useCallback(() => {
    if (queueRef.current.length === 0) {
      refillQueue();
    }
    const next = queueRef.current.shift();
    if (!next) {
      markFinished();
      return;
    }
    lastInsufficientWordRef.current = null;
    buildQuizFromWord(next);
  }, [refillQueue, markFinished, buildQuizFromWord]);

  const advanceToNext = useCallback(() => {
    if (autoAdvanceTimer.current) {
      clearTimeout(autoAdvanceTimer.current);
      autoAdvanceTimer.current = null;
    }
    setSelected(null);
    loadNextFromQueue();
  }, [loadNextFromQueue]);

  const nextQuiz = useCallback(() => {
    if (selected == null) return;
    advanceToNext();
  }, [selected, advanceToNext]);

  const onSelect = useCallback(async (idx: number) => {
    if (selected != null || !quiz) return;
    if (autoAdvanceTimer.current) {
      clearTimeout(autoAdvanceTimer.current);
      autoAdvanceTimer.current = null;
    }
    setSelected(idx);
    const currentQuiz = quiz;
    const picked = currentQuiz.choices[idx];
    const isCorrect = !!picked?.correct;
    if (isLoopMode) {
      if (!isCorrect) {
        queueRef.current.push(currentQuiz.word);
        return;
      }
    } else {
      await srsAnswer(currentQuiz.en, isCorrect);
      const isNew = (currentQuiz.word.srsReps || 0) === 0;
      if (isNew) {
        statsRef.current.newUsed += 1;
        const s = await bumpDailyStats({ newUsed: 1 });
        setStats({ newUsed: s.newUsed, reviewUsed: s.reviewUsed });
      } else {
        statsRef.current.reviewUsed += 1;
        const s = await bumpDailyStats({ reviewUsed: 1 });
        setStats({ newUsed: s.newUsed, reviewUsed: s.reviewUsed });
      }
      if (!isCorrect) {
        queueRef.current.push(currentQuiz.word);
        return;
      }
    }
    autoAdvanceTimer.current = setTimeout(() => {
      autoAdvanceTimer.current = null;
      advanceToNext();
    }, 650);
  }, [selected, quiz, advanceToNext, isLoopMode]);

  const onRemoveReviewTag = useCallback(() => {
    if (!quiz) return;
    const current = quiz;
    const rawTag = (tagParam || REVIEW_TAG).toString();
    const targetTag = rawTag.trim();
    const doRemove = async () => {
      try {
        await toggleWordTag(current.en, targetTag, false);
        const targetLc = targetTag.toLowerCase();
        setAllWords((prev) => prev.map((w) => w.en.toLowerCase() === current.en.toLowerCase()
          ? { ...w, tags: (w.tags || []).filter((tg) => ((tg || '').trim()).toLowerCase() !== targetLc) }
          : w
        ));
        queueRef.current = queueRef.current.filter((w) => w.en !== current.en);
        alert.success(`✅ 已移除「${current.en}」`);
        advanceToNext();
      } catch (err: any) {
        alert.error(err?.message || '移除失敗，請稍後再試');
      }
    };

    if (Platform.OS === 'web') {
      doRemove();
      return;
    }

    alert.showDialog(
      targetTag === REVIEW_TAG ? '移出複習' : '移出標籤',
      targetTag === REVIEW_TAG
        ? `確定要將「${current.en}」從複習清單移除嗎？`
        : `確定要將「${current.en}」從標籤「${targetTag}」移除嗎？`,
      [
        { label: "取消", onPress: () => {}, variant: 'secondary' },
        { label: "移除", onPress: doRemove, variant: 'destructive' },
      ],
    );
  }, [quiz, advanceToNext, tagParam, alert]);

  const now = Date.now();
  const dueCount = candidates.filter((w) => w.srsDue && Date.parse(w.srsDue) <= now).length;
  const newPool = candidates.filter((w) => !(w.srsDue && Date.parse(w.srsDue) <= now)).filter((w) => (w.srsReps || 0) === 0).length;
  const newRemain = Math.max(0, (limits.dailyNewLimit || 0) - stats.newUsed);

  useEffect(() => {
    if (!loading && !finished && !quiz) {
      loadNextFromQueue();
    }
  }, [loading, finished, quiz, loadNextFromQueue, candidates.length, limits.dailyNewLimit, limits.dailyReviewLimit]);

  useEffect(() => {
    return () => {
      if (autoAdvanceTimer.current) {
        clearTimeout(autoAdvanceTimer.current);
        autoAdvanceTimer.current = null;
      }
    };
  }, []);

  useEffect(() => {
    queueRef.current = queueRef.current.filter((w) => candidates.some((c) => c.en === w.en));
    if (quiz && !candidates.some((c) => c.en === quiz.en)) {
      setSelected(null);
      setQuiz(null);
      if (!finished) loadNextFromQueue();
    }
  }, [candidates, quiz, finished, loadNextFromQueue]);

  useEffect(() => {
    queueRef.current = [];
    finishedRef.current = false;
    setFinished(false);
    setSelected(null);
    setQuiz(null);
  }, [tagParam]);

  useEffect(() => {
    if (!finished) return;
    safeStopSpeech();
    if (isLoopMode) {
      setShowFinishDialog(true);
      return;
    }
    alert.info("✅ 複習完成，將於 3 秒後返回");
    const timer = setTimeout(() => {
      try { router.back(); } catch {}
    }, 3000);
    return () => clearTimeout(timer);
  }, [finished, router, isLoopMode, alert, t]);

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>載入中...</Text>
      </View>
    );
  }

  if (finished) {
    return (
      <>
        <View style={styles.container}>
          <Text style={styles.title}>複習完成 ✅</Text>
          <Text style={styles.hint}>將於 3 秒後返回上一頁</Text>
        </View>
        <Dialog
          visible={showFinishDialog}
          title={t('review.loop.done.title')}
          description={t('review.loop.done.message')}
          actions={[
            {
              label: t('review.loop.again'),
              variant: 'primary',
              onPress: () => {
                setShowFinishDialog(false);
                finishedRef.current = false;
                setFinished(false);
                setSelected(null);
                setQuiz(null);
                refillQueue();
              },
            },
            {
              label: t('review.loop.finish'),
              variant: 'secondary',
              onPress: () => {
                setShowFinishDialog(false);
                setTimeout(() => {
                  try {
                    router.back();
                  } catch {}
                }, 500);
              },
            },
          ]}
          onDismiss={() => {
            setShowFinishDialog(false);
            setTimeout(() => {
              try {
                router.back();
              } catch {}
            }, 500);
          }}
        />
      </>
    );
  }

  if (candidates.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>沒有可複習的單字</Text>
        <Text style={styles.hint}>{`請在單字詳情加入「${REVIEW_TAG}」標籤`}</Text>
        <View style={{ height: 20 }} />
        <Button
          variant="primary"
          onPress={() => router.back()}
          icon={<MaterialIcons name="arrow-back" size={20} color="#fff" />}
        >
          返回上一頁
        </Button>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('review.title')}</Text>
        {!isLoopMode && (
          <Text style={styles.stats}>
            📊 到期：{dueCount} | 新卡：{Math.min(newPool, newRemain)} ({stats.newUsed}/{limits.dailyNewLimit})
          </Text>
        )}
      </View>
      {quiz && (
        <View style={styles.content}>
          <Text style={styles.wordDisplay}>{quiz.en}</Text>
          <View style={styles.choicesWrap}>
            {quiz.choices.map((c, i) => {
              const picked = selected === i;
              const showCorrect = selected != null && c.correct;
              const showWrong = selected != null && picked && !c.correct;
              return (
                <Pressable
                  key={i}
                  style={({ pressed }) => [
                    styles.choiceBtn,
                    picked && styles.choicePicked,
                    showCorrect && styles.choiceCorrect,
                    showWrong && styles.choiceWrong,
                    pressed && { opacity: 0.8 },
                  ]}
                  onPress={() => onSelect(i)}
                >
                  <Text style={[styles.choiceText, (showCorrect || showWrong) && styles.choiceTextSelected]}>
                    {c.zh}
                  </Text>
                  {showCorrect && <MaterialIcons name="check-circle" size={20} color={THEME.colors.semantic.success} />}
                  {showWrong && <MaterialIcons name="cancel" size={20} color={THEME.colors.semantic.error} />}
                </Pressable>
              );
            })}
          </View>
          <View style={styles.actions}>
            <Button
              variant="secondary"
              size="md"
              onPress={speakAgain}
              icon={<MaterialIcons name="volume-up" size={18} color={THEME.colors.gray[900]} />}
            >
              {t('review.hearAgain')}
            </Button>
            <Button
              variant="primary"
              size="md"
              onPress={nextQuiz}
              disabled={selected == null}
              icon={<MaterialIcons name="arrow-forward" size={18} color="#fff" />}
              iconPosition="right"
            >
              {t('review.next')}
            </Button>
            <Button
              variant="destructive"
              size="md"
              onPress={onRemoveReviewTag}
              icon={<MaterialIcons name="delete" size={18} color="#fff" />}
            >
              移除
            </Button>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.surfaceAlt,
  },
  header: {
    paddingHorizontal: THEME.spacing.lg,
    paddingTop: THEME.spacing.lg,
    paddingBottom: THEME.spacing.lg,
    backgroundColor: THEME.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  title: {
    ...THEME.typography.h2,
    color: THEME.colors.gray[900],
    marginBottom: THEME.spacing.sm,
  },
  stats: {
    ...THEME.typography.bodySmall,
    color: THEME.colors.gray[500],
  },
  content: {
    flex: 1,
    padding: THEME.spacing.lg,
    justifyContent: 'center',
  },
  wordDisplay: {
    fontSize: 40,
    fontWeight: '700',
    color: THEME.colors.gray[900],
    textAlign: 'center',
    marginBottom: THEME.spacing.xl,
  },
  choicesWrap: {
    gap: THEME.spacing.md,
    marginBottom: THEME.spacing.xl,
  },
  choiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: THEME.spacing.lg,
    borderWidth: 2,
    borderColor: THEME.colors.border,
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.surface,
  },
  choicePicked: {
    borderColor: THEME.colors.primary,
    backgroundColor: THEME.colors.primaryLight,
  },
  choiceCorrect: {
    borderColor: THEME.colors.semantic.success,
    backgroundColor: THEME.colors.semantic.success + '15',
  },
  choiceWrong: {
    borderColor: THEME.colors.semantic.error,
    backgroundColor: THEME.colors.semantic.error + '15',
  },
  choiceText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: THEME.colors.gray[900],
  },
  choiceTextSelected: {
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    gap: THEME.spacing.md,
  },
  hint: {
    ...THEME.typography.body,
    color: THEME.colors.gray[500],
    textAlign: 'center',
    marginTop: THEME.spacing.lg,
  },
});
