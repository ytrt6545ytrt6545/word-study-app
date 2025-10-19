import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Keyboard, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Speech from 'expo-speech';
import { EXAM_TAG, Word, loadWords, toggleWordTag } from '@/utils/storage';
import { getSpeechOptions } from '@/utils/tts';
import { useRouter } from 'expo-router';

function shuffle<T>(arr: T[]): T[] {
  return arr.map((v) => [Math.random(), v] as const).sort((a, b) => a[0] - b[0]).map(([, v]) => v);
}

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export default function WordExam() {
  const router = useRouter();
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

  const renderTypedWithDiff = (answer: string, typed: string) => {
    const a = (answer || '').trim();
    const t = (typed || '').trim();
    const len = Math.max(a.length, t.length);
    const nodes: JSX.Element[] = [];
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
        <Text style={styles.title}>\u8f09\u5165\u4e2d\u002e\u002e\u002e</Text>
      </View>
    );
  }

  if (candidates.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>\u6c92\u6709\u8003\u8a66\u7bc4\u570d\u7684\u55ae\u5b57</Text>
        <Text style={styles.hint}>\u8acb\u56de\u5230\u300c\u6a19\u7c64\u300d\u9801\uff0c\u5c07\u9700\u8981\u8003\u8a66\u7684\u55ae\u5b57\u52a0\u5165\u0020{EXAM_TAG}\u0020\u6a19\u7c64</Text>
        <View style={{ height: 12 }} />
        <Button title="\u8fd4\u56de" onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {current && (
        <>
          <Text style={styles.title}>\u55ae\u5b57\u8003\u8a66</Text>
          <Text style={styles.progress}>\u7b2c\u0020{order.length > 0 ? (idx + 1) : 0}\u0020\u984c\uff0f\u5171\u0020{order.length}\u0020\u984c</Text>
          <View style={styles.zhRow}>
            <Text style={styles.zh}>{(current.zh || '').trim() || '\uff08\u7121\u4e2d\u6587\u7ffb\u8b6f\uff09'}</Text>
            <View style={{ width: 8 }} />
            <Button title="\u6717\u8b80" onPress={speakWord} />
          </View>
          <View style={{ height: 12 }} />
          <TextInput
            ref={inputRef}
            value={input}
            onChangeText={onChange}
            onSubmitEditing={onSubmit}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="\u8f38\u5165\u82f1\u6587\u55ae\u5b57\uff0c\u6309\u0020\u0045\u006e\u0074\u0065\u0072\u0020\u78ba\u8a8d"
            style={styles.input}
          />
          <View style={{ height: 8 }} />
          <Button title="\u9001\u51fa" onPress={onSubmit} />
          <View style={{ height: 8 }} />
          <Button title="\u79fb\u9664\u8003\u8a66\u6a19\u7c64" onPress={onRemoveExamTag} />

          {input.trim().length > 0 && !normalizedEquals(input, current.en) && (
            <View style={{ marginTop: 12 }}>
              <Text style={styles.correctLine}>{current.en}</Text>
              {renderTypedWithDiff(current.en, input)}
            </View>
          )}

          {showCorrect && (
            <View style={styles.correctOverlay}>
              <Text style={styles.correctText}>\u7b54\u5c0d\u4e86\uff01</Text>
            </View>
          )}

          {showWrong && (
            <View style={styles.wrongOverlay}>
              <View style={styles.wrongCard}>
                <Text style={styles.wrongText}>\u5beb\u62fc\u932f\u4e86</Text>
                <View style={{ height: 16 }} />
                <Button
                  title="\u78ba\u8a8d"
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
