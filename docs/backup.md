# 匯出／匯入備份指南

本文整理 Halo Word 匯出與匯入備份的實作細節、各平台差異以及操作步驟，協助後續開發者快速掌握維護重點。

## 功能概述

- 匯出：呼叫 `buildBackupPayload` 取得所有關鍵儲存鍵值，依平台生成檔案並提示使用者儲存或分享。
- 匯入：透過檔案選擇器載入 JSON，轉交 `applyBackupPayload`，由既有的 `saveWords`／`saveTags` 正規化資料，再同步其餘偏好設定。
- 全流程都會觸發 `haloWord.refreshAll()`（若存在），避免重新整理前的畫面殘留舊資料。
- 文章收藏（規劃中）：新增 `@halo_articles`、`@halo_article_tags`、`@halo_article_tag_order` 等鍵值後，匯出匯入流程會一併帶出收藏文章與其分類；若舊備份缺少這些欄位，匯入時預設為空陣列。

## 平台行為差異

| 平台 | 匯出流程 | 匯入流程 |
| ---- | -------- | -------- |
| Web  | 產生 `Blob`，建立隱藏 `<a>` 觸發下載。 | 使用 `expo-document-picker` 取得 `File`／`Blob`，優先呼叫 `File.text()`，必要時以 `fetch(blobUri)` 讀取內容。 |
| Android | 要求 SAF 目錄權限後建立檔案寫入 JSON。 | `DocumentPicker` 會提供本地 URI，透過 `FileSystem.readAsStringAsync` 讀取。 |
| 其他原生平台 | 寫入 `FileSystem.cacheDirectory` 後呼叫分享面板。 | 同樣使用 `FileSystem.readAsStringAsync` 解析檔案內容。 |

> `utils/backup.ts` 內的 `readTextFromAsset` 會依資產型態（`File`, `Blob`, `uri`）選用對應讀取方式並提供一致的錯誤訊息。

## 操作步驟（Runbook）

1. **啟動開發伺服器**
   - 確認 8081～8083 沒有殘留行程，必要時以 `netstat -ano` 查詢並結束。
   - 在專案根目錄執行：  
     ```powershell
     Start-Process -FilePath npx.cmd -ArgumentList 'expo','start','--web','--port','8090','--clear','--non-interactive' -WorkingDirectory $PWD
     ```
   - 等待 `http://localhost:8090` 開啟。
2. **匯入驗證**
   - 打開設定頁點「從裝置匯入」，選擇備份 JSON。
   - 匯入完成後開啟 DevTools Console，輸入：
     ```js
     localStorage.getItem('@halo_words')
     ```
     確認內容非 `[]`。
   - 若已導入文章收藏功能，額外確認：
     ```js
     localStorage.getItem('@halo_articles')
     ```
     應能看到 JSON 陣列；空陣列代表尚未收藏資料。
3. **重新整理**
   - 重新整理 Expo Web 或重新啟動 App，確認單字列表／設定已更新。
4. **匯出驗證**
   - 點選「匯出到裝置」，在 Web 應產生 `MM-DD-YYYY-en-study-backup-<timestamp>.json`，開啟檔案確認內含 `schemaVersion` 與 `payload`。

## 常見錯誤排查

- **瀏覽器下載失敗**：大多是快取或權限問題，錯誤訊息將顯示在 alert 中。可嘗試調整瀏覽器設定或改用無痕視窗測試。
- **`檔案內容不是有效的 JSON`**：備份檔遭修改或格式錯誤，請重新匯出備份。
- **Expo Web 沒有更新畫面**：確認 `haloWord.refreshAll` 是否可呼叫，或直接重新整理頁面。

## 開發與品保建議

- 修改匯出／匯入程式碼後，記得在 Web 與至少一個原生平台各測試一次。
- 建議在 PR 中附上以下指令結果：
  - `npm run lint`
  - `npm run test`
  - `npx tsc --noEmit`（目前會因缺少 `@types/react-dom` 提示警告，可視情況補上型別或記錄於 PR 說明）。
- 如需模擬使用者資料，可利用 `utils/storage.ts` 的 `saveWords`／`saveTags` 直接寫入假資料，再進行匯出比對；文章收藏完成實作後，補上對 `saveArticles`（或對應模組）的假資料流程確保備份一致。

## 版本歷程

- **2025-10-20**：重構 Web 匯入／匯出流程，解決 Expo Web 無法下載或解析備份檔的問題，並新增平台專屬錯誤處理。
