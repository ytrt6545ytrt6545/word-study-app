const fs = require("node:fs");
const path = require("node:path");

const targetPath = path.join(__dirname, "..", "docs", "session-context.md");

const template = `請用中文溝通

# Session Context

- 專案現況：
- 最新進度：
- 正在處理：
- 阻塞問題：
- 特別指示：

## 建議先閱讀
1. docs/overview.md（專案摘要與功能結構）
2. app.config.ts、app.json（Expo 與環境設定）
3. app/ 目錄（主要路由與畫面）
4. components/、hooks/（共用元件與邏輯）

## 常用指令
- npm run init-ai-context
- npm run start
- npm run test

## 其他提醒
- 避免修改 android-keys/ 與 credentials.json 等敏感檔案
- 依據上述欄位更新最新狀態後再開始討論
`;

if (!fs.existsSync(targetPath)) {
  fs.writeFileSync(targetPath, template, "utf8");
  console.log("已建立 docs/session-context.md");
} else {
  console.log("docs/session-context.md 已存在，請直接更新內容。");
}
