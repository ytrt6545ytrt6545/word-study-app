請用中文溝通
閱讀 README.md 了解程式
# Session Context

- 專案現況：優化中，主要功能可運作
- 最新進度：
  - 閱讀畫面朗讀流程已重構，支援中英文朗讀並於換行處停 1 秒
  - Slider 平台檔案（`components/ui/Slider.*`）已補齊型別與 `moduleSuffixes`，`npx tsc --noEmit`、`npm run lint`、`npm run test` 皆可通過
  - `utils/backup.ts` 已更新，匯入流程會解析備份字串並呼叫 `saveWords`、`saveTags` 正規化資料
- 正在處理：驗證匯入備份後的單字/設定是否確實寫回並在 Expo Web 顯示
- 阻塞問題：Expo Web 伺服器目前未成功啟動（8081~8083 port 被占用，`expo start --web` 被迫跳過），導致瀏覽器端 `localStorage` 仍是空陣列，無法確認匯入結果
- 特別指示：
  1. 清除或關閉佔用 8081/8082/8083 的進程，重新執行 `npm run web`（或 `npx expo start --web --port 8090 --clear`）啟動新伺服器
  2. 伺服器啟動後在設定頁按「匯入備份」，並在瀏覽器 DevTools 主控台輸入 `localStorage.getItem('@halo_words')` 確認資料（若仍為 `[]` 請貼上結果）
  3. 匯入後重新整理 Expo Web 或重啟 App 以讀取最新資料

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
