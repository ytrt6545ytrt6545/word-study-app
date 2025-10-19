# Halo Word（Expo App）

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

You can start developing by editing the files inside the `app` directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## AI 補齊設定

- 在「新增單字（Explore）」可使用「AI 補齊」。
  - 只輸入「中文」：自動補齊英文單字、英文例句、例句中文翻譯。
  - 只輸入「英文單字」：自動補齊中文翻譯、英文例句、例句中文翻譯。

- 要使用真正的 AI 補齊，請設定 OpenAI API Key（於執行時可讀取的環境變數）：

  ```bash
  # 建議以環境變數方式注入（Expo 需以 EXPO_PUBLIC_* 前綴）
  set EXPO_PUBLIC_OPENAI_API_KEY=sk-xxxx...   # Windows PowerShell
  export EXPO_PUBLIC_OPENAI_API_KEY=sk-xxxx... # macOS/Linux
  ```

- 若未設定，開發環境會使用「示範回應」以方便 UI 測試，並不具語意正確性。

## 語音（TTS）

- 清單頁與詳情頁皆可使用語音朗讀。
- 需安裝 `expo-speech`：

  ```bash
  npx expo install expo-speech
  ```

  可調整語速與音高，請見「設定」分頁。

## 介面語言（i18n）

- 內建 zh-TW 與 en，於設定頁可切換，並會記錄於本機。

## Environment Variables

- Keep `.env` ignored and fill it locally with placeholder values; inject real secrets via CI (for example GitHub Actions secrets).
- Rotate API keys regularly and note in docs how teammates should supply them.

## Release Checklist

1. Run `npm version <patch|minor|major>` to bump `package.json`. Expo config now reads this version and re-computes `android.versionCode`.
2. Refresh `EXPO_PUBLIC_BUILD_DATE` (e.g. `date -Is`) and store it in `.env` or a CI secret.
3. Run `npm run lint`, `npx tsc --noEmit`, and `npx expo-doctor` before tagging a release.
4. Queue `eas build --profile preview` (locally or in CI) to verify the binary before shipping.

## CI/CD

- `.github/workflows/ci.yml` runs on pushes to `main` and on pull requests.
  - `quality` installs dependencies, then runs lint, TypeScript, and `expo-doctor`.
  - `preview-build` runs when `EAS_TOKEN` is set, logging into EAS and scheduling an Android preview build with `--no-wait`.
- Keep `EAS_TOKEN`, the OpenAI key, and other secrets in GitHub Secrets instead of committing them.
