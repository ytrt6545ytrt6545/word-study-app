請用中文溝通
閱讀 README.md 了解程式
# Session Context

- 專案現況：優化中
- 最新進度：閱讀畫面朗讀流程已重構，支援中英文朗讀並於換行處停 1 秒
- 正在處理：修正 Slider 元件相關的 TypeScript 錯誤（`npx tsc --noEmit` 仍失敗）
- 阻塞問題：`components/ui/Slider.*` 尚未補齊型別宣告與模組路徑，導致 `tsc` 編譯錯誤
- 特別指示：稍後開新視窗時，優先處理 Slider 型別與模組問題

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
