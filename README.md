# Welcome to your Expo app 👋

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

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## AI 補齊設定

- 於新增單字頁面（Explore 分頁）新增「AI補齊」按鈕：
  - 當只輸入「中文」時：自動補齊英文單字、英文例句、例句中文翻譯。
  - 當只輸入「英文單字」時：自動補齊中文翻譯、英文例句、例句中文翻譯。

- 若要啟用真實的 AI 補齊，請設定 OpenAI API Key（於執行期可讀取的公開環境變數）：

  ```bash
  # 建議以環境變數方式注入（Expo 會讀取 EXPO_PUBLIC_* 前綴）
  set EXPO_PUBLIC_OPENAI_API_KEY=sk-xxxx...   # Windows PowerShell
  export EXPO_PUBLIC_OPENAI_API_KEY=sk-xxxx... # macOS/Linux
  ```

- 未設定金鑰時，系統會以「示意資料」回傳，方便 UI 測試，但不具語意的真實性。

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.

## 語音朗讀（TTS）

- 單字列表已新增「讀」按鈕，按下會以英文語音朗讀該單字。
- 需要安裝依賴 `expo-speech`：

  ```bash
  npx expo install expo-speech
  ```

- 若要調整語速或音高，可在 `app/(tabs)/words.tsx` 中的 `Speech.speak` 選項調整。
