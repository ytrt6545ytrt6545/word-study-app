# Halo Word 新手開發指南

本文協助第一次接觸 Halo Word 的開發者在最短時間內理解專案目標、環境需求、主要程式架構與常見流程。閱讀順序建議依章節從上到下，並搭配 `README.md`、`docs/overview.md` 與 `docs/session-context.md` 一併參考。

---

## 1. 專案概觀

- **定位**：一款以 Expo Router 建構的 React Native 應用，協助使用者管理英文字彙、進行測驗與閱讀練習，並支援 OpenAI 提供範例句與翻譯。
- **主要平台**：Expo Web、Android（可透過 prebuild + Gradle 產出 APK），iOS 尚未設定。
- **核心能力**
  - 單字資料庫（AsyncStorage）與標籤階層管理。
  - AI 例句／翻譯（`utils/ai.ts`）與圖片 OCR。
  - 閱讀頁面支援從圖片匯入文本、標註生字並加入收藏。
  - 匯入匯出備份（本機 JSON / Google Drive appDataFolder）。

---

## 2. 環境需求與初始化

1. **系統需求**
   - Node.js 20+、npm 10+。
   - Windows 開發者請先確認有執行 PowerShell 7 或相容版本。
   - Android SDK / Gradle 相關工具若需本機建置 APK，請先安裝並確保路徑為 ASCII。

2. **專案初始化**
   ```bash
   npm install
   ```
   - 第一次啟動前建立 `.env`，至少填入 `EXPO_PUBLIC_OPENAI_API_KEY=<你的 key>`。
   - `.env` 已加入 `.gitignore`，勿提交到版本庫。

3. **環境變數腳本（Windows）**
   - 每次開新 shell 建議先執行：
     ```powershell
     powershell -ExecutionPolicy Bypass -File .\scripts\setup-android-build-env.ps1
     ```
   - 目的：將 `GRADLE_USER_HOME`、`ANDROID_PREFAB_HOME`、`TMP/TEMP` 等變數指向 ASCII 路徑（如 `C:\word-study-app\.gradle-cache`、`C:\temp`），避免預設使用者目錄含特殊字元導致 Gradle Prefab 錯誤。
   - 若想永久生效可加上 `-Persist`。

4. **開發伺服器**
   ```bash
   npx expo start
   ```
   - Expo Web 預設埠為 8090，可使用 Expo Go 或瀏覽器預覽。

5. **常用指令**
   - `npm run init-ai-context`：同步 AI 模型相關設定（若有新增 Prompt 模板）。
   - `npm run start`：啟動 Expo 開發伺服器。
   - `npm run test`：執行 Vitest 測試。
   - `npx tsc --noEmit`：靜態型別檢查。
   - `npx expo-doctor`：Expo 環境診斷（CI 亦會執行）。

---

## 3. 專案結構速覽

| 目錄 / 檔案 | 說明 |
| --- | --- |
| `app/` | Expo Router 頁面。`(tabs)` 為底部分頁，`add/`、`exam/` 等為獨立路由。 |
| `components/` | 共用展示元件（`ParallaxScrollView`、`ThemedText` 等）。 |
| `context/TabMarkContext.tsx` | 紀錄最近造訪的頁籤，提供分頁狀態同步。 |
| `hooks/` | 自訂 Hook（色彩、主題等，目前以樣板為主）。 |
| `utils/storage.ts` | 單字、標籤、SRS 設定的存取層。 |
| `utils/articles.ts` | 閱讀收藏用文章資料、標籤與 highlights 管理。 |
| `utils/ai.ts` | OpenAI 文字補全與 OCR 呼叫、錯誤處理。 |
| `utils/tts.ts` | 語音設定（語速、音高、語者、停頓）。 |
| `utils/backup.ts` | 匯入匯出備份、Google Drive 同步。 |
| `docs/` | 專案文件（`overview.md`、本指南等）。 |
| `scripts/` | 開發輔助腳本（環境設定、重置工具）。 |

---

## 4. 核心資料與流程

### 4.1 單字與標籤
- 儲存在 AsyncStorage：
  - `@halo_words`（單字列表）、`@halo_tags`、`@halo_tag_order`。
  - 型別定義、正規化與儲存邏輯見 `utils/storage.ts`。
- 標籤最多三層，使用 `>` 分隔，例如 `生活 > 日常 > 早餐`。
- 測驗流程依 `EXAM_TAG` 標籤篩選題目（`app/exam/word.tsx`）。

### 4.2 文章收藏
- `utils/articles.ts` 定義 `Article` 型別、CRUD 與 highlights。
- 收錄於 AsyncStorage：`@halo_articles`、`@halo_article_tags`、`@halo_article_tag_order`。
- 閱讀頁 (`app/(tabs)/reading.tsx`) 支援：
  1. 直接貼上文字或根據 `articleId` 載入。
  2. 使用 DocumentPicker + `recognizeImageText` 將圖片轉文字。
  3. 點擊單字呼叫 `aiCompleteWord` 取得翻譯與例句。
  4. 建立標籤並收藏到文章庫。

### 4.3 AI 與語音
- 所有 AI 呼叫集中在 `utils/ai.ts`：
  - `aiCompleteWord`：產生英文／中文、例句、音標。
  - `recognizeImageText`：透過 GPT-4o-mini OCR 圖片。
  - 內建網路／瀏覽器環境錯誤訊息與 DEV fallback。
- 語音設定 (`utils/tts.ts`)：
  - 主要鍵值：語速比例（英/中）、音高百分比、語者 ID、逗號／句尾停頓。
  - `getSpeechOptions` 回傳 Expo Speech 可直接使用的參數。

### 4.4 備份與同步
- `utils/backup.ts` 具備三種管道：
  1. **本機 JSON**：`exportBackupToDevice`、`importBackupFromDevice`。
  2. **Google Drive appDataFolder**：`uploadBackupToDrive`、`downloadLatestBackupFromDrive`。
  3. **AsyncStorage 批次處理**：`buildBackupPayload`、`applyBackupPayload`。
- 建議在進行匯入時先備份一次，以便回復。
- 匯入成功後可檢查 `LocalStorage`（Expo Web）或重新讀取頁面確認資料一致。

---

## 5. 常見開發流程

### 5.1 新增功能
1. 參考 `docs/overview.md` 確認資料結構與現有邏輯。
2. 在對應的 `app/**` 路由新增畫面或元件。
3. 使用 `utils/storage.ts` / `utils/articles.ts` 對資料操作，不直接呼叫 AsyncStorage。
4. 如需 AI 功能，擴充 `utils/ai.ts`：保持統一錯誤訊息與 fallback。
5. 撰寫或更新測試（`tests/` 資料夾），例如 `tests/backup.spec.ts`。
6. 執行 `npm run lint`、`npm run test`、`npx tsc --noEmit`。

### 5.2 調整語音或閱讀體驗
1. 變更 `utils/tts.ts` 的對應設定函式或增加新的偏好鍵值。
2. 設定頁 (`app/(tabs)/settings.tsx`) 透過滑桿、下拉選單呼叫對應儲存函式。
3. 閱讀頁重新讀取 `getSpeechOptions`、`loadPauseConfig` 即可生效。

### 5.3 匯出／匯入備份
1. 自備份頁或設定頁呼叫備份函式。
2. 若使用 Google Drive，確保登入流程已取得 `accessToken`（範例在 `settings.tsx`）。
3. 匯入後建議重新開啟 `explore` / `reading` / `articles` 分頁確認資料。

### 5.4 建置 Android APK
1. 執行 `npx expo prebuild --platform android`（初次或有原生套件異動）。
2. 刪除舊輸出：`Remove-Item -Recurse -Force android/app/build/outputs/apk/release`。
3. 於 `android/` 目錄執行：
   ```powershell
   ./gradlew.bat assembleRelease
   ```
   - 若 Prefab 再次指向含特殊字元的使用者目錄，重跑環境腳本並確認 `C:\temp` 存取權限。
4. 成品：`android/app/build/outputs/apk/release/app-release.apk`。

---

## 6. 常見問題與排查建議

| 問題 | 排查步驟 |
| --- | --- |
| **AI 呼叫報錯** | 確認 `.env` 或 CI Secrets 是否設定 `EXPO_PUBLIC_OPENAI_API_KEY`。檢查網路是否阻擋 OpenAI，閱讀 `utils/ai.ts` 的錯誤訊息對應。 |
| **圖片匯入後無文字** | 檢查 `adb logcat | Select-String "reading :: onPickImage"` 是否有資產資訊；確保檔案大小 < 4MB。 |
| **Gradle Prefab 亂碼或缺模組** | 確認環境變數皆指向 ASCII 路徑、存在 `C:\temp`，必要時刪除 `.gradle-cache` 後重跑設定腳本。 |
| **TypeScript 報編碼錯誤** | 某些舊型別檔案使用非 UTF-8 字元，需手動調整或以 `iconv` 重新編碼。 |
| **Expo Web 匯入資料未更新** | 匯入後重新整理頁面或開啟 DevTools `localStorage.getItem('@halo_words')` 確認資料，再確認 hooks 是否有監聽變化。 |

---

## 7. 推薦閱讀順序

1. `README.md`：專案目標、開發流程、發版指引。
2. `docs/overview.md`：功能地圖、資料流、重要模組摘要。
3. `docs/session-context.md`：當前進度、近期重點與坑點提醒（保持同步更新）。
4. `docs/backup.md`（若需處理匯入匯出）。
5. 程式碼：從 `app/(tabs)` 與 `utils/**` 模組起手，對應各章節說明。

---

## 8. 一週內能貢獻的小任務建議

- 修正 `types/chinese-conv.d.ts` 的編碼問題，使 `npx tsc --noEmit` 全綠。
- 為 `utils/storage.ts` / `utils/articles.ts` 補充單元測試。
- 改善 `app/(tabs)/articles.tsx` 標籤篩選 UI（如搜尋或排序提示）。
- 完成設定頁的語系切換流程（目前 UI 已有切換器，可補強字串與驗證）。

---

## 9. 求助與協作

- **共同維護文件**：若新增功能或踩到坑，請更新 `docs/session-context.md` 與本指南，維持團隊對齊。
- **程式撰寫風格**：優先重用 `utils/**` 的封裝邏輯，避免重複呼叫 AsyncStorage；撰寫註解時聚焦行為或流程。
- **CI / 自動化**：`.github/workflows/ci.yml` 會在 PR 時執行 lint、test、tsc、expo-doctor；若新增指令，記得同步更新工作流程。

歡迎在 PR 附註測試步驟或錄製短影音，幫助審查者快速了解變更。祝開發順利！ 🎉

---

## 10. 視覺與體驗升級藍圖（未來重點）

- **統一設計語言**：定義品牌主色、輔色、警示色與字體階層，將卡片圓角、陰影、間距等 Style Token 集中在 `Resources/Styles.*`，確保 Expo 與未來 .NET MAUI 版本具有一致的外觀。
- **卡片化版面**：單字、文章、AI 結果頁面採卡片式佈局，搭配標籤 Chips、時間戳、進度條與空狀態插圖，提升資訊層次與可掃描性。
- **互動細節**：導入骨架載入（Skeleton）、列表進場動畫、按鈕縮放、錯誤與成功提示，營造商業級使用感受。
- **暗色主題與開場畫面**：支援 Light/Dark 雙主題，並規劃品牌化 Splash / Onboarding（展示賣點、開發者資訊或快速指引）。
- **行銷導向資訊**：在主頁呈現今日新增、連續學習天數或徽章系統，讓 UI 同時具有產品化指標與激勵效果。
