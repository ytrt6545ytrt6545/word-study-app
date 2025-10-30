import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';

import { loadArticleTagOrder, loadArticleTags, loadArticles, saveArticleTagOrder, saveArticleTags, saveArticles } from './articles';
import { loadTags, loadWords, saveTags, saveWords } from './storage';
import type { Word } from './storage';

// 備份模組：封裝 AsyncStorage 鍵值的匯入匯出，支援 Google Drive、檔案系統與本機 JSON。
// 資料流分成三層：
// 1. BACKUP_KEYS 定義要同步的偏好與資料表（單字、標籤、文章、TTS、SRS 等）。
// 2. build/apply 函式負責在多個端點之間序列化與還原資料。
// 3. export/import/upload/download 則處理對外管道（本機檔案、雲端、共享面板）。
// Minimal Google Drive helpers for appDataFolder backup/restore.
// These functions expect a valid OAuth access token with scope
// https://www.googleapis.com/auth/drive.appdata

// 備份覆蓋的鍵值清單：保持順序可確保日後 diff 與備份版本一致。
export const BACKUP_KEYS = [
  '@halo_words',
  '@halo_tags',
  '@halo_tag_order',
  '@halo_articles',
  '@halo_article_tags',
  '@halo_article_tag_order',
  '@srs_limits',
  '@srs_daily_stats',
  '@pref_word_font_size',
  '@tts_rate_percent',
  '@tts_gender',
  '@tts_pitch_percent',
  '@tts_voice_en',
  '@tts_voice_zh',
  '@tts_rate_zh',
  '@tts_pause_comma_ms',
  '@tts_pause_sentence_ms',
  '@word_sort_desc',
  '@lang_locale',
];

// 將關聯鍵值一次打包成統一結構，方便寫入雲端或本機備份檔。
// payload 內每個 key 都維持字串型別，利於不同平台序列化與除錯。
export async function buildBackupPayload(): Promise<{ schemaVersion: number; updatedAt: string; payload: Record<string, string | null> }> {
  const pairs = await AsyncStorage.multiGet(BACKUP_KEYS);
  const payload: Record<string, string | null> = {};
  for (const [k, v] of pairs) payload[k] = v ?? null;
  return {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    payload,
  };
}

// 匯入備份時按鍵值覆寫或移除，並回寫文章、標籤相關結構避免格式殘留。
// 操作流程：
// 1. 解析 payload，先記錄要刪除（null）與要覆寫的鍵。
// 2. 使用 AsyncStorage.multiRemove/multiSet 批次更新，減少 I/O 次數。
// 3. 對核心資料（單字、標籤、文章）再走一次 normalize 流程，確保 schema 正確。
export async function applyBackupPayload(obj: any): Promise<void> {
  if (!obj || typeof obj !== 'object' || typeof obj.payload !== 'object') {
    throw new Error('備份檔案格式不正確（缺少 payload）。');
  }

  const payload = obj.payload as Record<string, unknown>;
  const toRemove: string[] = [];
  const toSet: [string, string][] = [];

  for (const key of Object.keys(payload)) {
    const value = payload[key];
    if (value === null || value === undefined) {
      toRemove.push(key);
      continue;
    }
    if (typeof value === 'string') {
      toSet.push([key, value]);
      continue;
    }
    try {
      toSet.push([key, JSON.stringify(value)]);
    } catch (error) {
      console.warn('[backup] 無法序列化備份欄位', key, error);
    }
  }

  if (toRemove.length > 0) {
    await AsyncStorage.multiRemove(toRemove);
  }
  if (toSet.length > 0) {
    await AsyncStorage.multiSet(toSet);
  }

  const touchedKeys = new Set(Object.keys(payload));
  if (touchedKeys.has('@halo_words')) {
    const rawWords = payload['@halo_words'];
    if (typeof rawWords === 'string') {
      try {
        const parsed = JSON.parse(rawWords);
        if (Array.isArray(parsed)) {
          await saveWords(parsed as Word[]);
        }
      } catch (error) {
        console.warn('[backup] 匯入單字資料解析失敗，改用既有正規化流程', error);
        const normalizedFallback = await loadWords();
        await saveWords(normalizedFallback);
      }
    } else {
      const normalizedFallback = await loadWords();
      await saveWords(normalizedFallback);
    }
  }
  if (touchedKeys.has('@halo_tags')) {
    const rawTags = payload['@halo_tags'];
    if (typeof rawTags === 'string') {
      try {
        const parsed = JSON.parse(rawTags);
        if (Array.isArray(parsed)) {
          await saveTags(parsed as string[]);
        }
      } catch (error) {
        console.warn('[backup] 匯入標籤資料解析失敗，改用既有正規化流程', error);
        const tagsFallback = await loadTags();
        await saveTags(tagsFallback);
      }
    } else {
      const tagsFallback = await loadTags();
      await saveTags(tagsFallback);
    }
  }
  if (touchedKeys.has('@halo_articles')) {
    const rawArticles = payload['@halo_articles'];
    if (typeof rawArticles === 'string') {
      try {
        const parsed = JSON.parse(rawArticles);
        if (Array.isArray(parsed)) {
          await saveArticles(parsed as any[]);
        }
      } catch (error) {
        console.warn('[backup] 匯入文章資料解析失敗，改用既有正規化流程', error);
        const fallback = await loadArticles();
        await saveArticles(fallback);
      }
    } else {
      const fallback = await loadArticles();
      await saveArticles(fallback);
    }
  }
  if (touchedKeys.has('@halo_article_tags')) {
    const rawArticleTags = payload['@halo_article_tags'];
    if (typeof rawArticleTags === 'string') {
      try {
        const parsed = JSON.parse(rawArticleTags);
        if (Array.isArray(parsed)) {
          await saveArticleTags(parsed as string[]);
        }
      } catch (error) {
        console.warn('[backup] 匯入文章標籤解析失敗，改用既有正規化流程', error);
        const fallback = await loadArticleTags();
        await saveArticleTags(fallback);
      }
    } else {
      const fallback = await loadArticleTags();
      await saveArticleTags(fallback);
    }
  }
  if (touchedKeys.has('@halo_article_tag_order')) {
    const rawArticleTagOrder = payload['@halo_article_tag_order'];
    if (typeof rawArticleTagOrder === 'string') {
      try {
        const parsed = JSON.parse(rawArticleTagOrder);
        if (parsed && typeof parsed === 'object') {
          await saveArticleTagOrder(parsed as any);
        }
      } catch (error) {
        console.warn('[backup] 匯入文章標籤排序失敗，改用既有正規化流程', error);
        const fallback = await loadArticleTagOrder();
        await saveArticleTagOrder(fallback);
      }
    } else {
      const fallback = await loadArticleTagOrder();
      await saveArticleTagOrder(fallback);
    }
  }
}

async function findExisting(token: string): Promise<string | undefined> {
  const q = encodeURIComponent("name = 'backup.json' and trashed = false");
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${q}&fields=files(id,name,modifiedTime)&pageSize=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Drive list failed');
  const json = await res.json();
  return json.files?.[0]?.id as string | undefined;
}

// 透過 appDataFolder API 將最新備份上傳至使用者的 Google Drive。
// 若雲端已有舊檔，會先刪除再建立，以維持單一備份並避免空間膨脹。
export async function uploadBackupToDrive(token: string, bodyJson?: any): Promise<void> {
  const dataObj = bodyJson ?? (await buildBackupPayload());
  const meta = JSON.stringify({ name: 'backup.json', parents: ['appDataFolder'] });
  const data = JSON.stringify(dataObj);
  const boundary = 'batch_' + Date.now();
  const multipartBody =
    `--${boundary}\n` +
    'Content-Type: application/json; charset=UTF-8\n\n' +
    `${meta}\n` +
    `--${boundary}\n` +
    'Content-Type: application/json\n\n' +
    `${data}\n` +
    `--${boundary}--`;

  const id = await findExisting(token);
  const url = id
    ? `https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=multipart`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
  const method = id ? 'PATCH' : 'POST';
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipartBody,
  });
  if (!res.ok) throw new Error('Drive upload failed');
}

// 從 appDataFolder 取得最近的備份檔案，找不到時回傳 null。
// 呼叫端可依結果決定是否顯示「尚未備份」提醒。
export async function downloadLatestBackupFromDrive(token: string): Promise<any | null> {
  const id = await findExisting(token);
  if (!id) return null;
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Drive download failed');
  const text = await res.text();
  try { return JSON.parse(text); } catch { return null; }
}

// ---- Local (device) backup/import helpers ----

function formatBackupFileName(now = new Date()): string {
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const yyyy = String(now.getFullYear());
  const stamp = now.getTime();
  return `${mm}-${dd}-${yyyy}-en-study-backup-${stamp}.json`;
}

function triggerGlobalRefresh(): void {
  if (typeof window !== 'undefined' && (window as any).haloWord?.refreshAll) {
    try { (window as any).haloWord.refreshAll(); } catch {}
  }
}

async function exportBackupOnWeb(json: string, fileName: string): Promise<string> {
  try {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    triggerGlobalRefresh();
    return '已下載備份檔：' + fileName;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err ?? '');
    throw new Error('瀏覽器下載失敗：' + message);
  }
}

async function exportBackupOnAndroid(json: string, fileName: string): Promise<string> {
  const perm = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!perm.granted) throw new Error('未授予資料夾權限');
  const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
    perm.directoryUri,
    fileName,
    'application/json'
  );
  await FileSystem.StorageAccessFramework.writeAsStringAsync(fileUri, json, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  triggerGlobalRefresh();
  return '已匯出檔案：' + fileName;
}

async function exportBackupViaShare(json: string, fileName: string): Promise<string> {
  const baseDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
  if (!baseDir) throw new Error('找不到暫存資料夾，無法建立備份檔。');
  const tmp = baseDir + fileName;
  await FileSystem.writeAsStringAsync(tmp, json, { encoding: FileSystem.EncodingType.UTF8 });
  try {
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(tmp, { dialogTitle: '匯出備份' });
    }
  } catch {}
  triggerGlobalRefresh();
  return '已匯出備份檔案';
}

// 匯出成 JSON 檔並寫到裝置的 Cache 目錄，回傳檔案路徑供分享或下載。
export async function exportBackupToDevice(): Promise<string> {
  const dataObj = await buildBackupPayload();
  const json = JSON.stringify(dataObj, null, 2);
  const fileName = formatBackupFileName();

  // 依平台選擇最貼近使用者體驗的出口：
  // - Web：直接觸發瀏覽器下載。
  // - Android：透過 SAF 讓使用者挑選目的資料夾。
  // - 其他（iOS 等）：寫入 cache 後啟動分享選單。
  if (Platform.OS === 'web') {
    return exportBackupOnWeb(json, fileName);
  }
  if (Platform.OS === 'android') {
    return exportBackupOnAndroid(json, fileName);
  }
  return exportBackupViaShare(json, fileName);
}

async function readTextFromAsset(asset: any): Promise<string> {
  if (!asset) throw new Error('沒有可讀取的檔案。');

  if (asset.file && typeof asset.file === 'object') {
    const fileObj = asset.file as any;
    if (typeof fileObj.text === 'function') {
      return await fileObj.text();
    }
    const FileReaderCtor: any = typeof globalThis !== 'undefined' ? (globalThis as any).FileReader : undefined;
    if (typeof FileReaderCtor === 'function') {
      const reader = new FileReaderCtor();
      const asText = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : String(reader.result ?? ''));
        reader.onerror = () => reject(reader.error ?? new Error('讀取檔案失敗'));
        try { reader.readAsText(fileObj); } catch (error) { reject(error); }
      });
      return asText;
    }
  }

  const uri: string | undefined = asset.uri || asset.file?.uri;
  if (!uri) throw new Error('無法讀取檔案內容（缺少 URI）。');

  if (Platform.OS === 'web' && uri.startsWith('blob:')) {
    const res = await fetch(uri);
    if (!res.ok) throw new Error('下載檔案內容失敗（HTTP ' + res.status + '）。');
    return await res.text();
  }

  return await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.UTF8 });
}

// 從使用者選擇的 JSON 檔讀取備份內容並套用至本機。
// 流程會依平台選擇適合的檔案挑選器，並將檔案內容轉成字串再解析成 JSON。
export async function importBackupFromDevice(): Promise<any | null> {
  if (Platform.OS === 'web') {
    try {
      const result: any = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        multiple: false,
        copyToCacheDirectory: false,
      });
      if (!result || result.canceled) return null;
      const asset = result.assets?.[0] ?? result;
      const text = await readTextFromAsset(asset);
      try { return JSON.parse(text); } catch { throw new Error('檔案內容不是有效的 JSON'); }
    } catch (err: any) {
      const message = String(err?.message || '');
      if (message.includes('cancel')) return null;
      throw err;
    }
  }

  const res: any = await DocumentPicker.getDocumentAsync({
    type: 'application/json',
    multiple: false,
    copyToCacheDirectory: true,
  });
  if (!res || res.canceled) return null;
  const asset: any = res.assets?.[0] ?? res;
  const text = await readTextFromAsset(asset);
  try { return JSON.parse(text); } catch { throw new Error('檔案內容不是有效的 JSON'); }
}

