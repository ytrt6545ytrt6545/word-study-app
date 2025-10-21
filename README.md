# Halo Word（Expo App）

本專案是一個協助使用者記憶與複習英文字彙的 Expo/React Native 應用程式。專案已啟用 Expo Router、TypeScript 與 OpenAI API，並可透過 EAS 發佈 Android 測試包。

## 專案目標

- 以手機介面提供單字新增、標籤分類、測驗與複習等功能。
- 支援 AI 輔助產生例句、中文解釋與相關詞彙。
- 維持簡潔的程式架構與自動化流程，方便後續開發者接手維護。

## 專案結構

```
app/                  # Expo Router 頁面，含 (tabs)、add、exam 等功能畫面
components/           # 共用展示元件（ParallaxScrollView、ThemedText 等）
context/              # React Context（目前僅 TabMarkContext）
hooks/                # 自訂 React hooks
utils/                # 資料存取、AI 呼叫、備份等工具模組
assets/               # 應用程式使用的圖片、字型與音效
scripts/              # 工具腳本（例如 reset-project）
docs/                 # 額外的中文說明文件
.github/workflows/    # GitHub Actions CI 設定
```

詳細的模組說明與資料流可以參考 `docs/overview.md`。

## 開發環境要求

- Node.js 20 以上
- npm 10 以上
- Expo CLI（`npx expo` 會自動安裝）
- iOS／Android 模擬器或真機（視需求）

## 快速開始

1. 安裝相依套件

   ```bash
   npm install
   ```

2. 在專案根目錄建立 `.env`，至少填入 OpenAI API Key（下方有詳細說明）。

3. 啟動開發伺服器

   ```bash
   npx expo start
   ```

4. 使用 Expo Go、Android Studio 模擬器或真機掃描 QR Code，即可載入 App。

## 環境變數設定

專案透過 `.env` 讀取下列公開環境變數（Expo 以 `EXPO_PUBLIC_` 為前綴）：

- `EXPO_PUBLIC_OPENAI_API_KEY`：AI 產生例句與翻譯所需的金鑰。
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`、`EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID`、`EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`：Google OAuth 使用。
- `EXPO_PUBLIC_BUILD_DATE`：可選，預設自動帶入當次建置時間，若需指定固定值可手動覆寫。

> `.env` 已加入 `.gitignore`，請勿提交到版本庫。CI 中可透過 GitHub Secrets 設定 `EXPO_PUBLIC_OPENAI_API_KEY`。

若需要在 GitHub Actions 中進行 EAS 建置，請另外建立 `EAS_TOKEN` Secret。產生方式：登入 [expo.dev](https://expo.dev) → Account → Access tokens → 建立 Robot 使用者並生成 token。

## 發版與版本同步

1. 使用 `npm version <patch|minor|major>` 更新版本號。
2. `app.config.ts` 會讀取 `package.json` 的版本並自動計算 Android `versionCode`。
3. （可選）若需覆寫建置時間，再更新 `.env` 中的 `EXPO_PUBLIC_BUILD_DATE` 或在 CI Secret 中配置。
4. 執行 `npm run lint`、`npm run test`、`npx tsc --noEmit`、`npx expo-doctor` 確認品質。
5. 若要產生測試包，可使用 `eas build --platform android --profile preview`（CI 會使用 `--no-wait` 排程）。

## 自動化流程（GitHub Actions）

`.github/workflows/ci.yml` 會在以下情境觸發：

- Push 到 `main` 或 `master`
- 建立 Pull Request

流程內容：

- `quality` job：安裝依賴後依序執行 `npm run lint`、`npm run test`、`npx tsc --noEmit`、`npx expo-doctor`。
- `preview-build` job：若偵測到 `EAS_TOKEN` 已設定，會登入 EAS 並排程 Android preview build；若未設定則輸出提示訊息並跳過建置。

## 重要資料夾與模組介紹

- `app/(tabs)/explore.tsx`：AI 探索頁，提供輸入單字或中文後給 AI 產出解釋、例句等資訊。
- `app/(tabs)/settings.tsx`：設定頁，可切換語言、設定發音語音與顯示建置資訊。
- `app/exam/word.tsx`：單字測驗流程，會根據 `EXAM_TAG` 篩選單字並提供輸入檢查。
- `utils/ai.ts`：封裝呼叫 OpenAI API 的邏輯。
- `utils/storage.ts`：操作 AsyncStorage，負責儲存單字、標籤與備份。
- 更多細節請參考 `docs/overview.md`。

## 開發流程建議

1. **規劃**：在新增功能前先確認畫面與資料結構，必要時更新 `docs/overview.md`。
2. **開發**：將邏輯拆分成可重用的 Hook 或工具函式，並維持 TypeScript 型別正確。
3. **檢查**：本機執行 `npm run lint`、`npm run test`、`npx tsc --noEmit`、`npx expo-doctor`，必要時撰寫測試。
4. **提交**：撰寫清楚的 Commit 訊息與 PR 描述，附上測試或手動驗證結果。
5. **部署**：透過 `preview-build` 取得測試包，確認後再推送到正式管道。

## 其他文件

- `docs/overview.md`：系統架構、資料流與主要模組說明。
- `docs/backup.md`：匯出／匯入備份的實作細節、Runbook 與常見疑難排解。
- 建議新增 `docs/ai.md`、`docs/release.md` 等文件持續補充專案知識（可依實際需求擴充）。

## 常見問題

- **Expo 啟動時找不到 OpenAI 金鑰**：請檢查 `.env` 或 CI Secret 是否設定 `EXPO_PUBLIC_OPENAI_API_KEY`。
- **Android 版號錯誤**：請確認 `npm version` 是否更新，並重新產包；`app.config.ts` 會自動將版本號轉為 `versionCode`。
- **CI 顯示跳過 preview build**：代表未設定 `EAS_TOKEN`，若需要建包請照「環境變數設定」章節操作。

---

若你是新加入的開發者，建議依照「快速開始」→「其他文件」的順序熟悉專案，並依需求更新文件與測試。歡迎在 PR 附加任何開發心得或坑點，讓專案維護更順利。
