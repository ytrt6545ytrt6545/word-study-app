import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';

import { loadTags, loadWords, saveTags, saveWords, type Word } from './storage';

// Minimal Google Drive helpers for appDataFolder backup/restore.
// These functions expect a valid OAuth access token with scope
// https://www.googleapis.com/auth/drive.appdata

export const BACKUP_KEYS = [
  '@halo_words',
  '@halo_tags',
  '@halo_tag_order',
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

export async function exportBackupToDevice(): Promise<string> {
  const dataObj = await buildBackupPayload();
  const json = JSON.stringify(dataObj, null, 2);
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const yyyy = String(now.getFullYear());
  const stamp = now.getTime();
  const fileName = `${mm}-${dd}-${yyyy}-en-study-backup-${stamp}.json`;

  const triggerRefresh = () => {
    if (typeof window !== 'undefined' && (window as any).haloWord?.refreshAll) {
      try { (window as any).haloWord.refreshAll(); } catch {}
    }
  };

  if (Platform.OS === 'web') {
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
      triggerRefresh();
      return '已下載備份檔：' + fileName;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err ?? '');
      throw new Error('瀏覽器下載失敗：' + message);
    }
  }

  if (Platform.OS === 'android') {
    const perm = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (!perm.granted) throw new Error('未授予資料夾權限');
    const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
      perm.directoryUri,
      fileName,
      'application/json'
    );
    await FileSystem.StorageAccessFramework.writeAsStringAsync(fileUri, json, { encoding: FileSystem.EncodingType.UTF8 });
    triggerRefresh();
    return '已匯出檔案：' + fileName;
  }

  const tmp = FileSystem.cacheDirectory + fileName;
  await FileSystem.writeAsStringAsync(tmp, json, { encoding: FileSystem.EncodingType.UTF8 });
  try { await Sharing.shareAsync(tmp, { dialogTitle: '匯出備份' }); } catch {}
  triggerRefresh();
  return '已匯出備份檔案';
}



export async function importBackupFromDevice(): Promise<any | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: 'application/json',
    multiple: false,
    copyToCacheDirectory: true,
  });
  const asset: any = (res as any)?.assets?.[0] ?? (res as any);
  if (!asset || asset.canceled) return null;
  const uri: string = asset.uri || asset.file?.uri;
  if (!uri) return null;
  const text = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.UTF8 });
  try { return JSON.parse(text); } catch { throw new Error('檔案內容不是有效的 JSON'); }
}

