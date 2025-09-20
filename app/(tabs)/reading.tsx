import { useEffect, useMemo, useState, useCallback } from 'react';
import { Alert, Button, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as Speech from 'expo-speech';
import winkTokenizer from 'wink-tokenizer';

import { aiCompleteWord, AIFillResult } from '@/utils/ai';
import { loadTags, loadWords, saveWords, REVIEW_TAG, Word } from '@/utils/storage';
import { getSpeechOptions } from '@/utils/tts';

type Token = { key: string; text: string; isWord: boolean };

type SessionMark = { saved?: boolean };

const tokenizerInstance = winkTokenizer() as { tokenize: (text: string) => { value: string; tag: string }[] };

function tokenize(text: string): Token[] {
  if (!text) return [];
  const raw = tokenizerInstance.tokenize(text) as { value: string; tag: string }[];
  let seq = 0;
  return raw.map((token) => ({
    key: `${token.tag}-${seq++}`,
    text: token.value,
    isWord: token.tag === 'word',
  }));
}

function normalizeWord(text: string): string {
  return text.replace(/[^A-Za-z']+/g, '').toLowerCase();
}

async function fetchPhonetic(word: string): Promise<string | null> {
  const target = word.trim().toLowerCase();
  if (!target) return null;
  const url = 'https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(target);
  const res = await fetch(url);
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
  const [rawText, setRawText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [selectedWord, setSelectedWord] = useState<string>('');
  const [lookupState, setLookupState] = useState<LookupState | null>(null);
  const [sessionMarks, setSessionMarks] = useState<Record<string, SessionMark>>({});
  const [availableTags, setAvailableTags] = useState<string[]>([REVIEW_TAG]);
  const [selectedTags, setSelectedTags] = useState<string[]>([REVIEW_TAG]);
  const [showTagSelector, setShowTagSelector] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const tags = await loadTags();
        if (cancelled) return;
        const unique = Array.from(new Set([...(tags || []), REVIEW_TAG]));
        setAvailableTags(unique);
        setSelectedTags((prev) => {
          const next = new Set(prev.length ? prev : []);
          next.add(REVIEW_TAG);
          return Array.from(next);
        });
      } catch {
        // ignore tag loading errors and fall back to existing defaults
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const tokens = useMemo(() => tokenize(rawText), [rawText]);
  const selectedTagsLabel = useMemo(() => selectedTags.join('、'), [selectedTags]);

  const toggleDefaultTag = useCallback((tag: string) => {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (tag === REVIEW_TAG) {
        next.add(REVIEW_TAG);
        return Array.from(next);
      }
      if (next.has(tag)) {
        next.delete(tag);
      } else {
        next.add(tag);
      }
      next.add(REVIEW_TAG);
      return Array.from(next);
    });
  }, []);

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
        let phonetic: string | undefined;
        let phoneticError: string | undefined;
        try {
          const result = await fetchPhonetic(normalized);
          phonetic = result ?? undefined;
        } catch (err: any) {
          phoneticError = err?.message || 'dictionary error';
        }
        if (cancelled) return;
        let ai: AIFillResult | undefined;
        let aiError: string | undefined;
        try {
          ai = await aiCompleteWord({ en: normalized });
        } catch (err: any) {
          aiError = err?.message || 'AI error';
        }
        if (cancelled) return;
        setLookupState({
          word: selectedWord,
          normalized,
          loading: false,
          phonetic,
          phoneticError,
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

  const buildWordPayload = (baseWord: string, incomingTags: string[]): Word => {
    const trimmed = (baseWord || '').trim() || lookupState?.normalized || baseWord;
    const translation = (lookupState?.ai?.zh || '').trim();
    const exampleEn = lookupState?.ai?.exampleEn || '';
    const exampleZh = lookupState?.ai?.exampleZh || '';
    const tagSet = new Set(incomingTags);
    tagSet.add(REVIEW_TAG);
    const tags = Array.from(tagSet);
    const includesReview = tags.includes(REVIEW_TAG);
    const nowIso = new Date().toISOString();
    return {
      en: trimmed,
      zh: translation,
      exampleEn,
      exampleZh,
      status: 'unknown',
      createdAt: nowIso,
      reviewCount: 0,
      tags,
      srsEase: includesReview ? 2.5 : undefined,
      srsInterval: includesReview ? 0 : undefined,
      srsReps: includesReview ? 0 : undefined,
      srsLapses: includesReview ? 0 : undefined,
      srsDue: includesReview ? nowIso : undefined,
    };
  };

  const handleAddWord = async () => {
    if (!lookupState) return;
    const normalized = lookupState.normalized;
    try {
      const baseWord = (lookupState.word || lookupState.normalized).trim();
      if (!baseWord) return;
      const list = await loadWords();
      const idx = list.findIndex((w) => normalizeWord(w.en) === normalized);
      const defaultTags = Array.from(new Set([...selectedTags, REVIEW_TAG]));
      const nowIso = new Date().toISOString();
      const translation = (lookupState.ai?.zh || '').trim();
      const exampleEn = lookupState.ai?.exampleEn || '';
      const exampleZh = lookupState.ai?.exampleZh || '';
      if (idx >= 0) {
        const existing = list[idx];
        const nextTags = new Set([...(existing.tags || []), ...defaultTags]);
        const includesReview = nextTags.has(REVIEW_TAG);
        const updated: Word = {
          ...existing,
          zh: existing.zh || translation,
          exampleEn: existing.exampleEn || exampleEn,
          exampleZh: existing.exampleZh || exampleZh,
          tags: Array.from(nextTags),
        };
        if (includesReview && !(existing.tags || []).includes(REVIEW_TAG)) {
          updated.srsEase = typeof existing.srsEase === 'number' ? existing.srsEase : 2.5;
          updated.srsInterval = typeof existing.srsInterval === 'number' ? existing.srsInterval : 0;
          updated.srsReps = typeof existing.srsReps === 'number' ? existing.srsReps : 0;
          updated.srsLapses = typeof existing.srsLapses === 'number' ? existing.srsLapses : 0;
          updated.srsDue = existing.srsDue || nowIso;
        }
        const nextList = [...list];
        nextList[idx] = updated;
        await saveWords(nextList);
      } else {
        const newWord = buildWordPayload(baseWord, defaultTags);
        await saveWords([...list, newWord]);
      }
      setSessionMarks((prev) => ({ ...prev, [normalized]: { saved: true } }));
    } catch (err: any) {
      Alert.alert('\u64cd\u4f5c\u5931\u6557', err?.message || '\u7121\u6cd5\u52a0\u5165\u55ae\u5b57');
    }
  };

  const handleSpeak = useCallback(async () => {
    const phrase = (lookupState?.word || selectedWord || '').trim();
    if (!phrase) return;
    try { Speech.stop(); } catch { /* ignore */ }
    try {
      const options = await getSpeechOptions('en-US');
      Speech.speak(phrase, { ...options, language: options.language || 'en-US' });
    } catch {
      Speech.speak(phrase, { language: 'en-US' });
    }
  }, [lookupState?.word, selectedWord]);

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
  const hasSavedWord = !!markState?.saved;

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
        <View style={styles.tagSection}>
          <Pressable style={styles.tagHeader} onPress={() => setShowTagSelector((prev) => !prev)}>
            <Text style={styles.tagHeaderText}>{'\u9810\u8a2d\u6a19\u7c64'}</Text>
            <Text style={styles.tagHeaderValue}>{selectedTagsLabel || '\uff08\u5c1a\u672a\u9078\u64c7\uff09'}</Text>
          </Pressable>
          {showTagSelector && (
            <View style={styles.tagList}>
              {availableTags.map((tag) => {
                const isSelected = selectedTags.includes(tag);
                const isMandatory = tag === REVIEW_TAG;
                return (
                  <TouchableOpacity
                    key={tag}
                    style={[
                      styles.tagChip,
                      isSelected && styles.tagChipSelected,
                    ]}
                    activeOpacity={0.7}
                    onPress={() => toggleDefaultTag(tag)}
                    disabled={isMandatory}
                  >
                    <Text
                      style={[
                        styles.tagChipText,
                        isSelected && styles.tagChipTextSelected,
                        isMandatory && styles.tagChipTextDisabled,
                      ]}
                    >
                      {isMandatory ? `${tag}（必選）` : tag}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
          <Text style={styles.tagHint}>{'\u65b0\u589e\u55ae\u5b57\u6703\u81ea\u52d5\u5957\u7528\u4ee5\u4e0a\u6a19\u7c64\uff0c\u4e26\u56fa\u5b9a\u5305\u542b\u8907\u7fd2\u6a19\u7c64\u3002'}</Text>
        </View>
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
                  if (mark?.saved) textStyles.push(styles.wordMarked);
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
            {lookupState?.phonetic ? (
              <Text style={styles.modalPhonetic}>{lookupState.phonetic}</Text>
            ) : null}
            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent}>
              {lookupState?.loading && (
                <Text style={styles.modalHint}>{'\u67e5\u8a62\u4e2d...'}</Text>
              )}
              {!lookupState?.loading && (
                <>
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
                  {lookupState?.phoneticError && (
                    <Text style={styles.modalError}>{lookupState.phoneticError}</Text>
                  )}
                  {lookupState?.aiError && (
                    <Text style={styles.modalError}>{lookupState.aiError}</Text>
                  )}
                  {lookupState && !lookupState.loading && !lookupState.ai && !lookupState.error && !lookupState.phoneticError && !lookupState.aiError && (
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
  modalButtonsRow: { flexDirection: 'row', justifyContent: 'flex-start', gap: 12 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end' },
  tagSection: { marginTop: 20, borderWidth: 1, borderColor: '#d0d7e2', borderRadius: 10, backgroundColor: '#f2f6ff' },
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
});
