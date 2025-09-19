import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableWithoutFeedback, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as Speech from 'expo-speech';

import { aiCompleteWord, AIFillResult } from '@/utils/ai';
import { loadWords, saveWords, toggleWordTag, REVIEW_TAG, Word } from '@/utils/storage';

type Token = { key: string; text: string; isWord: boolean };

type DictionaryDefinition = { definition: string; example?: string; partOfSpeech?: string };
type DictionaryResult = { phonetic?: string; audio?: string; definitions: DictionaryDefinition[] };
type SessionMark = { saved?: boolean; review?: boolean };

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

async function fetchDictionaryEntry(word: string): Promise<DictionaryResult | null> {
  const target = word.trim().toLowerCase();
  if (!target) return null;
  const url = 'https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(target);
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 404) return null;
    const detail = await res.text().catch(() => '');
    throw new Error('dictionary ' + res.status + ': ' + detail);
  }
  const json = await res.json();
  if (!Array.isArray(json) || json.length === 0) return null;
  const entry = json[0] ?? {};
  const phonetic = typeof entry.phonetic === 'string' && entry.phonetic
    ? entry.phonetic
    : Array.isArray(entry.phonetics)
      ? entry.phonetics.find((p: any) => p && typeof p.text === 'string' && p.text)?.text
      : undefined;
  const audio = Array.isArray(entry.phonetics)
    ? entry.phonetics.find((p: any) => p && typeof p.audio === 'string' && p.audio)?.audio
    : undefined;
  const definitions: DictionaryDefinition[] = [];
  if (Array.isArray(entry.meanings)) {
    for (const meaning of entry.meanings) {
      if (!meaning || !Array.isArray(meaning.definitions)) continue;
      const part = typeof meaning.partOfSpeech === 'string' ? meaning.partOfSpeech : undefined;
      for (const def of meaning.definitions) {
        if (!def || typeof def.definition !== 'string') continue;
        definitions.push({
          definition: def.definition,
          example: typeof def.example === 'string' ? def.example : undefined,
          partOfSpeech: part,
        });
      }
    }
  }
  return { phonetic: phonetic || undefined, audio: audio || undefined, definitions };
}

type LookupState = {
  word: string;
  normalized: string;
  loading: boolean;
  localWord?: Word;
  dictionary?: DictionaryResult;
  dictionaryError?: string;
  ai?: AIFillResult;
  aiError?: string;
  error?: string;
};

export default function ReadingScreen() {
  const [rawText, setRawText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [selectedWord, setSelectedWord] = useState<string>('');
  const [lookupState, setLookupState] = useState<LookupState | null>(null);
  const [sessionMarks, setSessionMarks] = useState<Record<string, SessionMark>>({});

  const tokens = useMemo(() => tokenize(rawText), [rawText]);

  const onPickFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: 'text/plain', multiple: false });
      if (res.type !== 'success') return;
      const file = res.assets?.[0];
      if (!file) return;
      const textContent = await fetch(file.uri).then((r) => r.text());
      setRawText(textContent);
      setFileName(file.name || null);
      setSelectedKey(null);
      setSelectedWord('');
      setLookupState(null);
    } catch (err: any) {
      Alert.alert('\u8b80\u53d6\u6a94\u6848\u5931\u6557', err?.message || '\u8acb\u7a0d\u5f8c\u518d\u8a66');
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
      return;
    }
    const normalized = normalizeWord(selectedWord);
    if (!normalized) {
      setLookupState(null);
      return;
    }
    let cancelled = false;
    setLookupState({ word: selectedWord, normalized, loading: true });
    (async () => {
      try {
        const words = await loadWords();
        if (cancelled) return;
        const local = words.find((w) => normalizeWord(w.en) === normalized);
        let dictionary: DictionaryResult | undefined;
        let dictionaryError: string | undefined;
        try {
          const dict = await fetchDictionaryEntry(normalized);
          dictionary = dict ?? undefined;
        } catch (err: any) {
          dictionaryError = err?.message || 'dictionary error';
        }
        if (cancelled) return;
        let ai: AIFillResult | undefined;
        let aiError: string | undefined;
        const hasLocalTranslation = !!(local && typeof local.zh === 'string' && local.zh.trim());
        const dictionaryHasExample = !!(dictionary && dictionary.definitions.some((d) => !!d.example));
        const needsAi = !hasLocalTranslation || !dictionaryHasExample;
        if (needsAi) {
          try {
            ai = await aiCompleteWord({ en: normalized });
          } catch (err: any) {
            aiError = err?.message || 'AI error';
          }
        }
        if (cancelled) return;
        setLookupState({
          word: selectedWord,
          normalized,
          loading: false,
          localWord: local,
          dictionary,
          dictionaryError,
          ai,
          aiError,
        });
      } catch (err: any) {
        if (cancelled) return;
        setLookupState({ word: selectedWord, normalized, loading: false, error: err?.message || 'lookup failed' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedWord]);

  const buildWordPayload = (baseWord: string): Word => {
    const trimmed = (baseWord || '').trim() || lookupState?.normalized || baseWord;
    const translation = (lookupState?.ai?.zh || '').trim();
    const dictionaryExample = lookupState?.dictionary?.definitions.find((d) => !!d.example)?.example || '';
    const exampleEn = lookupState?.ai?.exampleEn || dictionaryExample || '';
    const exampleZh = lookupState?.ai?.exampleZh || '';
    return {
      en: trimmed,
      zh: translation,
      exampleEn,
      exampleZh,
      status: 'unknown',
      createdAt: new Date().toISOString(),
      reviewCount: 0,
      tags: [],
    };
  };

  const handleAddWord = async () => {
    if (!lookupState) return;
    const normalized = lookupState.normalized;
    try {
      const list = await loadWords();
      if (list.some((w) => normalizeWord(w.en) === normalized)) {
        Alert.alert('\u5df2\u5728\u55ae\u5b57\u5eab', lookupState.word);
        return;
      }
      const baseWord = (lookupState.word || lookupState.normalized).trim();
      const newWord = buildWordPayload(baseWord);
      await saveWords([...list, newWord]);
      setLookupState((prev) => (prev ? { ...prev, localWord: newWord } : prev));
      setSessionMarks((prev) => ({ ...prev, [normalized]: { ...(prev[normalized] || {}), saved: true } }));
      Alert.alert('\u5df2\u52a0\u5165\u55ae\u5b57', baseWord);
    } catch (err: any) {
      Alert.alert('\u64cd\u4f5c\u5931\u6557', err?.message || '\u7121\u6cd5\u52a0\u5165\u55ae\u5b57');
    }
  };

  const handleAddReview = async () => {
    if (!lookupState) return;
    const normalized = lookupState.normalized;
    try {
      let list = await loadWords();
      let target = list.find((w) => normalizeWord(w.en) === normalized);
      if (!target) {
        const baseWord = (lookupState.word || lookupState.normalized).trim();
        const newWord = buildWordPayload(baseWord);
        await saveWords([...list, newWord]);
        list = await loadWords();
        target = list.find((w) => normalizeWord(w.en) === normalized) || newWord;
      }
      await toggleWordTag(target.en, REVIEW_TAG, true);
      const refreshed = await loadWords();
      const updated = refreshed.find((w) => normalizeWord(w.en) === normalized) || target;
      setLookupState((prev) => (prev ? { ...prev, localWord: updated } : prev));
      setSessionMarks((prev) => ({ ...prev, [normalized]: { ...(prev[normalized] || {}), saved: true, review: true } }));
      Alert.alert('\u5df2\u52a0\u5165\u8907\u7fd2', updated.en);
    } catch (err: any) {
      Alert.alert('\u64cd\u4f5c\u5931\u6557', err?.message || '\u7121\u6cd5\u52a0\u5165\u8907\u7fd2');
    }
  };

  const handleSpeak = () => {
    const phrase = (lookupState?.word || selectedWord || '').trim();
    if (!phrase) return;
    try { Speech.stop(); } catch (e) { /* ignore */ }
    Speech.speak(phrase, { language: 'en-US' });
  };

  const clearAll = () => {
    setRawText('');
    setFileName(null);
    setSelectedKey(null);
    setSelectedWord('');
    setLookupState(null);
  };

  const closeModal = () => {
    setSelectedKey(null);
    setSelectedWord('');
    setLookupState(null);
  };

  const normalizedCurrent = lookupState?.normalized || '';
  const markState = normalizedCurrent ? sessionMarks[normalizedCurrent] : undefined;
  const hasSavedWord = !!(lookupState?.localWord || markState?.saved);
  const hasReviewTag = !!(lookupState?.localWord?.tags?.includes(REVIEW_TAG) || markState?.review);

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.inputWrap}
        contentContainerStyle={styles.inputContent}
        keyboardShouldPersistTaps='handled'
      >
        {fileName && <Text style={styles.fileName}>{'\u4f86\u6e90\uff1a' + fileName}</Text>}
        <TextInput
          style={styles.textInput}
          placeholder={'\u8cbc\u4e0a\u6216\u8f38\u5165\u6587\u7ae0\u5167\u5bb9'}
          value={rawText}
          onChangeText={setRawText}
          multiline
        />
        {tokens.length === 0 && rawText.trim() === '' && (
          <Text style={styles.placeholder}>{'\u8cbc\u4e0a\u6216\u8f09\u5165\u6587\u7ae0\uff0c\u7136\u5f8c\u9ede\u9078\u55ae\u5b57\u4ee5\u67e5\u8a62\u3002'}</Text>
        )}
        {tokens.length > 0 && (
          <View style={styles.articleSection}>
            <Text style={styles.sectionTitle}>{'\u95b1\u8b80\u5167\u5bb9'}</Text>
            <View style={styles.articleBox}>
              <Text style={styles.articleText}>
                {tokens.map((token) => {
                  if (!token.isWord) {
                    return (
                      <Text key={token.key} style={styles.nonWord}>
                        {token.text}
                      </Text>
                    );
                  }
                  const normalizedWord = normalizeWord(token.text);
                  const mark = sessionMarks[normalizedWord];
                  const isSelected = selectedKey === token.key;
                  const textStyles = [styles.word];
                  if (mark?.saved || mark?.review) textStyles.push(styles.wordMarked);
                  if (isSelected) textStyles.push(styles.wordSelected);
                  return (
                    <Text
                      key={token.key}
                      style={textStyles}
                      onPress={() => onSelectWord(token)}
                      suppressHighlighting
                    >
                      {token.text}
                    </Text>
                  );
                })}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
      <View style={styles.toolbar}>
        <Button title={'\u958b\u5553 TXT'} onPress={onPickFile} />
        <View style={{ width: 12 }} />
        <Button title={'\u6e05\u7a7a'} onPress={clearAll} />
      </View>
      <Modal visible={!!selectedKey} animationType="slide" transparent onRequestClose={closeModal}>
        <View style={styles.modalContainer}>
          <TouchableWithoutFeedback onPress={closeModal}>
            <View style={styles.modalBackdrop} />
          </TouchableWithoutFeedback>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{selectedWord}</Text>
            {lookupState?.dictionary?.phonetic ? (
              <Text style={styles.modalPhonetic}>{lookupState.dictionary.phonetic}</Text>
            ) : null}
            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent}>
              {lookupState?.loading && (
                <Text style={styles.modalHint}>{'\u67e5\u8a62\u4e2d...'}</Text>
              )}
              {!lookupState?.loading && (
                <>
                  {lookupState?.localWord && (
                    <View style={styles.modalSection}>
                      <Text style={styles.modalLabel}>{'\u672c\u5730\u8a5e\u5eab'}</Text>
                      {lookupState.localWord.zh ? (
                        <Text style={styles.modalText}>{lookupState.localWord.zh}</Text>
                      ) : (
                        <Text style={styles.modalHint}>{'\u7121\u4e2d\u6587\u7ffb\u8b6f'}</Text>
                      )}
                      {lookupState.localWord.exampleEn && (
                        <Text style={styles.modalSub}>{lookupState.localWord.exampleEn}</Text>
                      )}
                      {lookupState.localWord.exampleZh && (
                        <Text style={styles.modalSub}>{lookupState.localWord.exampleZh}</Text>
                      )}
                    </View>
                  )}
                  {lookupState?.dictionary && lookupState.dictionary.definitions.length > 0 && (
                    <View style={styles.modalSection}>
                      <Text style={styles.modalLabel}>{'\u5b57\u5178\u5b9a\u7fa9'}</Text>
                      {lookupState.dictionary.definitions.slice(0, 3).map((def, idx) => (
                        <View key={idx} style={styles.modalDefinition}>
                          <Text style={styles.modalText}>
                            {def.partOfSpeech ? def.partOfSpeech + '. ' : ''}{def.definition}
                          </Text>
                          {def.example && (
                            <Text style={styles.modalSub}>{def.example}</Text>
                          )}
                        </View>
                      ))}
                    </View>
                  )}
                  {lookupState?.dictionaryError && (
                    <Text style={styles.modalError}>{lookupState.dictionaryError}</Text>
                  )}
                  {lookupState?.ai && (
                    <View style={styles.modalSection}>
                      <Text style={styles.modalLabel}>{'AI \u88dc\u9f50'}</Text>
                      {lookupState.ai.zh && (
                        <Text style={styles.modalText}>{lookupState.ai.zh}</Text>
                      )}
                      {lookupState.ai.exampleEn && (
                        <Text style={styles.modalSub}>{lookupState.ai.exampleEn}</Text>
                      )}
                      {lookupState.ai.exampleZh && (
                        <Text style={styles.modalSub}>{lookupState.ai.exampleZh}</Text>
                      )}
                    </View>
                  )}
                  {lookupState?.aiError && (
                    <Text style={styles.modalError}>{lookupState.aiError}</Text>
                  )}
                  {lookupState && !lookupState.loading && !lookupState.localWord && !lookupState.dictionary && !lookupState.ai && !lookupState.error && !lookupState.dictionaryError && !lookupState.aiError && (
                    <Text style={styles.modalHint}>{'\u67e5\u7121\u8cc7\u6599'}</Text>
                  )}
                  {lookupState?.error && (
                    <Text style={styles.modalError}>{lookupState.error}</Text>
                  )}
                </>
              )}
            </ScrollView>
            <View style={styles.modalButtonsRow}>
              <Button title={'\u52a0\u5165\u55ae\u5b57'} onPress={handleAddWord} disabled={lookupState?.loading || hasSavedWord} />
              <Button title={'\u52a0\u5165\u8907\u7fd2'} onPress={handleAddReview} disabled={lookupState?.loading || hasReviewTag} />
              <Button title={'\u767c\u97f3'} onPress={handleSpeak} />
            </View>
            <View style={styles.modalActions}>
              <Button title={'\u95dc\u9589'} onPress={closeModal} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  inputWrap: { flex: 1, paddingHorizontal: 20 },
  inputContent: { paddingBottom: 40 },
  textInput: { minHeight: 180, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, textAlignVertical: 'top', backgroundColor: '#fff' },
  placeholder: { marginTop: 12, color: '#888' },
  articleSection: { marginTop: 20, gap: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#333' },
  articleBox: { padding: 14, borderWidth: 1, borderColor: '#d0d7e2', borderRadius: 10, backgroundColor: '#f7f9fc' },
  articleText: { fontSize: 18, lineHeight: 28, color: '#222' },
  word: { paddingHorizontal: 2, borderRadius: 4 },
  wordMarked: { backgroundColor: '#e3f2fd' },
  wordSelected: { backgroundColor: '#ffecb3' },
  nonWord: { color: '#222' },
  toolbar: { padding: 20, borderTopWidth: 1, borderColor: '#e0e0e0', flexDirection: 'row', justifyContent: 'flex-start', gap: 12 },
  fileName: { marginBottom: 8, color: '#666' },
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
  modalDefinition: { gap: 4 },
  modalHint: { fontSize: 14, color: '#555' },
  modalError: { fontSize: 14, color: '#c62828' },
  modalButtonsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end' },
});

