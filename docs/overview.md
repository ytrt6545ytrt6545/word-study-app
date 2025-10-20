# Halo Word 系統概觀

本文件協助接手的開發者快速理解專案架構、資料流程與重要模組。

## 功能 Map

- **詞彙管理**
  - `app/add`：新增單字（中文解釋、例句、標籤）。
  - `app/(tabs)/words.tsx`：瀏覽全部單字，支援依標籤或字母排序。
  - `app/(tabs)/tags`：標籤維護與篩選。
- **學習與測驗**
  - `app/(tabs)/review`：依照記錄的熟悉度進行複習。
  - `app/exam/word.tsx`：針對標記為 `EXAM_TAG` 的單字進行測驗。
  - `app/(tabs)/reading.tsx`：閱讀長文本並擷取生字。
- **AI 協作**
  - `app/(tabs)/explore.tsx`：呼叫 OpenAI 生成解釋、例句與同義字。
  - `utils/ai.ts`：封裝 `fetch` 呼叫與錯誤處理。
- **備份與同步**
  - `utils/backup.ts`：匯入匯出 JSON。
  - `utils/storage.ts`：所有單字與設定的存取層。

## 資料流程

1. 使用者透過各頁面操作，UI 會呼叫對應 hook 或 util。
2. 單字資料在本地以 `AsyncStorage` 儲存，資料型別定義於 `utils/storage.ts`。
3. AI 功能使用 `fetch` 呼叫 OpenAI，一律由 `utils/ai.ts` 統一處理，並讀取 `EXPO_PUBLIC_OPENAI_API_KEY`。
4. 語音播放依賴 `expo-speech`，設定頁可切換語音參數，並透過 `utils/tts.ts` 管理。

## 重要模組摘要

- `utils/storage.ts`
  - `loadWords` / `saveWords`：讀寫完整單字列表。
  - `toggleWordTag`：切換指定單字的標籤。
  - `Word` 型別：包含 `value`、`note`、`tags`、`createdAt` 等欄位。
- `utils/ai.ts`
  - `askAiForWord`：輸入英文字串回傳解釋。
  - `askAiForChinese`：輸入中文後回傳對應的單字建議。
  - `buildPrompt`：組合前端設定與模板字串。
- `app/exam/word.tsx`
  - 透過 `EXAM_TAG` 篩選題庫。
  - `renderTypedWithDiff` 會計算使用者輸入與正解的差異。
- `context/TabMarkContext.tsx`
  - 儲存使用者上次瀏覽的頁籤，避免重新載入時跳回預設頁。

## 目錄約定

- `app/(tabs)`：主要導覽頁，依 Expo Router 路由規則命名。
- `components/ui`：通用 UI 元件（如 Button、Card），採無狀態設計。
- `hooks/`：跨頁面共用邏輯（如 `useDebounce`、`useLoadWords`）。
- `docs/`：所有說明文件集中於此資料夾，方便導入 mkdocs 或 GitBook。

## 代辦與建議

- 規劃單元測試（建議從 `utils/storage.ts` 與 `utils/ai.ts` 開始）。
- 引入狀態管理（如 Zustand）以降低 props drilling。
- 針對 AI 回應加入快取與錯誤回報機制。
- 在 `docs/` 新增 API 介面、資料匯入規格等文件，逐步累積知識庫。

若有結構調整或新增功能，請同步更新本檔案與 `README.md`，確保團隊成員都能掌握最新狀況。歡迎將常見坑點、測試策略補充於 `docs/` 底下，形成完整的開發手冊。
