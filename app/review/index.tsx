import { useEffect, useMemo, useRef, useState } from "react";
import { Button, StyleSheet, Text, View, Pressable } from "react-native";
import * as Speech from "expo-speech";
import { useRouter } from "expo-router";
import { REVIEW_TAG, bumpReview, loadWords, toggleWordTag, Word, srsAnswer, getDailyStats, bumpDailyStats, getSrsLimits } from "@/utils/storage";
import { getSpeechOptions } from "@/utils/tts";

type QuizChoice = { zh: string; correct: boolean };
type Quiz = { word: Word; en: string; choices: QuizChoice[] };

function shuffle<T>(arr: T[]): T[] { return arr.map((v) => [Math.random(), v] as const).sort((a, b) => a[0] - b[0]).map(([, v]) => v); }

export default function ReviewScreen() {
  const router = useRouter();
  const [allWords, setAllWords] = useState<Word[]>([]);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [limits, setLimits] = useState<{ dailyNewLimit: number; dailyReviewLimit: number }>({ dailyNewLimit: 10, dailyReviewLimit: 100 });
  const [stats, setStats] = useState<{ newUsed: number; reviewUsed: number }>({ newUsed: 0, reviewUsed: 0 });
  const speakingRef = useRef(false);
  const queueRef = useRef<Word[]>([]);
  const statsRef = useRef<{ newUsed: number; reviewUsed: number }>({ newUsed: 0, reviewUsed: 0 });

  const candidates = useMemo(() => allWords.filter(w => (w.tags || []).includes(REVIEW_TAG)), [allWords]);

  useEffect(() => { (async () => {
    setAllWords(await loadWords());
    const s = await getDailyStats();
    statsRef.current = { newUsed: s.newUsed, reviewUsed: s.reviewUsed };
    setStats(statsRef.current);
    setLimits(await getSrsLimits());
    setLoading(false);
  })(); }, []);

  useEffect(() => {
    if (!quiz) return;
    (async () => {
      try {
        speakingRef.current = true;
        try { Speech.stop(); } catch {}
        await bumpReview(quiz.en);
        const opts = await getSpeechOptions('en-US');
        Speech.speak(quiz.en, { language: 'en-US', voice: opts.voice, rate: opts.rate, pitch: opts.pitch });
        setTimeout(() => {
          try { Speech.speak(quiz.en, { language: 'en-US', voice: opts.voice, rate: opts.rate, pitch: opts.pitch }); } catch {}
        }, 600);
      } finally {
        speakingRef.current = false;
        setAllWords(await loadWords());
      }
    })();
  }, [quiz?.en]);

  const speakAgain = async () => {
    if (!quiz) return;
    try { Speech.stop(); } catch {}
    const opts = await getSpeechOptions('en-US');
    Speech.speak(quiz.en, { language: 'en-US', voice: opts.voice, rate: opts.rate, pitch: opts.pitch });
    setTimeout(() => { try { Speech.speak(quiz.en, { language: 'en-US', voice: opts.voice, rate: opts.rate, pitch: opts.pitch }); } catch {} }, 600);
  };

  const refillQueue = () => {
    const now = Date.now();
    const due = candidates.filter(w => w.srsDue && Date.parse(w.srsDue) <= now);
    const notDue = candidates.filter(w => !(w.srsDue && Date.parse(w.srsDue) <= now));
    const newOnes = notDue.filter(w => (w.srsReps || 0) === 0);
    const newAllow = Math.max(0, (limits.dailyNewLimit || 0) - statsRef.current.newUsed);
    const reviewAllow = Math.max(0, (limits.dailyReviewLimit || 0) - statsRef.current.reviewUsed);
    const takeNew = shuffle(newOnes).slice(0, newAllow);
    const dueTake = shuffle(due).slice(0, reviewAllow);
    queueRef.current = [...dueTake, ...takeNew];
  };

  const buildQuizFromWord = (correct: Word) => {
    const tags = new Set((correct.tags || []).filter(Boolean));
    const byTag = allWords.filter(w => w.en !== correct.en && (w.zh || '').trim() !== (correct.zh || '').trim() && (w.tags || []).some(t => tags.has(t)));
    const others = allWords.filter(w => w.en !== correct.en && (w.zh || '').trim() !== (correct.zh || '').trim());
    const source = byTag.length >= 2 ? byTag : others;
    const distractors = shuffle(source).slice(0, 2);
    const choices: QuizChoice[] = shuffle([{ zh: correct.zh, correct: true }, ...distractors.map(w => ({ zh: w.zh, correct: false }))]);
    while (choices.length < 3) {
      const fallback = allWords.find(w => w.en !== correct.en && !choices.some(c => c.zh === w.zh));
      if (!fallback) break; else choices.push({ zh: fallback.zh, correct: false });
    }
    setQuiz({ word: correct, en: correct.en, choices: shuffle(choices).slice(0, 3) });
  };

  const nextQuiz = () => {
    setSelected(null);
    if (queueRef.current.length === 0) refillQueue();
    const next = queueRef.current.shift();
    if (!next) { setQuiz(null); return; }
    buildQuizFromWord(next);
  };

  useEffect(() => { if (!loading) nextQuiz(); }, [loading, candidates.length, limits.dailyNewLimit, limits.dailyReviewLimit]);

  const onSelect = async (idx: number) => {
    if (selected != null || !quiz) return;
    setSelected(idx);
    const picked = quiz.choices[idx];
    const isCorrect = !!picked?.correct;
    await srsAnswer(quiz.en, isCorrect);
    const isNew = (quiz.word.srsReps || 0) === 0; // before update
    if (isNew) { statsRef.current.newUsed += 1; const s = await bumpDailyStats({ newUsed: 1 }); setStats({ newUsed: s.newUsed, reviewUsed: s.reviewUsed }); }
    else { statsRef.current.reviewUsed += 1; const s = await bumpDailyStats({ reviewUsed: 1 }); setStats({ newUsed: s.newUsed, reviewUsed: s.reviewUsed }); }
    if (!isCorrect) { queueRef.current.push(quiz.word); }
  };

  const onRemoveReviewTag = async () => {
    if (!quiz) return;
    await toggleWordTag(quiz.en, REVIEW_TAG, false);
    setAllWords(await loadWords());
    nextQuiz();
  };

  const now = Date.now();
  const dueCount = candidates.filter(w => w.srsDue && Date.parse(w.srsDue) <= now).length;
  const newPool = candidates.filter(w => !(w.srsDue && Date.parse(w.srsDue) <= now)).filter(w => (w.srsReps || 0) === 0).length;
  const newRemain = Math.max(0, (limits.dailyNewLimit || 0) - stats.newUsed);
  const reviewRemain = Math.max(0, (limits.dailyReviewLimit || 0) - stats.reviewUsed);

  if (loading) return <View style={styles.container}><Text style={styles.title}>載入中…</Text></View>;
  if (candidates.length === 0) return (
    <View style={styles.container}>
      <Text style={styles.title}>沒有待複習的單字</Text>
      <Text style={styles.hint}>請在單字詳情加入「{REVIEW_TAG}」標籤</Text>
      <View style={{ height: 10 }} />
      <Button title="回上一頁" onPress={() => router.back()} />
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>複習</Text>
      <Text style={styles.hint}>{`到期：${dueCount}｜新卡可選：${Math.min(newPool, newRemain)}（今日 新卡 ${stats.newUsed}/${limits.dailyNewLimit}，複習 ${stats.reviewUsed}/${limits.dailyReviewLimit}）`}</Text>
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
                  {showCorrect && <Text style={styles.markCorrect}>✓</Text>}
                  {showWrong && <Text style={styles.markWrong}>✕</Text>}
                </Pressable>
              );
            })}
          </View>
          <View style={styles.row}>
            <Button title="再聽一次" onPress={speakAgain} />
            <View style={{ width: 8 }} />
            <Button title="下一題" onPress={nextQuiz} disabled={selected == null} />
            <View style={{ width: 8 }} />
            <Button title="太熟了，移除複習標籤" onPress={onRemoveReviewTag} />
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

