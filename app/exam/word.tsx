import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Button, Keyboard, ScrollView, StyleSheet, Text, TextInput, View, Pressable } from 'react-native';
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
        <View style={styles.emptyIllustration}>
          <Text style={styles.emptyIcon}>📚</Text>
        </View>
        <Text style={styles.emptyTitle}>{t('exam.word.empty.title')}</Text>
        <Text style={styles.emptyHint}>{t('exam.word.empty.hint', { tag: EXAM_TAG })}</Text>
        <View style={{ height: 24 }} />
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>{t('common.back')}</Text>
        </Pressable>
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
            <Pressable style={styles.speakButton} onPress={speakWord}>
              <Text style={styles.speakButtonText}>🔊 {t('exam.word.speak')}</Text>
            </Pressable>
          </View>
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
          <View style={styles.buttonRow}>
            <Pressable style={styles.primaryButton} onPress={onSubmit}>
              <Text style={styles.primaryButtonText}>{t('common.submit')}</Text>
            </Pressable>
          </View>
          <View style={styles.secondaryButtonRow}>
            <Pressable style={styles.secondaryButton} onPress={() => setShowHint(true)}>
              <Text style={styles.secondaryButtonText}>💡 {t('exam.word.hint')}</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={onRemoveExamTag}>
              <Text style={styles.secondaryButtonText}>✕ {t('exam.word.removeTag')}</Text>
            </Pressable>
          </View>

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
                <Text style={styles.wrongCardEmoji}>❌</Text>
                <Text style={styles.wrongText}>{t('exam.word.wrong')}</Text>
                <Text style={styles.wrongCardHint}>請重新檢查拼寫</Text>
                <Pressable
                  style={styles.wrongCardButton}
                  onPress={() => {
                    setShowWrong(false);
                    inputRef.current?.focus();
                  }}
                >
                  <Text style={styles.wrongCardButtonText}>{t('common.ok')}</Text>
                </Pressable>
              </View>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f5f7fa' },
  content: { padding: 20, paddingBottom: 64, backgroundColor: '#f5f7fa', flexGrow: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#f5f7fa' },
  title: { fontSize: 24, fontWeight: '700', color: '#1a1a1a' },
  progress: { marginTop: 8, color: '#666', fontSize: 14, fontWeight: '500' },
  zhRow: { marginTop: 16, flexDirection: 'row', alignItems: 'center' },
  zh: { fontSize: 22, fontWeight: '600', color: '#1a1a1a', flex: 1 },
  input: { marginTop: 16, alignSelf: 'stretch', borderWidth: 2, borderColor: '#ddd', borderRadius: 12, padding: 16, fontSize: 18, backgroundColor: '#fff', color: '#1a1a1a' },
  hintContainer: { marginTop: 16, padding: 16, backgroundColor: '#fff3cd', borderRadius: 12, borderLeftWidth: 4, borderLeftColor: '#ffc107' },
  hintLine: { fontSize: 20, fontWeight: '600', color: '#1a1a1a' },
  hintLetter: { color: '#1a1a1a' },
  hintStar: { color: '#e74c3c', fontSize: 20, fontWeight: '700' },
  correctOverlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: '#d4edda', alignItems: 'center', justifyContent: 'center' },
  correctText: { color: '#155724', fontSize: 32, fontWeight: 'bold' },
  emptyIcon: { fontSize: 80, marginBottom: 16 },
  emptyIllustration: { marginBottom: 16, alignItems: 'center' },
  emptyTitle: { fontSize: 24, fontWeight: '700', color: '#1a1a1a', marginBottom: 12, textAlign: 'center' },
  emptyHint: { color: '#666', marginBottom: 8, textAlign: 'center', fontSize: 16, lineHeight: 24 },
  hint: { color: '#666', marginTop: 8, textAlign: 'center', fontSize: 15 },
  wrongOverlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  wrongCard: { backgroundColor: '#fff', paddingVertical: 28, paddingHorizontal: 36, borderRadius: 20, alignItems: 'center', width: '90%', maxWidth: 340, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
  wrongText: { fontSize: 20, fontWeight: '700', color: '#e74c3c', marginBottom: 20 },
  backButton: { paddingHorizontal: 32, paddingVertical: 14, backgroundColor: '#0a7ea4', borderRadius: 12, alignItems: 'center', minWidth: 120 },
  backButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  speakButton: { paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#e8f4f8', borderRadius: 10, borderWidth: 2, borderColor: '#0a7ea4' },
  speakButtonText: { color: '#0a7ea4', fontSize: 14, fontWeight: '600' },
  buttonRow: { marginTop: 20, alignSelf: 'stretch' },
  primaryButton: { paddingVertical: 16, backgroundColor: '#4CAF50', borderRadius: 12, alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4 },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondaryButtonRow: { marginTop: 12, flexDirection: 'row', gap: 12 },
  secondaryButton: { flex: 1, paddingVertical: 14, backgroundColor: '#f0f0f0', borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#ddd' },
  secondaryButtonText: { color: '#555', fontSize: 14, fontWeight: '600' },
  wrongCardEmoji: { fontSize: 48, marginBottom: 12 },
  wrongCardHint: { fontSize: 14, color: '#999', marginTop: 8 },
  wrongCardButton: { paddingHorizontal: 20, paddingVertical: 12, backgroundColor: '#0a7ea4', borderRadius: 10, marginTop: 16, minWidth: 100, alignItems: 'center' },
  wrongCardButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
