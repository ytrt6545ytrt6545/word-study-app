import React, { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Locale = 'zh-TW' | 'en';

const LANG_KEY = '@lang_locale';

const dict = {
  'zh-TW': {
    // Tabs
    'tabs.home': '首頁',
    'tabs.explore': '新增單字',
    'tabs.reading': '閱讀',
    'tabs.words': '單字',
    'tabs.settings': '設定',

    // Common
    'common.cancel': '取消',
    'common.delete': '刪除',
    'common.save': '儲存',
    'common.play': '播放',
    'common.playing': '播放中...',
    'common.loading': '載入中...',
    'common.submit': '送出',
    'common.ok': '確定',
    'common.again': '再一次',
    'common.back': '返回',
    'common.yes': '是',
    'common.no': '否',

    // Index
    'index.title': '首頁',
    'index.lastUpdated': '建構日期：{date}',
    'index.lastUpdated.missing': '建構日期：未設定',
    'index.notice': '更新資訊',
    'index.tagsManage': '標籤管理',
    'index.review': '複習',
    'index.exam': '考試',

    // Words
    'words.title': '單字列表',
    'words.search.placeholder': '輸入英文/翻譯/標籤',
    'words.add': '新增單字',
    'words.import': '匯入文章',
    'words.sort.new2old': '新到舊',
    'words.sort.old2new': '舊到新',
    'words.familiarity': '熟悉度',
    'words.read': '讀',
    'words.delete': '刪除',
    'words.confirmDelete.title': '刪除單字',
    'words.confirmDelete.message': '確定要刪除「{word}」嗎？',

    // Explore
    'explore.title': '新增單字',
    'explore.clear': '清空',
    'explore.preview': '試聽',
    'explore.input.en': '英文單字',
    'explore.input.zh': '中文翻譯',
    'explore.input.exEn': '英文例句',
    'explore.input.exZh': '例句中文翻譯',
    'explore.ai': 'AI 補齊',
    'explore.ai.loading': 'AI 補齊中...',
    'explore.add': '加入清單',
    'explore.backToTag': '回到標籤',
    'explore.added': '已新增',
    'explore.added.message': '{word} 已加入清單',
    'explore.exists': '新增單字',
    'explore.exists.message': '{word} 已在清單',
    'explore.ai.onlyOne': 'AI 補齊',
    'explore.ai.onlyOne.message': '請只填「英文單字」或「中文翻譯」其一',
    'explore.ai.failed': 'AI 失敗',

    // Tag pages
    'tags.manage.title': '標籤管理',
    'tags.add': '新增標籤',
    'tags.input.name': '輸入標籤名稱',
    'tags.list': '標籤列表',
    'tags.bulkDelete': '批次刪除 ({count})',
    'tags.search': '搜尋標籤',
    'tags.sort.az': '排序 A→Z',
    'tags.sort.za': '排序 Z→A',
    'tags.item.suggested': ' (建議)',
    'tags.item.rename': '改名',
    'tags.item.delete': '刪除',
    'tags.rename.input': '輸入新名稱',
    'tags.rename.ok': '確定',
    'tags.rename.cancel': '取消',
    'tags.none': '目前沒有標籤，請先新增。',
    'tags.confirmDelete.title': '刪除標籤',
    'tags.confirmDelete.message': '確定要刪除「{tag}」這個標籤嗎？\n刪除後無法復原。',
    'tags.bulkDelete.title': '批次刪除標籤',
    'tags.bulkDelete.message': '確定要刪除 {count} 個標籤嗎？\n刪除後無法復原。',
    'tags.page.title': '標籤：{tag}',
    'tags.addWord': '新增單字',
    'tags.reviewTag': '標籤複習',
    'tags.loopReviewTag': '標籤循環複習',

    // Word detail
    'word.createdAt': '建立於：{date}',
    'word.reviewCount': '複習次數：{count}',
    'word.zh': '中文翻譯',
    'word.exEn': '英文例句',
    'word.exZh': '例句中文翻譯',
    'word.familiarity': '熟悉度',
    'word.tags': '標籤',
    'word.tags.none': '尚無標籤，請到首頁新增',
    'word.play': '播放',
    'word.playing': '播放中...',
    'word.save': '儲存',
    'word.delete': '刪除',
    'word.saved': '已儲存',
    'word.saved.message': '{word} 已更新',
    'word.confirmDelete.title': '刪除單字',
    'word.confirmDelete.message': '確定刪除「{word}」？',

    // Settings
    'settings.title': '設定',
    'settings.dailyLimit': '複習每日上限',
    'settings.newLimit': '新卡上限：{n}',
    'settings.reviewLimit': '複習上限：{n}',
    'settings.rate': '語速調整',
    'settings.rate.hint': '英文語速：{n}/100（中間偏下較慢）',
    'settings.zhRate': '中文語速',
    'settings.pitch': '音高（越左越低、越右越高）',
    'settings.pitch.hint': '音高：{n}/100',
    'settings.wordFont': '清單字體大小（列表英文）',
    'settings.wordFont.value': '字體：{n}px',
    'settings.enVoices': '英文語音清單',
    'settings.zhVoices': '中文語音清單',
    'settings.loadingVoices': '載入可用語音...',
    'settings.systemDefault': '系統預設',
    'settings.previewEn': '試聽英文語音',
    'settings.previewZh': '試聽中文語音',
    'settings.language': '介面語言',
    'settings.language.zh': '繁體中文',
    'settings.language.en': 'English',

    // Review
    'review.title': '複習',
    'review.done': '複習完成',
    'review.noCandidates': '沒有可複習的單字',
    'review.back': '回上一頁',
    'review.loop.done.title': '複習完了',
    'review.loop.done.message': '要再複習一次嗎？',
    'review.loop.again': '要再複習',
    'review.loop.finish': '可以了',
    'review.hearAgain': '再聽一次',
    'review.next': '下一題',
    'review.removeReviewTag': '太熟了，移除複習標籤',

    // Exam
    'exam.word.title': '單字考試',
    'exam.word.progress': '第 {index} 題／共 {total} 題',
    'exam.word.noChinese': '（無中文翻譯）',
    'exam.word.speak': '朗讀',
    'exam.word.input.placeholder': '輸入英文單字，按 Enter 確認',
    'exam.word.removeTag': '移除考試標籤',
    'exam.word.correct': '答對了！',
    'exam.word.wrong': '寫拼錯了',
    'exam.word.empty.title': '沒有考試範圍的單字',
    'exam.word.empty.hint': '請回到「標籤」頁，將需要考試的單字加入 {tag} 標籤',

    // Reading
    'reading.toolbar.pickFile': '開啟 TXT',
    'reading.toolbar.clear': '清空',
    'reading.file.readFailed': '讀取檔案失敗',
    'reading.file.from': '來源：{name}',
    'reading.placeholder.input': '貼上或輸入文章內容',
    'reading.placeholder.hint': '貼上或載入文章，然後點選單字以查詢。',
    'reading.tags.header': '預設標籤',
    'reading.tags.none': '（尚未選擇）',
    'reading.tags.hint': '新增單字會自動套用以上標籤，並固定包含複習標籤。',
    'reading.tags.mandatory': '（必選）',
    'reading.section.article': '閱讀內容',
    'reading.modal.ai': 'AI 補齊',
    'reading.modal.lookupLoading': '查詢中...',
    'reading.modal.noData': '查無資料',
    'reading.modal.addWord': '加入單字',
    'reading.modal.speak': '發音',
    'reading.modal.close': '關閉',

    'common.tryLater': '請稍後再試',
  },
  en: {
    'tabs.home': 'Home',
    'tabs.explore': 'Add Word',
    'tabs.reading': 'Reading',
    'tabs.words': 'Words',
    'tabs.settings': 'Settings',

    'common.cancel': 'Cancel',
    'common.delete': 'Delete',
    'common.save': 'Save',
    'common.play': 'Play',
    'common.playing': 'Playing...',
    'common.loading': 'Loading...',
    'common.submit': 'Submit',
    'common.ok': 'OK',
    'common.again': 'Again',
    'common.back': 'Back',
    'common.yes': 'Yes',
    'common.no': 'No',

    'index.title': 'Home',
    'index.lastUpdated': 'Build date: {date}',
    'index.lastUpdated.missing': 'Build date: N/A',
    'index.notice': 'Updates',
    'index.tagsManage': 'Tags',
    'index.review': 'Review',
    'index.exam': 'Exam',

    'words.title': 'Word List',
    'words.search.placeholder': 'Search by EN/ZH/Tag',
    'words.add': 'Add Word',
    'words.import': 'Import Text',
    'words.sort.new2old': 'New → Old',
    'words.sort.old2new': 'Old → New',
    'words.familiarity': 'Familiarity',
    'words.read': 'Read',
    'words.delete': 'Delete',
    'words.confirmDelete.title': 'Delete Word',
    'words.confirmDelete.message': 'Delete "{word}"?',

    'explore.title': 'Add Word',
    'explore.clear': 'Clear',
    'explore.preview': 'Preview',
    'explore.input.en': 'English word',
    'explore.input.zh': 'Chinese translation',
    'explore.input.exEn': 'Example (EN)',
    'explore.input.exZh': 'Example (ZH)',
    'explore.ai': 'AI Fill',
    'explore.ai.loading': 'AI Filling...',
    'explore.add': 'Add to List',
    'explore.backToTag': 'Back to Tag',
    'explore.added': 'Added',
    'explore.added.message': '{word} added',
    'explore.exists': 'Add Word',
    'explore.exists.message': '{word} already exists',
    'explore.ai.onlyOne': 'AI Fill',
    'explore.ai.onlyOne.message': 'Fill either "English" or "Chinese" only',
    'explore.ai.failed': 'AI Failed',

    'tags.manage.title': 'Tags',
    'tags.add': 'Add Tag',
    'tags.input.name': 'Enter tag name',
    'tags.list': 'Tag List',
    'tags.bulkDelete': 'Bulk Delete ({count})',
    'tags.search': 'Search tags',
    'tags.sort.az': 'Sort A→Z',
    'tags.sort.za': 'Sort Z→A',
    'tags.item.suggested': ' (suggested)',
    'tags.item.rename': 'Rename',
    'tags.item.delete': 'Delete',
    'tags.rename.input': 'New name',
    'tags.rename.ok': 'OK',
    'tags.rename.cancel': 'Cancel',
    'tags.none': 'No tags yet. Add one.',
    'tags.confirmDelete.title': 'Delete Tag',
    'tags.confirmDelete.message': 'Delete "{tag}"?\nThis cannot be undone.',
    'tags.bulkDelete.title': 'Bulk Delete Tags',
    'tags.bulkDelete.message': 'Delete {count} tags?\nThis cannot be undone.',
    'tags.page.title': 'Tag: {tag}',
    'tags.addWord': 'Add Word',
    'tags.reviewTag': 'Tag Review',
    'tags.loopReviewTag': 'Tag Loop Review',

    'word.createdAt': 'Created at: {date}',
    'word.reviewCount': 'Review count: {count}',
    'word.zh': 'Chinese Translation',
    'word.exEn': 'Example (EN)',
    'word.exZh': 'Example (ZH)',
    'word.familiarity': 'Familiarity',
    'word.tags': 'Tags',
    'word.tags.none': 'No tags yet. Add on Home.',
    'word.play': 'Play',
    'word.playing': 'Playing...',
    'word.save': 'Save',
    'word.delete': 'Delete',
    'word.saved': 'Saved',
    'word.saved.message': '{word} updated',
    'word.confirmDelete.title': 'Delete Word',
    'word.confirmDelete.message': 'Delete "{word}"?',

    'settings.title': 'Settings',
    'settings.dailyLimit': 'Daily Limits',
    'settings.newLimit': 'New limit: {n}',
    'settings.reviewLimit': 'Review limit: {n}',
    'settings.rate': 'Rate',
    'settings.rate.hint': 'English rate: {n}/100',
    'settings.zhRate': 'Chinese rate',
    'settings.pitch': 'Pitch',
    'settings.pitch.hint': 'Pitch: {n}/100',
    'settings.wordFont': 'Word font size (list)',
    'settings.wordFont.value': 'Font: {n}px',
    'settings.enVoices': 'English voices',
    'settings.zhVoices': 'Chinese voices',
    'settings.loadingVoices': 'Loading voices...',
    'settings.systemDefault': 'System default',
    'settings.previewEn': 'Preview English voice',
    'settings.previewZh': 'Preview Chinese voice',
    'settings.language': 'Language',
    'settings.language.zh': 'Traditional Chinese',
    'settings.language.en': 'English',

    'review.title': 'Review',
    'review.done': 'Completed',
    'review.noCandidates': 'No words to review',
    'review.back': 'Back',
    'review.loop.done.title': 'All done',
    'review.loop.done.message': 'Review again?',
    'review.loop.again': 'Review again',
    'review.loop.finish': 'Finish',
    'review.hearAgain': 'Hear again',
    'review.next': 'Next',
    'review.removeReviewTag': 'Too easy, remove Review tag',

    // Exam
    'exam.word.title': 'Word Exam',
    'exam.word.progress': 'Question {index} / {total}',
    'exam.word.noChinese': '(No Chinese translation)',
    'exam.word.speak': 'Speak',
    'exam.word.input.placeholder': 'Type the English word and press Enter to submit',
    'exam.word.removeTag': 'Remove exam tag',
    'exam.word.correct': 'Correct!',
    'exam.word.wrong': 'Spelling is incorrect',
    'exam.word.empty.title': 'No words marked for exam',
    'exam.word.empty.hint': 'Go back to the Tags tab and add the exam tag ({tag}) to the words you need.',

    // Reading
    'reading.toolbar.pickFile': 'Open TXT',
    'reading.toolbar.clear': 'Clear',
    'reading.file.readFailed': 'Failed to read file',
    'reading.file.from': 'Source: {name}',
    'reading.placeholder.input': 'Paste or type article content',
    'reading.placeholder.hint': 'Paste or load an article, then tap words to look up.',
    'reading.tags.header': 'Default tags',
    'reading.tags.none': '(Not selected)',
    'reading.tags.hint': 'New words will apply tags above and always include the Review tag.',
    'reading.tags.mandatory': ' (required)',
    'reading.section.article': 'Article',
    'reading.modal.ai': 'AI Fill',
    'reading.modal.lookupLoading': 'Looking up...',
    'reading.modal.noData': 'No data',
    'reading.modal.addWord': 'Add Word',
    'reading.modal.speak': 'Speak',
    'reading.modal.close': 'Close',

    'common.tryLater': 'Please try again later',
  },
} as const;

type Dict = typeof dict['zh-TW'];

const I18nContext = createContext<{
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: keyof Dict | string, params?: Record<string, string | number>) => string;
} | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('zh-TW');
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(LANG_KEY);
        if (saved === 'en' || saved === 'zh-TW') setLocaleState(saved);
      } catch {}
    })();
  }, []);

  const setLocale = async (l: Locale) => {
    setLocaleState(l);
    try { await AsyncStorage.setItem(LANG_KEY, l); } catch {}
  };

  const t = useMemo(() => {
    const table = dict[locale];
    return (key: keyof Dict | string, params?: Record<string, string | number>) => {
      const raw = (table as any)[key] ?? key;
      if (!params) return raw;
      return Object.keys(params).reduce((s, k) => s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(params[k]!)), raw);
    };
  }, [locale]);

  return <I18nContext.Provider value={{ locale, setLocale, t }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
