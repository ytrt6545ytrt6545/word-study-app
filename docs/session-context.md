請用中文溝通(不要刪這條)
當我說起動WEB時請透過 Start-Process 在背景啟動(不要刪這條)
當我說結束工作時請把這次對話視窗所執行的工作成果及需要交接的資訊更新交接的檔案，讓下次開新視窗時，新的AI能快速了解情況。(不要刪這條)
閱讀 README.md 了解程式(不要刪這條)
# Session Context

- 專案現況：優化中，主要功能穩定運作
- 最新進度：
  - 解決 TypeScript `@types/react-dom` 缺少問題，更新型別後 `npx tsc --noEmit` 可順利通過。
  - 新增備份流程測試 (`tests/backup.spec.ts`)，涵蓋文章匯入匯出的正常路徑與 fallback 行為。
  - 收藏庫頁面（`app/(tabs)/articles.tsx`）調整 Web 平台刪除流程並新增卡片點擊導向閱讀頁。
  - 閱讀頁（`app/(tabs)/reading.tsx`）支援以 `articleId` 參數載入收藏，會自動帶入文章內容與標籤。
- 正在處理：
  - 進一步驗證收藏流程在 Web 的匯出／匯入實測與資料一致性。
  - 評估是否需補充額外型別宣告，確保後續套件升級時維持 TypeScript 穩定。
- 阻塞問題：無（Expo Web 已可使用 8090 埠成功啟動）
- 特別指示：
  1. 需要啟動 Web 時，參考下方「匯出／匯入 Runbook」步驟 1。
  2. 匯入後請在瀏覽器 DevTools Console 執行 `localStorage.getItem('@halo_words')` 檢查資料是否更新。
  3. 匯入後重新整理 Expo Web 或重啟 App 以讀取最新資料。

## 建議先閱讀
1. docs/overview.md（專案摘要與功能結構）
2. app.config.ts、app.json（Expo 與環境設定）
3. app/ 目錄（主要路由與畫面）
4. components/、hooks/（共用元件與邏輯）

## 常用指令
- npm run init-ai-context
- npm run start
- npm run test
- npx tsc --noEmit

## 其他提醒
- 避免修改 android-keys/ 與 credentials.json 等敏感檔案
- 若遇到中文亂碼，確認終端機與檔案皆使用 UTF-8 編碼
- 朗讀流程依賴 `getSpeechOptions` 取得語速與音高，調整設定後記得重新整理 Expo Web

## 近期工作重點

### 閱讀後文章收藏與分類方案

- 目標：在閱讀流程結束時提供一鍵收藏入口，預設擷取標題、來源、時間與摘要，支援後續整理。
- 流程：閱讀頁面新增「加入收藏」按鈕，收藏後可在「收藏庫」畫面依分類／標籤與關鍵字搜尋檢視。
- 資料結構：延伸既有備份 JSON，新增 `@halo_articles` 儲存文章實體並納入匯出匯入流程，維持 `schemaVersion = 1`。
- 自動化：初期採手動／簡易規則分類，未來可導入推薦或摘要服務。
- UI/UX：閱讀頁有收藏入口、收藏庫提供標籤篩選與狀態標示，後續可擴充搜尋與重點標記。
- 待辦：驗證閱讀資料是否能直接帶入收藏、敲定資料 schema、規劃前端 UI 與儲存 API、補齊測試與備份驗證。

#### 資料結構與儲存鍵值（2025-10-21）

- Article 型別欄位包含 `id`、`title`、`sourceType`、`sourceRef`、`rawText`、`summary`、`tags`、`status`、`createdAt`、`updatedAt`、`highlights` 等，必要時可擴充。
- 儲存鍵值：`@halo_articles`、`@halo_article_tags`、`@halo_article_tag_order`，若未來共用標籤再評估整併策略。
- 備份整合：上述鍵值已加入 `utils/backup.ts` 的 `BACKUP_KEYS`，匯入缺少欄位時以預設值回填，確保舊備份相容。

#### 待討論／實作待辦

- Article 欄位預設值與 TypeScript 型別繼續調整（如 `status`、`highlights`、`linkedWords`）。
- 強化匯出／匯入流程文件與測試，特別是 `@halo_articles`、`@halo_article_tags` 的驗證。
- 評估 UI 是否需要補強搜尋、分類、重點標記與資料視覺化。
- 規劃驗證流程（手動／自動化），覆蓋匯入匯出、資料遺失防護、標籤同步等情境。

#### 儲存層 API 規劃

- `utils/articles.ts` 已提供 `loadArticles`、`saveArticles`、`createArticle`、`updateArticle`、`deleteArticle`、`getArticleById`、以及標籤與 highlight 操作。
- 與閱讀頁互動可透過 helper 正規化輸入，減少重複邏輯。
- 若要保留「重點標記」陣列，建議提供 `addHighlight`、`updateHighlight`、`removeHighlight` 等 helper。

## 備份與驗證計畫

- `@halo_articles`、`@halo_article_tags`、`@halo_article_tag_order` 已納入備份鍵值並具備 fallback。
- 建議測試：
  1. 手動匯出 → 清空資料 → 匯入 → 檢查 `localStorage` 與收藏庫畫面。
  2. 單元測試：模擬舊／新備份 JSON，驗證 `applyBackupPayload` 正確落地資料。
  3. 還原驗證：`loadArticles` 應補齊時間戳與狀態預設值。
  4. UI 流程：從閱讀頁收藏 → 收藏庫檢視 → 匯出 → 清除 → 匯入 → 再次檢視收藏庫。

## 匯出／匯入 Runbook（Web）

1. 使用 PowerShell 確認 8081～8083 未被占用，如有殘留行程請結束：
   ```powershell
   netstat -ano | Select-String ':8081|:8082|:8083'
   ```
2. 在專案根目錄透過 `Start-Process` 背景啟動 Expo Web：
   ```powershell
   Start-Process -FilePath npx.cmd -ArgumentList 'expo','start','--web','--port','8090','--clear','--non-interactive' -WorkingDirectory (Get-Location)
   ```
3. 連到 `http://localhost:8090`，於設定頁執行「從裝置匯入」並選擇備份 JSON。
4. 匯入後開啟 DevTools Console，確認：
   ```js
   localStorage.getItem('@halo_words')
   ```
   若為 `[]` 或空值，請截圖或貼上文字回報。
5. 重新整理頁面或重啟 App，確認資料更新；必要時再執行「匯出到裝置」檢查檔案內容。

## 交接紀錄（2025-10-27）
- 已完成：閱讀頁新增「從圖片匯入」功能，使用 `expo-image-picker@15.0.7` 擷取圖片並呼叫 OpenAI Vision 將辨識結果貼入輸入框，搭配載入狀態與錯誤提示。
- `utils/ai.ts` 擴充圖片 OCR helper、繁體中文強制轉換（使用 `chinese-conv`）與錯誤訊息格式化（429 限速顯示中文資訊）。
- 新增依賴：`expo-image-picker`、`chinese-conv`，並建立 `types/chinese-conv.d.ts`。
- 待確認：在 Web 與真機環境檢查圖片權限流程與繁體轉換後的朗讀效果，必要時加入 OCR 重試與備援方案。
- 風險：OpenAI API 目前仍可能觸發 TPM 限制，若持續出現 429 需評估升級帳號或改用替代金鑰。
