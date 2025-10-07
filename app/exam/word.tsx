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
  const [loading, setLoading] = useState(true);

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
    setIdx((n) => (n + 1 < order.length ? n + 1 : 0)); // loop
  }, [order.length]);

  useEffect(() => {
    if (!current) return;
    setInput('');
    setShowCorrect(false);
  }, [current?.en]);

  const normalizedEquals = (a: string, b: string) => (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();

  const onChange = (text: string) => {
    setInput(text);
    setShowCorrect(false);
  };

  const onSubmit = async () => {
    if (!current) return;
    Keyboard.dismiss();
    if (normalizedEquals(input, current.en)) {
      setShowCorrect(true);
      await advance();
    }
  };

  const onRemoveExamTag = useCallback(async () => {
    const w = current;
    if (!w) return;
    try {
      await toggleWordTag(w.en, EXAM_TAG, false);
      const latest = await loadWords();
      setAllWords(latest);
      // rebuild order to avoid index mismatch
      const nextCandidates = latest.filter((it) => (it.tags || []).includes(EXAM_TAG));
      const indices = nextCandidates.map((_, i) => i);
      setOrder(shuffle(indices));
      setIdx((n) => 0);
      setInput('');
      setShowCorrect(false);
    } catch {}
  }, [current]);

  const renderTypedWithDiff = (answer: string, typed: string) => {
    const a = (answer || '').trim();
    const t = (typed || '').trim();
    const len = Math.max(a.length, t.length);
    const nodes: any[] = [];
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
      <View style={styles.container}> 
        <Text style={styles.title}>載入中...</Text>
      </View>
    );
  }

  if (candidates.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>沒有考試範圍的單字</Text>
        <Text style={styles.hint}>請先到「標籤」頁，將單字加入「{EXAM_TAG}」</Text>
        <View style={{ height: 12 }} />
        <Button title="回上頁" onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      {current && (
        <>
          <Text style={styles.title}>單字考試</Text>
          <Text style={styles.progress}>第 {order.length > 0 ? (idx + 1) : 0} 題／共 {order.length} 題</Text>
          <View style={styles.zhRow}>
            <Text style={styles.zh}>{(current.zh || '').trim() || '（無中文翻譯）'}</Text>
            <View style={{ width: 8 }} />
            <Button title="朗讀" onPress={speakWord} />
          </View>
          <View style={{ height: 12 }} />
          <TextInput
            value={input}
            onChangeText={onChange}
            onSubmitEditing={onSubmit}
            autoCapitalize='none'
            autoCorrect={false}
            placeholder="輸入英文單字，按 Enter 確認"
            style={styles.input}
          />
          <View style={{ height: 8 }} />
          <Button title="送出" onPress={onSubmit} />
          <View style={{ height: 8 }} />
          <Button title="移除考試標籤" onPress={onRemoveExamTag} />

          {input.trim().length > 0 && !normalizedEquals(input, current.en) && (
            <View style={{ marginTop: 12 }}>
              <Text style={styles.correctLine}>{current.en}</Text>
              {renderTypedWithDiff(current.en, input)}
            </View>
          )}

          {showCorrect && (
            <View style={styles.correctOverlay}>
              <Text style={styles.correctText}>答對了！</Text>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
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
  hint: { color: '#666', marginTop: 6 },
});
