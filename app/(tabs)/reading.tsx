import * as DocumentPicker from 'expo-document-picker';
import { useLocalSearchParams } from 'expo-router';
import * as Speech from 'expo-speech';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Keyboard, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';

import { useI18n } from '@/i18n';
import { aiCompleteWord, AIFillResult } from '@/utils/ai';
import { createArticle, getArticleById, loadArticleTags, saveArticleTags } from '@/utils/articles';
import { loadTags, loadWords, REVIEW_TAG, saveWords, Word } from '@/utils/storage';
import { getSpeechOptions, loadPauseConfig } from '@/utils/tts';

type TokenKind = 'en' | 'zh' | 'newline' | 'other';
type Token = { key: string; text: string; kind: TokenKind };
type ReadingChunk = {
  text: string;
  lang: 'en' | 'zh';
  sentenceBreak: boolean;
  commaBreak: boolean;
  newlineBefore: boolean;
  newlineAfter: boolean;
};

const NETWORK_ERROR_RE = /Failed to fetch|Network request failed|NetworkError/i;

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  if (!text) return tokens;
  const isEnStart = (ch: string) => /[A-Za-z]/.test(ch);
  const isEnBody = (ch: string) => /[A-Za-z'-]/.test(ch);
  const isZhChar = (ch: string) => /[\u3400-\u9FFF\u4E00-\u9FFF\uF900-\uFAFF]/.test(ch);

  let i = 0;
  let seq = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '\r') {
      i += 1;
      continue;
    }
    if (ch === '\n') {
      tokens.push({ key: `nl-${seq++}`, text: '\n', kind: 'newline' });
      i += 1;
      continue;
    }
    if (isEnStart(ch)) {
      let j = i + 1;
      while (j < text.length && isEnBody(text[j])) j += 1;
      tokens.push({ key: `en-${seq++}`, text: text.slice(i, j), kind: 'en' });
      i = j;
      continue;
    }
    if (isZhChar(ch)) {
      let j = i + 1;
      while (j < text.length && isZhChar(text[j])) j += 1;
      tokens.push({ key: `zh-${seq++}`, text: text.slice(i, j), kind: 'zh' });
      i = j;
      continue;
    }
    let j = i + 1;
    while (j < text.length) {
      const next = text[j];
      if (next === '\n' || isEnStart(next) || isZhChar(next)) break;
      j += 1;
    }
    tokens.push({ key: `gap-${seq++}`, text: text.slice(i, j), kind: 'other' });
    i = j;
  }
  return tokens;
}

function normalizeWord(text: string): string {
  return text.replace(/[^A-Za-z']+/g, '').toLowerCase();
}

function sanitizeArticleTitle(input: string | null | undefined): string {
  const value = (input || '').trim();
  if (!value) return '';
  if (value.length <= 80) return value;
  return `${value.slice(0, 77)}...`;
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
  const [articleSaving, setArticleSaving] = useState(false);
  const [articleNotice, setArticleNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  // Reading controls
  const [isReading, setIsReading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [readingIndex, setReadingIndex] = useState(0);
  const [readingEndIndex, setReadingEndIndex] = useState(0);
  const runnerRef = useRef<{ running: boolean; paused: boolean; index: number; chunks: ReadingChunk[] }>({
    running: false,
    paused: false,
    index: 0,
    chunks: [],
  });
  const params = useLocalSearchParams<{ articleId?: string | string[] }>();
  const articleIdParam = useMemo(() => {
    const value = params.articleId;
    if (!value) return undefined;
    return Array.isArray(value) ? value[0] : value;
  }, [params.articleId]);

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

  useEffect(() => {
    if (!articleNotice) return;
    const timer = setTimeout(() => setArticleNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [articleNotice]);

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
    const chunks: ReadingChunk[] = [];
    const chunkIndexByToken: Record<string, number | undefined> = Object.create(null);
    const sentencePattern = /[\.!?;:。！？；：]/;
    const commaPattern = /[，,、]/;

    let newlinePending = false;
    for (let i = 0; i < tokens.length; i++) {
      const tk = tokens[i];
      if (tk.kind === 'newline') {
        newlinePending = true;
        continue;
      }
      if (tk.kind === 'en' || tk.kind === 'zh') {
        const chunk: ReadingChunk = {
          text: tk.text,
          lang: tk.kind,
          sentenceBreak: false,
          commaBreak: false,
          newlineBefore: newlinePending,
          newlineAfter: false,
        };
        newlinePending = false;

        for (let j = i + 1; j < tokens.length; j++) {
          const next = tokens[j];
          if (next.kind === 'other') {
            if (sentencePattern.test(next.text)) chunk.sentenceBreak = true;
            if (commaPattern.test(next.text)) chunk.commaBreak = true;
            if (next.text.trim() !== '') break;
          } else if (next.kind === 'newline') {
            chunk.newlineAfter = true;
            break;
          } else if (next.kind === 'en' || next.kind === 'zh') {
            break;
          }
        }

        chunkIndexByToken[tk.key] = chunks.length;
        chunks.push(chunk);
      }
    }

    return { chunks, chunkIndexByToken };
  }, [tokens]);

  useEffect(() => {
    // reset reading state when content changes
    runnerRef.current.chunks = readingMeta.chunks;
    runnerRef.current.index = 0;
    runnerRef.current.running = false;
    runnerRef.current.paused = false;
    setReadingIndex(0);
    setReadingEndIndex(0);
    setIsReading(false);
    setIsPaused(false);
    try { Speech.stop(); } catch {}
  }, [readingMeta.chunks]);

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

  const onClearArticle = useCallback(() => {
    try { Speech.stop(); } catch {}
    runnerRef.current.running = false;
    runnerRef.current.paused = false;
    runnerRef.current.index = 0;
    runnerRef.current.chunks = [];
    setRawText('');
    setFileName(null);
    setSelectedKey(null);
    setSelectedWord('');
  setLookupState(null);
  setFeedback(null);
  setIsReading(false);
  setIsPaused(false);
  setReadingIndex(0);
  setReadingEndIndex(0);
}, []);

  useEffect(() => {
    if (!articleIdParam) return;
    let cancelled = false;
    (async () => {
      try {
        const article = await getArticleById(articleIdParam);
        if (!article) {
          if (!cancelled) {
            onClearArticle();
            setArticleNotice({ kind: 'error', text: t('articles.open.missing', { id: articleIdParam }) });
          }
          return;
        }
        if (cancelled) return;
        onClearArticle();
        setRawText(article.rawText ?? '');
        setFileName(article.sourceRef || article.title || null);
        const tagsForArticle = Array.from(new Set([...(article.tags ?? []), REVIEW_TAG]));
        setAvailableTags((prev) => Array.from(new Set([...prev, ...tagsForArticle])));
        setSelectedTags(tagsForArticle);
        setArticleNotice({ kind: 'success', text: t('articles.open.success', { title: article.title }) });
      } catch (err: any) {
        if (cancelled) return;
        onClearArticle();
        const message = err instanceof Error ? err.message : String(err ?? '');
        setArticleNotice({ kind: 'error', text: t('articles.open.error', { message }) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [articleIdParam, onClearArticle, t]);

  const onPickFile = useCallback(async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: 'text/plain', multiple: false });
      // Expo SDK 53: result has `canceled` and `assets`
      if ((res as any).canceled) return;
      const file = (res as any).assets?.[0];
      if (!file) return;
      const textContent = await fetch(file.uri).then((r) => r.text());
      try { Speech.stop(); } catch {}
      runnerRef.current.running = false;
      runnerRef.current.paused = false;
      runnerRef.current.index = 0;
      runnerRef.current.chunks = [];
      setIsReading(false);
      setIsPaused(false);
      setReadingIndex(0);
      setReadingEndIndex(0);
      setRawText(textContent);
      setFileName(file.name || null);
      setSelectedKey(null);
      setSelectedWord('');
      setLookupState(null);
      setFeedback(null);
    } catch (err: any) {
      Alert.alert(t('reading.file.readFailed'), err?.message || t('common.tryLater'));
    }
  }, [t]);

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

  const handleSaveArticle = useCallback(async () => {
    const content = rawText.trim();
    if (!content) {
      Alert.alert(t('reading.saveArticle.empty'));
      return;
    }
    const titleCandidate = sanitizeArticleTitle(fileName ? fileName.replace(/\.[^/.]+$/, '') : null);
    const firstLine = sanitizeArticleTitle(
      content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find((line) => line.length > 0) || ''
    );
    const title = titleCandidate || firstLine || t('reading.saveArticle.defaultTitle');
    const tags = selectedTags.filter((tag) => !!tag);

    setArticleSaving(true);
    try {
      const article = await createArticle({
        title,
        rawText: content,
        sourceType: fileName ? 'file' : 'manual',
        sourceRef: fileName || null,
        tags,
        summary: null,
      });
      if (tags.length > 0) {
        const existing = await loadArticleTags();
        await saveArticleTags([...existing, ...tags]);
      }
      setArticleNotice({ kind: 'success', text: t('reading.saveArticle.success', { title: article.title }) });
    } catch (err: any) {
      const message = err instanceof Error ? err.message : String(err ?? '');
      setArticleNotice({ kind: 'error', text: t('reading.saveArticle.error', { message }) });
    } finally {
      setArticleSaving(false);
    }
  }, [fileName, rawText, selectedTags, t]);

  const speak = async (text: string) => {
    const phrase = (text || '').trim();
    if (!phrase) return;
    try { Speech.stop(); } catch {}
    const opts = await getSpeechOptions('en-US');
    Speech.speak(phrase, { language: 'en-US', voice: opts.voice, rate: opts.rate, pitch: opts.pitch });
  };

  // TTS helpers for reading flow
  const speakAsync = useCallback(
    (text: string, options: Parameters<typeof Speech.speak>[1] = {}) =>
      new Promise<void>((resolve) => {
        try {
          Speech.speak(text, { ...(options || {}), onDone: resolve, onStopped: resolve, onError: () => resolve() });
        } catch {
          resolve();
        }
      }),
    []
  );

  const wait = useCallback((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)), []);

  const runReading = useCallback(async () => {
    if (runnerRef.current.running) return;
    runnerRef.current.running = true;
    try {
      const [enOpts, zhOpts, pauseCfg] = await Promise.all([
        getSpeechOptions('en-US'),
        getSpeechOptions('zh-TW'),
        loadPauseConfig(),
      ]);
      const baseEn = {
        language: 'en-US',
        voice: enOpts.voice,
        rate: enOpts.rate || 1,
        pitch: enOpts.pitch,
      } as Parameters<typeof Speech.speak>[1];
      const baseZh = {
        language: 'zh-TW',
        voice: zhOpts.voice,
        rate: zhOpts.rate || 1,
        pitch: zhOpts.pitch,
      } as Parameters<typeof Speech.speak>[1];
      const { commaMs, sentenceMs } = pauseCfg;
      const LINE_BREAK_GAP = 1000;
      const chunks = runnerRef.current.chunks;

      while (runnerRef.current.index < chunks.length) {
        if (runnerRef.current.paused) {
          await wait(120);
          continue;
        }
        const start = runnerRef.current.index;
        const firstChunk = chunks[start];
        if (!firstChunk) break;
        const lang = firstChunk.lang;
        let end = start + 1;
        for (let j = start; j < chunks.length; j++) {
          const current = chunks[j];
          const next = chunks[j + 1];
          end = j + 1;
          if (current.sentenceBreak || current.commaBreak || current.newlineAfter) break;
          if (next?.newlineBefore) { end = j + 1; break; }
          if (!next || next.lang !== lang) { break; }
          end = j + 2;
        }

        setReadingIndex(start);
        setReadingEndIndex(end);

        const segment = chunks.slice(start, end);
        const phrase = lang === 'zh'
          ? segment.map((c) => c.text).join('')
          : segment.map((c) => c.text).join(' ');
        const speakOptions = lang === 'zh' ? baseZh : baseEn;

        await speakAsync(phrase, speakOptions);
        if (runnerRef.current.paused) continue;

        runnerRef.current.index = end;
        const last = chunks[end - 1];
        if (last?.sentenceBreak) await wait(sentenceMs);
        else if (last?.commaBreak) await wait(commaMs);
        if (last?.newlineAfter) await wait(LINE_BREAK_GAP);
      }
    } finally {
      runnerRef.current.running = false;
      if (runnerRef.current.index >= runnerRef.current.chunks.length) {
        setIsReading(false);
        setIsPaused(false);
      }
    }
  }, [speakAsync, wait]);

  const onStartReading = useCallback(async () => {
    if (readingMeta.chunks.length === 0) {
      Alert.alert('朗讀', '請先貼上或輸入文章內容');
      return;
    }
    try { Speech.stop(); } catch {}
    runnerRef.current.chunks = readingMeta.chunks;
    runnerRef.current.index = 0;
    runnerRef.current.paused = false;
    setReadingIndex(0);
    setReadingEndIndex(0);
    setIsReading(true);
    setIsPaused(false);
    runReading();
  }, [readingMeta.chunks, runReading]);

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
        <View style={styles.actionRow}>
          <Button title={t('reading.toolbar.pickFile')} onPress={onPickFile} />
          <View style={{ width: 8 }} />
          <Button title={t('reading.toolbar.clear')} onPress={onClearArticle} disabled={!rawText && !fileName} />
          <View style={{ width: 8 }} />
          <Button
            title={articleSaving ? t('reading.saveArticle.saving') : t('reading.saveArticle.button')}
            onPress={handleSaveArticle}
            disabled={articleSaving || !rawText.trim()}
          />
        </View>
        {articleNotice ? (
          <View
            style={[
              styles.articleNotice,
              articleNotice.kind === 'success' ? styles.articleNoticeSuccess : styles.articleNoticeError,
            ]}>
            <Text style={styles.articleNoticeText}>{articleNotice.text}</Text>
          </View>
        ) : null}
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
                {tokens.map((token) => {
                  const chunkIdx = readingMeta.chunkIndexByToken[token.key];
                  const isActive = isReading && typeof chunkIdx === 'number' && chunkIdx >= readingIndex && chunkIdx < readingEndIndex;

                  if (token.kind === 'en') {
                    return (
                      <Text
                        key={token.key}
                        style={[styles.word, isActive && styles.wordActive]}
                        onPress={() => onSelectWord(token)}
                        suppressHighlighting>
                        {token.text}
                      </Text>
                    );
                  }

                  if (token.kind === 'zh') {
                    return (
                      <Text key={token.key} style={[styles.wordZh, isActive && styles.wordActive]}>
                        {token.text}
                      </Text>
                    );
                  }

                  return (
                    <Text key={token.key} style={styles.nonWord}>
                      {token.text}
                    </Text>
                  );
                })}
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
  actionRow: { marginHorizontal: 16, marginTop: 12, marginBottom: 4, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  placeholder: { marginTop: 12, color: '#888', marginHorizontal: 16 },
  articleSection: { marginTop: 20, gap: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#333', marginHorizontal: 16 },
  articleBox: { marginTop: 8, marginHorizontal: 16, padding: 14, borderWidth: 1, borderColor: '#d0d7e2', borderRadius: 10, backgroundColor: '#f7f9fc' },
  articleText: { fontSize: 18, lineHeight: 28, color: '#222' },
  word: { color: '#0d47a1' },
  wordZh: { color: '#2e7d32' },
  wordActive: { backgroundColor: '#ffecb3', borderRadius: 4 },
  nonWord: { color: '#222' },
  toolbar: { padding: 16, borderTopWidth: 1, borderColor: '#e0e0e0', flexDirection: 'row', gap: 12 },
  articleNotice: { marginHorizontal: 16, marginTop: 8, padding: 12, borderRadius: 8, borderWidth: 1 },
  articleNoticeSuccess: { backgroundColor: '#e8f5e9', borderColor: '#81c784' },
  articleNoticeError: { backgroundColor: '#ffebee', borderColor: '#ef9a9a' },
  articleNoticeText: { fontSize: 14, color: '#333' },
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
