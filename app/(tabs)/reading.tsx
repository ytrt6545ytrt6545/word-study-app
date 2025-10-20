
import * as DocumentPicker from 'expo-document-picker';
import * as Speech from 'expo-speech';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Keyboard, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';

import { useI18n } from '@/i18n';
import { aiCompleteWord, AIFillResult } from '@/utils/ai';
import { loadTags, loadWords, REVIEW_TAG, saveWords, Word } from '@/utils/storage';
import { getSpeechOptions, loadPauseConfig } from '@/utils/tts';

type Token = { key: string; text: string; isWord: boolean };

const NETWORK_ERROR_RE = /Failed to fetch|Network request failed|NetworkError/i;

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  if (!text) return tokens;
  const wordRegex = /[A-Za-z][A-Za-z'-]*/g;
  let lastIndex = 0;
  let seq = 0;
  let match: RegExpExecArray | null;
  while ((match = wordRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ key: 'gap-' + seq++, text: text.slice(lastIndex, match.index), isWord: false });
    }
    tokens.push({ key: 'word-' + seq++, text: match[0], isWord: true });
    lastIndex = wordRegex.lastIndex;
  }
  if (lastIndex < text.length) {
    tokens.push({ key: 'gap-' + seq++, text: text.slice(lastIndex), isWord: false });
  }
  return tokens;
}

function normalizeWord(text: string): string {
  return text.replace(/[^A-Za-z']+/g, '').toLowerCase();
}

async function fetchPhonetic(word: string): Promise<string | null> {
  const target = word.trim().toLowerCase();
  if (!target) return null;
  const url = 'https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(target);
  const res = await fetch(url).catch((err: any) => {
    if (NETWORK_ERROR_RE.test(String(err?.message ?? err))) {
      throw new Error('Dictionary API unreachable. Please check your network and try again.');
    }
    throw err instanceof Error ? err : new Error(String(err));
  });
  if (!res.ok) {
    if (res.status === 404) return null;
    const detail = await res.text().catch(() => '');
    throw new Error('dictionary ' + res.status + (detail ? ': ' + detail : ''));
  }
  const json = await res.json();
  if (!Array.isArray(json) || json.length === 0) return null;
  const entry = json[0] ?? {};
  if (typeof entry.phonetic === 'string' && entry.phonetic) return entry.phonetic;
  if (Array.isArray(entry.phonetics)) {
    for (const item of entry.phonetics) {
      if (item && typeof item.text === 'string' && item.text) {
        return item.text;
      }
    }
  }
  return null;
}

type LookupState = {
  word: string;
  normalized: string;
  loading: boolean;
  phonetic?: string;
  phoneticError?: string;
  ai?: AIFillResult;
  aiError?: string;
  error?: string;
};

export default function ReadingScreen() {
  const { t } = useI18n();
  const [rawText, setRawText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [selectedWord, setSelectedWord] = useState<string>('');
  const [lookupState, setLookupState] = useState<LookupState | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "info" | "error"; text: string } | null>(null);
  const [availableTags, setAvailableTags] = useState<string[]>([REVIEW_TAG]);
  const [selectedTags, setSelectedTags] = useState<string[]>([REVIEW_TAG]);
  // Reading controls
  const [isReading, setIsReading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [readingIndex, setReadingIndex] = useState(0);
  const [readingEndIndex, setReadingEndIndex] = useState(0);
  const runnerRef = useRef<{ running: boolean; paused: boolean; index: number; words: string[] }>({ running: false, paused: false, index: 0, words: [] });

  useEffect(() => {
    (async () => {
      try {
        const tags = await loadTags();
        const unique = Array.from(new Set([...(tags || []), REVIEW_TAG]));
        setAvailableTags(unique);
        setSelectedTags((prev) => {
          const next = new Set(prev.length ? prev : []);
          next.add(REVIEW_TAG);
          return Array.from(next);
        });
      } catch {}
    })();
  }, []);

  // Blur any focused background input when modal opens (avoid aria-hidden focus issue)
  useEffect(() => {
    if (selectedKey) {
      try { Keyboard.dismiss(); } catch {}
      try {
        if (typeof document !== 'undefined' && document.activeElement && (document.activeElement as any).blur) {
          (document.activeElement as any).blur();
        }
      } catch {}
    }
  }, [selectedKey]);

  const tokens = useMemo(() => tokenize(rawText), [rawText]);
  const selectedTagsLabel = useMemo(() => selectedTags.join('、'), [selectedTags]);
  const readingMeta = useMemo(() => {
    const words: string[] = [];
    const sentenceEnds: boolean[] = [];
    const commaEnds: boolean[] = [];
    for (let i = 0; i < tokens.length; i++) {
      const tk = tokens[i];
      if (tk.isWord) {
        words.push(tk.text);
        // lookahead for punctuation in the following non-word token
        let isEnd = false;
        let isComma = false;
        const next = tokens[i + 1];
        if (next && !next.isWord) {
          const seg = next.text || '';
          if ((/[\.!?;:。！？；：]/).test(seg)) isEnd = true;     // 強停頓
          if ((/[，,]/).test(seg)) isComma = true;               // 逗號停頓
        }
        sentenceEnds.push(isEnd);
        commaEnds.push(isComma);
      }
    }
    return { words, sentenceEnds, commaEnds };
  }, [tokens]);

  useEffect(() => {
    // reset reading state when content changes
    runnerRef.current.words = readingMeta.words;
    runnerRef.current.index = 0;
    setReadingIndex(0);
    setReadingEndIndex(0);
    setIsReading(false);
    setIsPaused(false);
    try { Speech.stop(); } catch {}
  }, [readingMeta.words]);

  const toggleDefaultTag = useCallback((tag: string) => {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (tag === REVIEW_TAG) {
        next.add(REVIEW_TAG);
        return Array.from(next);
      }
      if (next.has(tag)) next.delete(tag); else next.add(tag);
      next.add(REVIEW_TAG);
      return Array.from(next);
    });
  }, []);

  const onPickFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: 'text/plain', multiple: false });
      // Expo SDK 53: result has `canceled` and `assets`
      if ((res as any).canceled) return;
      const file = (res as any).assets?.[0];
      if (!file) return;
      const textContent = await fetch(file.uri).then((r) => r.text());
      setRawText(textContent);
      setFileName(file.name || null);
      setSelectedKey(null);
      setSelectedWord('');
      setLookupState(null);
    } catch (err: any) {
      Alert.alert(t('reading.file.readFailed'), err?.message || t('common.tryLater'));
    }
  };

  const onSelectWord = (token: Token) => {
    const normalized = normalizeWord(token.text);
    if (!normalized) return;
    setSelectedKey(token.key);
    setSelectedWord(token.text);
  };

  useEffect(() => {
    if (!selectedWord) {
      setLookupState(null);
      setFeedback(null);
      return;
    }
    const normalized = normalizeWord(selectedWord);
    if (!normalized) {
      setLookupState(null);
      setFeedback(null);
      return;
    }
    let cancelled = false;
    setLookupState({ word: selectedWord, normalized, loading: true });
    setFeedback(null);
    (async () => {
      try {
        let phonetic: string | undefined;
        let phoneticError: string | undefined;
        let ai: AIFillResult | undefined;
        let aiError: string | undefined;
        try {
          ai = await aiCompleteWord({ en: normalized });
          if (ai?.phonetic) phonetic = ai.phonetic;
        } catch (err: any) {
          aiError = err?.message || 'AI error';
        }
        if (!phonetic) {
          try {
            const result = await fetchPhonetic(normalized);
            phonetic = result ?? undefined;
          } catch (err: any) {
            phoneticError = err?.message || 'dictionary error';
          }
        }
        if (cancelled) return;
        setLookupState({ word: selectedWord, normalized, loading: false, phonetic, phoneticError, ai, aiError });
      } catch (err: any) {
        if (cancelled) return;
        setLookupState({ word: selectedWord, normalized, loading: false, error: err?.message || 'lookup failed' });
      }
    })();
    return () => { cancelled = true; };
  }, [selectedWord]);

  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(null), 2200);
    return () => clearTimeout(timer);
  }, [feedback]);

  const buildWordPayload = (baseWord: string, incomingTags: string[]): Word => {
    const trimmed = (baseWord || '').trim();
    const translation = (lookupState?.ai?.zh || '').trim();
    const exampleEn = lookupState?.ai?.exampleEn || '';
    const exampleZh = lookupState?.ai?.exampleZh || '';
    const tagSet = new Set(incomingTags);
    tagSet.add(REVIEW_TAG);
    const tags = Array.from(tagSet);
    const nowIso = new Date().toISOString();
    return { en: trimmed, zh: translation, exampleEn, exampleZh, status: 'unknown', createdAt: nowIso, reviewCount: 0, tags };
  };

  const handleAddWord = async () => {
    if (!lookupState?.normalized) return;
    const payload = buildWordPayload(lookupState.normalized, selectedTags);
    try {
      const list = await loadWords();
      if (list.some((w) => w.en.toLowerCase() === payload.en.toLowerCase())) {
        setFeedback({ type: 'info', text: `${payload.en} 已在清單` });
        return;
      }
      const next = [...list, payload];
      await saveWords(next);
      setFeedback({ type: 'success', text: `${payload.en} 已加入清單` });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || '加入失敗，請稍後再試' });
    }
  };

  const speak = async (text: string) => {
    const phrase = (text || '').trim();
    if (!phrase) return;
    try { Speech.stop(); } catch {}
    const opts = await getSpeechOptions('en-US');
    Speech.speak(phrase, { language: 'en-US', voice: opts.voice, rate: opts.rate, pitch: opts.pitch });
  };

  // TTS helpers for reading flow
  const speakAsync = (text: string, options: Parameters<typeof Speech.speak>[1] = {}) =>
    new Promise<void>((resolve) => {
      try {
        Speech.speak(text, { ...(options || {}), onDone: resolve, onStopped: resolve, onError: () => resolve() });
      } catch {
        resolve();
      }
    });

  const runReading = useCallback(async () => {
    if (runnerRef.current.running) return;
    runnerRef.current.running = true;
    const optsCfg = await getSpeechOptions('en-US');
    const base = { language: 'en-US', voice: optsCfg.voice, rate: (optsCfg.rate || 1), pitch: optsCfg.pitch } as Parameters<typeof Speech.speak>[1];
    const SENTENCE_GAP = 220; // 句末停頓；句中連續讀
    const words = runnerRef.current.words;
    const ends = readingMeta.sentenceEnds;
    const commas = (readingMeta as any).commaEnds || [];
    while (runnerRef.current.index < words.length) {
      if (runnerRef.current.paused) {
        await new Promise((r) => setTimeout(r, 120));
        continue;
      }
      const start = runnerRef.current.index;
      setReadingIndex(start);
      // 片語：從當前到下一個標點，若無則至結尾
      let end = words.length;
      for (let j = start; j < words.length; j++) {
        if (ends[j] || commas[j]) { end = j + 1; break; }
      }
      setReadingEndIndex(end);
      const phrase = words.slice(start, end).join(' ');
      await speakAsync(phrase, base);
      if (runnerRef.current.paused) {
        // Do not advance index when paused; keep current index
        continue;
      }
      runnerRef.current.index = end;
      // 句末與逗號停頓
      // 句末與逗號停頓
      if (ends[end - 1]) await new Promise((r) => setTimeout(r, SENTENCE_GAP));
      else if (commas[end - 1]) await new Promise((r) => setTimeout(r, 120));
    }
    setIsReading(false);
    setIsPaused(false);
  }, [readingMeta.sentenceEnds]);

  const onStartReading = useCallback(async () => {
    if (readingMeta.words.length === 0) {
      Alert.alert('朗讀', '請先貼上或輸入文章內容');
      return;
    }
    try { Speech.stop(); } catch {}
    runnerRef.current.words = readingMeta.words;
    runnerRef.current.index = 0;
    runnerRef.current.paused = false;
    setReadingIndex(0);
    setReadingEndIndex(0);
    setIsReading(true);
    setIsPaused(false);
    runReading();
  }, [readingMeta.words, runReading]);

  const onPauseReading = useCallback(() => {
    if (!isReading || runnerRef.current.paused) return;
    runnerRef.current.paused = true;
    setIsPaused(true);
    try { Speech.stop(); } catch {}
  }, [isReading]);

  const onResumeReading = useCallback(() => {
    if (!isReading || !runnerRef.current.paused) return;
    runnerRef.current.paused = false;
    setIsPaused(false);
    runReading();
  }, [isReading, runReading]);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 20 }} keyboardShouldPersistTaps="handled">
        {!!fileName && <Text style={styles.fileName}>{t('reading.file.from', { name: fileName })}</Text>}
        <TextInput
          style={styles.textInput}
          placeholder={t('reading.placeholder.input')}
          value={rawText}
          onChangeText={setRawText}
          multiline
          textAlignVertical="top"
        />

        {/* Tag selector */}
        <View style={styles.tagSection}>
          <Pressable style={styles.tagHeader} onPress={() => {}}>
            <Text style={styles.tagHeaderText}>{t('reading.tags.header')}</Text>
            <Text style={styles.tagHeaderValue}>{selectedTags.length ? selectedTagsLabel : t('reading.tags.none')}</Text>
          </Pressable>
          <View style={styles.tagList}>
            {availableTags.map((tag) => {
              const isSelected = selectedTags.includes(tag);
              const isMandatory = tag === REVIEW_TAG;
              return (
                <TouchableOpacity key={tag} style={[styles.tagChip, isSelected && styles.tagChipSelected]} activeOpacity={0.7} onPress={() => toggleDefaultTag(tag)} disabled={isMandatory}>
                  <Text style={[styles.tagChipText, isSelected && styles.tagChipTextSelected, isMandatory && styles.tagChipTextDisabled]}>
                    {isMandatory ? `${tag}${t('reading.tags.mandatory')}` : tag}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.tagHint}>{t('reading.tags.hint')}</Text>
        </View>

        {tokens.length === 0 && rawText.trim() === '' && (
          <Text style={styles.placeholder}>{t('reading.placeholder.hint')}</Text>
        )}
        {tokens.length > 0 && (
          <View style={styles.articleSection}>
            <Text style={styles.sectionTitle}>{t('reading.section.article')}</Text>
            <View style={styles.articleBox}>
              <Text style={styles.articleText}>
                {(() => {
                  let wordIdx = 0;
                  return tokens.map((token) => {
                    if (token.isWord) {
                      const isActive = isReading && wordIdx >= readingIndex && wordIdx < readingEndIndex;
                      const node = (
                        <Text
                          key={token.key}
                          style={[styles.word, isActive && styles.wordActive]}
                          onPress={() => onSelectWord(token)}
                          suppressHighlighting>
                          {token.text}
                        </Text>
                      );
                      wordIdx++;
                      return node;
                    }
                    return <Text key={token.key} style={styles.nonWord}>{token.text}</Text>;
                  });
                })()}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Toolbar */}
      <View style={styles.toolbar}>
        <Button title={'朗讀'} onPress={onStartReading} disabled={isReading && !isPaused} />
        <View style={{ width: 8 }} />
        <Button title={'暫停'} onPress={onPauseReading} disabled={!isReading || isPaused} />
        <View style={{ width: 8 }} />
        <Button title={'繼續'} onPress={onResumeReading} disabled={!isReading || !isPaused} />
      </View>

      {/* Modal */}
      <Modal visible={!!selectedKey} animationType="slide" transparent onRequestClose={() => setSelectedKey(null)}>
        <View style={styles.modalContainer}>
          <TouchableWithoutFeedback onPress={() => setSelectedKey(null)}>
            <View style={styles.modalBackdrop} />
          </TouchableWithoutFeedback>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{selectedWord}</Text>
            {lookupState?.phonetic ? (<Text style={styles.modalPhonetic}>{lookupState.phonetic}</Text>) : null}
            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent}>
              {lookupState?.loading && (<Text style={styles.modalHint}>{t('reading.modal.lookupLoading')}</Text>)}
              {!lookupState?.loading && (
                <>
                  {lookupState?.ai && (
                    <View style={styles.modalSection}>
                      <Text style={styles.modalLabel}>{t('reading.modal.ai')}</Text>
                      {lookupState.ai.zh ? (<Text style={styles.modalText}>{lookupState.ai.zh}</Text>) : null}
                      {lookupState.ai.exampleEn ? (<Text style={styles.modalSub}>{lookupState.ai.exampleEn}</Text>) : null}
                      {lookupState.ai.exampleZh ? (<Text style={styles.modalSub}>{lookupState.ai.exampleZh}</Text>) : null}
                    </View>
                  )}
                  {lookupState?.phoneticError && (<Text style={styles.modalError}>{lookupState.phoneticError}</Text>)}
                  {lookupState?.aiError && (<Text style={styles.modalError}>{lookupState.aiError}</Text>)}
                  {lookupState && !lookupState.loading && !lookupState.ai && !lookupState.error && !lookupState.phoneticError && !lookupState.aiError && (
                    <Text style={styles.modalHint}>{t('reading.modal.noData')}</Text>
                  )}
                  {lookupState?.error && (<Text style={styles.modalError}>{lookupState.error}</Text>)}
                </>
              )}
            </ScrollView>
            <View style={styles.modalButtonsRow}>
              <Button title={t('reading.modal.addWord')} onPress={handleAddWord} disabled={lookupState?.loading} />
              <View style={{ width: 8 }} />
              <Button title={t('reading.modal.speak')} onPress={() => speak(selectedWord)} />
            </View>
            {feedback ? (
              <Text
                style={[
                  styles.modalFeedback,
                  feedback.type === 'success' && styles.modalFeedbackSuccess,
                  feedback.type === 'info' && styles.modalFeedbackInfo,
                  feedback.type === 'error' && styles.modalFeedbackError,
                ]}>
                {feedback.text}
              </Text>
            ) : null}
            <View style={styles.modalActions}>
              <Button title={t('reading.modal.close')} onPress={() => setSelectedKey(null)} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  textInput: { minHeight: 160, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, margin: 16, backgroundColor: '#fff', textAlignVertical: 'top' },
  fileName: { marginHorizontal: 16, marginTop: 12, color: '#666' },
  placeholder: { marginTop: 12, color: '#888', marginHorizontal: 16 },
  articleSection: { marginTop: 20, gap: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#333', marginHorizontal: 16 },
  articleBox: { marginTop: 8, marginHorizontal: 16, padding: 14, borderWidth: 1, borderColor: '#d0d7e2', borderRadius: 10, backgroundColor: '#f7f9fc' },
  articleText: { fontSize: 18, lineHeight: 28, color: '#222' },
  word: { color: '#0d47a1' },
  wordActive: { backgroundColor: '#ffecb3', borderRadius: 4 },
  nonWord: { color: '#222' },
  toolbar: { padding: 16, borderTopWidth: 1, borderColor: '#e0e0e0', flexDirection: 'row', gap: 12 },
  // tags
  tagSection: { marginHorizontal: 16, marginTop: 8, borderWidth: 1, borderColor: '#d0d7e2', borderRadius: 10, backgroundColor: '#f2f6ff' },
  tagHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10 },
  tagHeaderText: { fontSize: 14, fontWeight: '600', color: '#333' },
  tagHeaderValue: { fontSize: 13, color: '#555', flexShrink: 1, textAlign: 'right', marginLeft: 8 },
  tagList: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 14, paddingBottom: 10 },
  tagChip: { paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: '#c5d1e5', borderRadius: 14, marginRight: 8, marginTop: 6, backgroundColor: '#fff' },
  tagChipSelected: { backgroundColor: '#e3f2fd', borderColor: '#64b5f6' },
  tagChipText: { fontSize: 13, color: '#333' },
  tagChipTextSelected: { color: '#0d47a1' },
  tagChipTextDisabled: { color: '#777' },
  tagHint: { fontSize: 12, color: '#666', paddingHorizontal: 14, paddingBottom: 10 },
  // modal
  modalContainer: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  modalCard: { backgroundColor: '#fff', padding: 20, borderTopLeftRadius: 16, borderTopRightRadius: 16, gap: 12, maxHeight: '70%' },
  modalTitle: { fontSize: 22, fontWeight: 'bold', color: '#222' },
  modalPhonetic: { fontSize: 16, color: '#555' },
  modalScroll: { maxHeight: 260 },
  modalContent: { paddingBottom: 12, gap: 16 },
  modalSection: { gap: 6 },
  modalLabel: { fontSize: 14, fontWeight: '600', color: '#333' },
  modalText: { fontSize: 15, color: '#222' },
  modalSub: { fontSize: 14, color: '#555', marginTop: 2 },
  modalHint: { fontSize: 14, color: '#555' },
  modalError: { fontSize: 14, color: '#c62828' },
  modalButtonsRow: { flexDirection: 'row', justifyContent: 'flex-start', gap: 12 },
  modalFeedback: { marginTop: 6, fontSize: 14, textAlign: 'left' },
  modalFeedbackSuccess: { color: '#2e7d32' },
  modalFeedbackInfo: { color: '#0277bd' },
  modalFeedbackError: { color: '#c62828' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end' },
});
