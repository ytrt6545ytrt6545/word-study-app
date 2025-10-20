import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, Pressable, StyleSheet, Text, View, Platform } from "react-native";
import * as Speech from "expo-speech";
import { useLocalSearchParams, useRouter } from "expo-router";
import { REVIEW_TAG, bumpReview, loadWords, toggleWordTag, Word, srsAnswer, getDailyStats, bumpDailyStats, getSrsLimits } from "@/utils/storage";
import { getSpeechOptions } from "@/utils/tts";
import { useI18n } from "@/i18n";

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
  const params = useLocalSearchParams<{ tag?: string | string[]; mode?: string | string[] }>();
  const tagParam = (Array.isArray(params.tag) ? params.tag[0] : params.tag || "").toString();
  const modeParam = (Array.isArray(params.mode) ? params.mode[0] : params.mode || "").toString();
  const isLoopMode = modeParam === 'tag-loop' || modeParam === 'loop';
  const { t } = useI18n();

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
      Alert.alert("\u9078\u9805\u4e0d\u8db3", "\u76ee\u524d\u6c92\u6709\u8db3\u5920\u7684\u5e72\u64fe\u9078\u9805\uff0c\u5efa\u8b70\u65b0\u589e\u66f4\u591a\u55ae\u5b57\u6216\u6a19\u7c64\u3002");
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
        advanceToNext();
      } catch (err: any) {
        Alert.alert('移除失敗', err?.message || '請稍後再試');
      }
    };

    if (Platform.OS === 'web') {
      // 在 Web 上直接執行，避免 Alert 確認造成使用者感覺「沒有動作」
      doRemove();
      return;
    }

    Alert.alert(
      targetTag === REVIEW_TAG ? '移出複習' : '移出標籤',
      targetTag === REVIEW_TAG
        ? `確定要將 ${current.en} 從複習清單移除嗎？`
        : `確定要將 ${current.en} 從標籤「${targetTag}」移除嗎？`,
      [
        { text: "\u53d6\u6d88", style: 'cancel' },
        { text: "\u79fb\u9664", style: 'destructive', onPress: doRemove },
      ],
    );
  }, [quiz, advanceToNext, tagParam]);

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
      Alert.alert(
        t('review.loop.done.title'),
        t('review.loop.done.message'),
        [
          { text: t('review.loop.again'), onPress: () => { finishedRef.current = false; setFinished(false); setSelected(null); setQuiz(null); refillQueue(); } },
          { text: t('review.loop.finish'), style: 'cancel', onPress: () => { setTimeout(() => { try { router.back(); } catch {} }, 3000); } },
        ]
      );
      return;
    }
    Alert.alert('完成', '複習完成，將於 3 秒後返回上一頁');
    const timer = setTimeout(() => {
      try { router.back(); } catch {}
    }, 3000);
    return () => clearTimeout(timer);
  }, [finished, router, isLoopMode, refillQueue, t]);

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{"\u8f09\u5165\u4e2d..."}</Text>
      </View>
    );
  }

  if (finished) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{"\u8907\u7fd2\u5b8c\u6210"}</Text>
        <Text style={styles.hint}>{"\u5c07\u65bc 3 \u79d2\u5f8c\u8fd4\u56de\u4e0a\u4e00\u9801"}</Text>
      </View>
    );
  }

  if (candidates.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{"\u6c92\u6709\u53ef\u8907\u7fd2\u7684\u55ae\u5b57"}</Text>
        <Text style={styles.hint}>{`\u8acb\u5728\u55ae\u5b57\u8a73\u60c5\u52a0\u5165\u300c${REVIEW_TAG}\u300d\u6a19\u7c64`}</Text>
        <View style={{ height: 10 }} />
        <Button title={"\u56de\u4e0a\u4e00\u9801"} onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('review.title')}</Text>
      {!isLoopMode && (
        <Text style={styles.hint}>{`到期：${dueCount}｜新卡可選：${Math.min(newPool, newRemain)}（今日 新卡 ${stats.newUsed}/${limits.dailyNewLimit}，複習 ${stats.reviewUsed}/${limits.dailyReviewLimit}）`}</Text>
      )}
      {quiz && (
        <>
          <Text style={styles.en}>{quiz.en}</Text>
          <View style={{ height: 10 }} />
          <View style={styles.choicesWrap}>
            {quiz.choices.map((c, i) => {
              const picked = selected === i;
              const showCorrect = selected != null && c.correct;
              const showWrong = selected != null && picked && !c.correct;
              return (
                <Pressable key={i} style={[styles.choiceBtn, picked && styles.choicePicked]} onPress={() => onSelect(i)}>
                  <Text style={styles.choiceText}>{c.zh}</Text>
                  {showCorrect && <Text style={styles.markCorrect}>{"\u2713"}</Text>}
                  {showWrong && <Text style={styles.markWrong}>{"\u2717"}</Text>}
                </Pressable>
              );
            })}
          </View>
          <View style={styles.row}>
            <Button title={t('review.hearAgain')} onPress={speakAgain} />
            <View style={{ width: 8 }} />
            <Button title={t('review.next')} onPress={nextQuiz} disabled={selected == null} />
            <View style={{ width: 8 }} />
            <Button title={tagParam ? `太熟了，移除標籤（${tagParam}）` : t('review.removeReviewTag')} onPress={onRemoveReviewTag} />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: 'bold' },
  hint: { color: '#666', marginTop: 6 },
  en: { marginTop: 16, fontSize: 28, fontWeight: 'bold', textAlign: 'center' },
  choicesWrap: { marginTop: 16, gap: 10 },
  choiceBtn: { position: 'relative', padding: 14, borderWidth: 1, borderColor: '#bbb', borderRadius: 10, backgroundColor: '#f7f9fc' },
  choicePicked: { borderColor: '#1976d2' },
  choiceText: { fontSize: 18 },
  markCorrect: { position: 'absolute', right: 10, top: 10, color: '#2e7d32', fontSize: 20, fontWeight: 'bold' },
  markWrong: { position: 'absolute', right: 10, top: 10, color: '#c62828', fontSize: 20, fontWeight: 'bold' },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: 16 },
});
