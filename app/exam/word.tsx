import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Button, Keyboard, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Speech from 'expo-speech';
import { EXAM_TAG, Word, loadWords, toggleWordTag } from '@/utils/storage';
import { getSpeechOptions } from '@/utils/tts';
import { useRouter } from 'expo-router';
import { useI18n } from '@/i18n';

// 單字測驗頁：以 EXAM 標籤篩選測驗清單，提供朗讀、輸入檢查與加入複習標籤的操作流程。
// 資料來源來自 `loadWords`，答題後可透過 `toggleWordTag` 調整複習標籤，並讓設定頁顯示的每日限制發揮作用。

function shuffle<T>(arr: T[]): T[] {
  return arr.map((v) => [Math.random(), v] as const).sort((a, b) => a[0] - b[0]).map(([, v]) => v);
}

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// 畫面維護題庫順序、計算答題回饋與導向下一題，並處理鍵盤/朗讀的互動細節。
// 透過 `order` 陣列控制題目隨機順序，並在每題結束後調整狀態以便再次朗讀或切換題目。
export default function WordExam() {
  const router = useRouter();
  const { t } = useI18n();
  const [allWords, setAllWords] = useState<Word[]>([]);
  const [order, setOrder] = useState<number[]>([]);
  const [idx, setIdx] = useState(0);
  const [input, setInput] = useState('');
  const [showCorrect, setShowCorrect] = useState(false);
  const [showWrong, setShowWrong] = useState(false);
  const [showHint, setShowHint] = useState(false);
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
      setShowHint(false);
    }
  }, [candidates]);

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
    setShowHint(false);
    setIdx((n) => (n + 1 < order.length ? n + 1 : 0));
  }, [order.length]);

  useEffect(() => {
    if (!current) return;
    setInput('');
    setShowCorrect(false);
    setShowWrong(false);
    setShowHint(false);
  }, [current]);

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
      setShowHint(false);
    } catch {}
  }, [current]);

  // 將單字轉成提示格式：保留首字與末兩字，其餘以紅色星號呈現。
  const renderHintPreview = (answer: string): ReactNode => {
    const trimmed = (answer || '').trim();
    if (!trimmed) return null;
    const first = trimmed.slice(0, 1);
    const tailCount = Math.min(2, Math.max(trimmed.length - 1, 0));
    const tail = tailCount > 0 ? trimmed.slice(trimmed.length - tailCount) : '';
    const middleCount = Math.max(trimmed.length - (1 + tailCount), 0);
    return (
      <Text style={styles.hintLine}>
        <Text style={styles.hintLetter}>{first}</Text>
        {Array.from({ length: middleCount }).map((_, i) => (
          <Text key={`hint-star-${i}`} style={styles.hintStar}>*</Text>
        ))}
        <Text style={styles.hintLetter}>{tail}</Text>
      </Text>
    );
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
          <Button title={t('exam.word.hint')} onPress={() => setShowHint(true)} />
          <View style={{ height: 8 }} />
          <Button title={t('exam.word.removeTag')} onPress={onRemoveExamTag} />

          {showHint && (
            <View style={styles.hintContainer}>
              {renderHintPreview(current.en)}
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
  hintContainer: { marginTop: 12 },
  hintLine: { fontSize: 20, fontWeight: '600' },
  hintLetter: { color: '#000' },
  hintStar: { color: '#c62828', fontSize: 20, fontWeight: '700' },
  correctOverlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: '#a5d6a7', alignItems: 'center', justifyContent: 'center' },
  correctText: { color: '#1b5e20', fontSize: 28, fontWeight: 'bold' },
  hint: { color: '#666', marginTop: 6, textAlign: 'center' },
  wrongOverlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  wrongCard: { backgroundColor: '#fff', paddingVertical: 24, paddingHorizontal: 32, borderRadius: 16, alignItems: 'center', width: '80%', maxWidth: 320, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 6 },
  wrongText: { fontSize: 22, fontWeight: '700', color: '#c62828' },
});
