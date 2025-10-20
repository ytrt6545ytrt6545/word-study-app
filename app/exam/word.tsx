import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Button, Keyboard, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Speech from 'expo-speech';
import { EXAM_TAG, Word, loadWords, toggleWordTag } from '@/utils/storage';
import { getSpeechOptions } from '@/utils/tts';
import { useRouter } from 'expo-router';
import { useI18n } from '@/i18n';

function shuffle<T>(arr: T[]): T[] {
  return arr.map((v) => [Math.random(), v] as const).sort((a, b) => a[0] - b[0]).map(([, v]) => v);
}

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export default function WordExam() {
  const router = useRouter();
  const { t } = useI18n();
  const [allWords, setAllWords] = useState<Word[]>([]);
  const [order, setOrder] = useState<number[]>([]);
  const [idx, setIdx] = useState(0);
  const [input, setInput] = useState('');
  const [showCorrect, setShowCorrect] = useState(false);
  const [showWrong, setShowWrong] = useState(false);
  const [loading, setLoading] = useState(true);
  const inputRef = useRef<TextInput>(null);

  const candidates = useMemo(() => allWords.filter((w) => (w.tags || []).includes(EXAM_TAG)), [allWords]);

  const current = useMemo(() => {
    if (order.length === 0 || idx < 0 || idx >= order.length) return null;
    return candidates[order[idx]] || null;
  }, [order, idx, candidates]);

  useEffect(() => {
    (async () => {
      const words = await loadWords();
      setAllWords(words);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (candidates.length > 0) {
      const indices = candidates.map((_, i) => i);
      setOrder(shuffle(indices));
      setIdx(0);
      setInput('');
      setShowCorrect(false);
      setShowWrong(false);
    }
  }, [candidates.length]);

  const speakWord = useCallback(async () => {
    const w = current;
    if (!w) return;
    try {
      const opts = await getSpeechOptions('en-US');
      Speech.stop();
      Speech.speak((w.en || '').trim(), { language: 'en-US', voice: opts.voice, rate: opts.rate, pitch: opts.pitch });
    } catch {}
  }, [current]);

  const advance = useCallback(async () => {
    await delay(1000);
    setInput('');
    setShowCorrect(false);
    setIdx((n) => (n + 1 < order.length ? n + 1 : 0));
  }, [order.length]);

  useEffect(() => {
    if (!current) return;
    setInput('');
    setShowCorrect(false);
    setShowWrong(false);
  }, [current?.en]);

  const normalizedEquals = (a: string, b: string) => (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();

  const onChange = (text: string) => {
    setInput(text);
    setShowCorrect(false);
    if (showWrong) setShowWrong(false);
  };

  const onSubmit = async () => {
    if (!current) return;
    Keyboard.dismiss();
    if (normalizedEquals(input, current.en)) {
      setShowCorrect(true);
      setShowWrong(false);
      await advance();
      return;
    }
    setShowWrong(true);
  };

  const onRemoveExamTag = useCallback(async () => {
    const w = current;
    if (!w) return;
    try {
      await toggleWordTag(w.en, EXAM_TAG, false);
      const latest = await loadWords();
      setAllWords(latest);
      const nextCandidates = latest.filter((it) => (it.tags || []).includes(EXAM_TAG));
      const indices = nextCandidates.map((_, i) => i);
      setOrder(shuffle(indices));
      setIdx(0);
      setInput('');
      setShowCorrect(false);
      setShowWrong(false);
    } catch {}
  }, [current]);

  // 將使用者輸入與正解逐字比對，產生彩色差異標記供畫面顯示。
  const renderTypedWithDiff = (answer: string, typed: string) => {
    const a = (answer || '').trim();
    const t = (typed || '').trim();
    const len = Math.max(a.length, t.length);
    const nodes: ReactNode[] = [];
    for (let i = 0; i < len; i++) {
      const ch = t[i] || '';
      const ok = (a[i] || '').toLowerCase() === (ch || '').toLowerCase();
      nodes.push(
        <Text key={i} style={ok ? styles.typedOk : styles.typedWrong}>{ch || ''}</Text>
      );
    }
    return <Text style={styles.typedLine}>{nodes}</Text>;
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>{t('common.loading')}</Text>
      </View>
    );
  }

  if (candidates.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>{t('exam.word.empty.title')}</Text>
        <Text style={styles.hint}>{t('exam.word.empty.hint', { tag: EXAM_TAG })}</Text>
        <View style={{ height: 12 }} />
        <Button title={t('common.back')} onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {current && (
        <>
          <Text style={styles.title}>{t('exam.word.title')}</Text>
          <Text style={styles.progress}>
            {t('exam.word.progress', { index: order.length > 0 ? (idx + 1) : 0, total: order.length })}
          </Text>
          <View style={styles.zhRow}>
            <Text style={styles.zh}>{(current.zh || '').trim() || t('exam.word.noChinese')}</Text>
            <View style={{ width: 8 }} />
            <Button title={t('exam.word.speak')} onPress={speakWord} />
          </View>
          <View style={{ height: 12 }} />
          <TextInput
            ref={inputRef}
            value={input}
            onChangeText={onChange}
            onSubmitEditing={onSubmit}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder={t('exam.word.input.placeholder')}
            style={styles.input}
          />
          <View style={{ height: 8 }} />
          <Button title={t('common.submit')} onPress={onSubmit} />
          <View style={{ height: 8 }} />
          <Button title={t('exam.word.removeTag')} onPress={onRemoveExamTag} />

          {input.trim().length > 0 && !normalizedEquals(input, current.en) && (
            <View style={{ marginTop: 12 }}>
              <Text style={styles.correctLine}>{current.en}</Text>
              {renderTypedWithDiff(current.en, input)}
            </View>
          )}

          {showCorrect && (
            <View style={styles.correctOverlay}>
              <Text style={styles.correctText}>{t('exam.word.correct')}</Text>
            </View>
          )}

          {showWrong && (
            <View style={styles.wrongOverlay}>
              <View style={styles.wrongCard}>
                <Text style={styles.wrongText}>{t('exam.word.wrong')}</Text>
                <View style={{ height: 16 }} />
                <Button
                  title={t('common.ok')}
                  onPress={() => {
                    setShowWrong(false);
                    inputRef.current?.focus();
                  }}
                />
              </View>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 24, paddingBottom: 64, backgroundColor: '#fff', flexGrow: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: 'bold' },
  progress: { marginTop: 6, color: '#555' },
  zhRow: { marginTop: 12, flexDirection: 'row', alignItems: 'center' },
  zh: { fontSize: 20 },
  input: { marginTop: 12, alignSelf: 'stretch', borderWidth: 1, borderColor: '#bbb', borderRadius: 8, padding: 12, fontSize: 18, backgroundColor: '#f9fafb' },
  correctLine: { color: '#2e7d32', fontSize: 18, fontWeight: '600' },
  typedLine: { marginTop: 4, fontSize: 18 },
  typedOk: { color: '#000' },
  typedWrong: { color: '#c62828', fontWeight: 'bold' },
  correctOverlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: '#a5d6a7', alignItems: 'center', justifyContent: 'center' },
  correctText: { color: '#1b5e20', fontSize: 28, fontWeight: 'bold' },
  hint: { color: '#666', marginTop: 6, textAlign: 'center' },
  wrongOverlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  wrongCard: { backgroundColor: '#fff', paddingVertical: 24, paddingHorizontal: 32, borderRadius: 16, alignItems: 'center', width: '80%', maxWidth: 320, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 6 },
  wrongText: { fontSize: 22, fontWeight: '700', color: '#c62828' },
});
