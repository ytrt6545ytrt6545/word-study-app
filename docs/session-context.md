請用中文溝通(不要刪這條)
當我說起動WEB時請透過 Start-Process 在背景啟動(不要刪這條)
當我說結束工作時請把這次對話視窗所執行的工作成果及需要交接的資訊更新交接的檔案，讓下次開新視窗時，新的AI能快速了解情況。(不要刪這條)
閱讀 README.md 了解程式(不要刪這條)
# 本機建立APK特別說明
環境變數固定在 ASCII 路徑：在建置前先確認 GRADLE_USER_HOME、ANDROID_PREFAB_HOME、ANDROID_HOME、ANDROID_SDK_ROOT、TMP/TEMP、JAVA_TOOL_OPTIONS（若有覆寫 tmpdir）都指向沒有非 ASCII 字元的目錄，建議沿用 C:\word-study-app\.gradle-cache 與 C:\temp。可在 PowerShell 內跑 gci env:GRADLE_USER_HOME,ANDROID_PREFAB_HOME,TMP,TEMP 確認。

開工就執行環境初始化腳本：每次打開新 shell 先跑
powershell -ExecutionPolicy Bypass -File .\scripts\setup-android-build-env.ps1
若需要長期套用就加 -Persist。腳本會建立/更新符號連結並設定上述環境變數，避免忘記。

建置前快速自檢與清理：

執行 Get-ChildItem Env: | Select Name,Value | Select-String 'GRADLE|ANDROID|TMP' 確保值正確。
檢查 C:\temp、.gradle-cache 是否存在且有寫入權限。
若 Prefab 仍抓到錯誤路徑，可刪除 %LOCALAPPDATA%\Temp\agp-prefab-* 或整個 .gradle-cache 後重跑初始化腳本再建置。
照這三步走，就能避免 Prefab 再回到原本含特殊字元的使用者目錄，自然不會再出現 configureCMakeRelWithDebInfo 亂碼錯誤。

先前確實卡在 Prefab CLI，又把暫存路徑指到含非 ASCII 的使用者目錄，導致 prefab_command 找不到 -class-path。我先照指示跑 scripts/setup-android-build-env.ps1，再加上 JAVA_TOOL_OPTIONS=-Djava.io.tmpdir=C:\temp 重新執行 ./gradlew.bat assembleRelease，Prefab 改用 C:\temp\agp-prefab-… 後就順利跑完。

# Session Context

## 專案概況
- 專案現況：優化中，主要功能穩定運作。
- 阻塞問題：無（Expo Web 已可使用 8090 埠成功啟動）。
- 正在處理：
  - 進一步驗證收藏流程在 Web 的匯出／匯入實測與資料一致性。
  - 評估是否需補充額外型別宣告，確保後續套件升級時維持 TypeScript 穩定。

## 最新進度
- 解決 TypeScript `@types/react-dom` 缺少問題，更新型別後 `npx tsc --noEmit` 可順利通過。
- 新增備份流程測試（`tests/backup.spec.ts`），涵蓋文章匯入匯出的正常路徑與 fallback 行為。
- 收藏庫頁面（`app/(tabs)/articles.tsx`）調整 Web 平台刪除流程並新增卡片點擊導向閱讀頁。
- 閱讀頁（`app/(tabs)/reading.tsx`）支援以 `articleId` 參數載入收藏，會自動帶入文章內容與標籤。
- 針對 release APK 閱讀分頁白屏問題，重新執行 `npx expo prebuild --platform android --clean` 同步 `expo-image-picker` 原生模組，並以新的 Gradle 快取路徑 `C:\temp\gradle-cache-20251028` 成功 `./gradlew.bat assembleRelease` 產出 APK。

## 操作指示
- 需要啟動 Web 時，參考「匯出／匯入 Runbook（Web）」步驟 1。
- 匯入後請在瀏覽器 DevTools Console 執行 `localStorage.getItem('@halo_words')` 檢查資料是否更新。
- 匯入後重新整理 Expo Web 或重啟 App 以讀取最新資料。

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
- 避免修改 android-keys/ 與 credentials.json 等敏感檔案。
- 若遇到中文亂碼，確認終端機與檔案皆使用 UTF-8 編碼。
- 朗讀流程依賴 `getSpeechOptions` 取得語速與音高，調整設定後記得重新整理 Expo Web。

## 近期工作重點：閱讀後文章收藏與分類方案

### 目標
- 在閱讀流程結束時提供一鍵收藏入口，預設擷取標題、來源、時間與摘要，支援後續整理。

### 流程
- 閱讀頁面新增「加入收藏」按鈕，收藏後可在「收藏庫」畫面依分類／標籤與關鍵字搜尋檢視。

### 資料結構
- 延伸既有備份 JSON，新增 `@halo_articles` 儲存文章實體並納入匯出匯入流程，維持 `schemaVersion = 1`。
- 初期採手動／簡易規則分類，未來可導入推薦或摘要服務。
- 閱讀頁有收藏入口、收藏庫提供標籤篩選與狀態標示，後續可擴充搜尋與重點標記。

### 待辦
- 驗證閱讀資料是否能直接帶入收藏、敲定資料 schema、規劃前端 UI 與儲存 API、補齊測試與備份驗證。

### 資料結構與儲存鍵值（2025-10-21）
- Article 型別欄位包含 `id`、`title`、`sourceType`、`sourceRef`、`rawText`、`summary`、`tags`、`status`、`createdAt`、`updatedAt`、`highlights` 等，必要時可擴充。
- 儲存鍵值：`@halo_articles`、`@halo_article_tags`、`@halo_article_tag_order`，若未來共用標籤再評估整併策略。
- 備份整合：上述鍵值已加入 `utils/backup.ts` 的 `BACKUP_KEYS`，匯入缺少欄位時以預設值回填，確保舊備份相容。

### 待討論／實作待辦
- Article 欄位預設值與 TypeScript 型別繼續調整（如 `status`、`highlights`、`linkedWords`）。
- 強化匯出／匯入流程文件與測試，特別是 `@halo_articles`、`@halo_article_tags` 的驗證。
- 評估 UI 是否需要補強搜尋、分類、重點標記與資料視覺化。
- 規劃驗證流程（手動／自動化），覆蓋匯入匯出、資料遺失防護、標籤同步等情境。

### 儲存層 API 規劃
- `utils/articles.ts` 已提供 `loadArticles`、`saveArticles`、`createArticle`、`updateArticle`、`deleteArticle`、`getArticleById` 以及標籤與 highlight 操作。
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
4. 匯入後開啟 DevTools Console，輸入：
   ```js
   localStorage.getItem('@halo_words')
   ```
   若為 `[]` 或空值，請截圖或貼上文字回報。
5. 重新整理頁面或重啟 App，確認資料更新；必要時再執行「匯出到裝置」檢查檔案內容。

## 交接紀錄（2025-10-27）
- 已完成：閱讀頁新增「從圖片匯入」功能，現改用 DocumentPicker 搭配 FileSystem 讀取圖檔後呼叫 OpenAI Vision 將辨識結果貼入輸入框，保留載入狀態與錯誤提示（原流程使用 `expo-image-picker@15.0.7`）。
- `utils/ai.ts` 擴充圖片 OCR helper、繁體中文強制轉換（使用 `chinese-conv`）與錯誤訊息格式化（429 限速顯示中文資訊）。
- 新增依賴：`chinese-conv`，並建立 `types/chinese-conv.d.ts`；原先新增的 `expo-image-picker` 已不再使用，若後續確認不再回退即可從 `package.json` 移除。
- 待確認：在 Web 與真機環境檢查圖片權限流程與繁體轉換後的朗讀效果，必要時加入 OCR 重試與備援方案。
- 風險：OpenAI API 目前仍可能觸發 TPM 限制，若持續出現 429 需評估升級帳號或改用替代金鑰。

## 本機產出 APK 流程（2025-10-28）
- 現況：已於 Windows 本機使用 Expo prebuild + Gradle 成功產出 release APK，之前失敗主因是使用者路徑含非 ASCII 字元導致 prefab 無法處理暫存目錄。
- 環境調整：
  - 透過系統連結將 Android SDK 映射至 C:\android-sdk（ASCII 路徑），並設定 ANDROID_HOME、ANDROID_SDK_ROOT 指向該位置。
  - 建立 C:\word-study-app\.gradle-cache 並設為 GRADLE_USER_HOME，避免 Gradle cache 落在含特殊字元的使用者目錄。
  - 建立 C:\temp，並在 android/gradle.properties 的 org.gradle.jvmargs 追加 `-Djava.io.tmpdir=C:\temp`，確保 prefab 暫存路徑合法。
- 建置步驟：
  1. 在專案根目錄執行 `npx expo prebuild --platform android`（首次執行即可，已產出 `android/` 目錄）。
  2. 建置前先刪除 `android/app/build/outputs/apk/release` 目錄（例如 `Remove-Item -Recurse -Force android/app/build/outputs/apk/release`），確保不會沿用舊 APK。
  3. 進入 `android/` 後執行 `./gradlew.bat assembleRelease`；在同一 shell 中預先設定上述環境變數。
- 產物位置：`android/app/build/outputs/apk/release/app-release.apk`。
- 故障排查：若日後又出現 prefab 錯誤，優先檢查環境變數是否仍指向 ASCII 路徑並確認 C:\temp 存在，必要時清除 `.gradle-cache` 後重新建置。
- 若遇到 `Execution failed for task ':react-native-reanimated:configureCMakeRelWithDebInfo[arm64-v8a]'` 且 Prefab CLI 輸出亂碼（例如 `???O????`）或反覆出現 `-class-path` 錯誤，代表建置流程又回到含非 ASCII 的使用者目錄（例如 `C:\Users\µøÅ¥\...`）。請確認 `GRADLE_USER_HOME`、`ANDROID_PREFAB_HOME`、`java.io.tmpdir` 都指向 ASCII 路徑（建議 `C:\word-study-app\.gradle-cache` 與 `C:\temp`），必要時重跑 `scripts/setup-android-build-env.ps1 -Persist`。
- 長期設定：新增 `scripts/setup-android-build-env.ps1`，於 PowerShell 執行 `powershell -ExecutionPolicy Bypass -File ./scripts/setup-android-build-env.ps1 -Persist` 可一鍵建立連結、建立目錄並寫入使用者層級環境變數；若只需當前 shell，省略 `-Persist` 即可。

## 本次會話紀錄（2025-10-28）
- 已成功在 Windows 本機透過 prebuild + Gradle 建出 release APK（路徑：`android/app/build/outputs/apk/release/app-release.apk`）。
- 調整 `android/gradle.properties` 加入 `-Djava.io.tmpdir=C:\temp`，修復 prefab 路徑編碼問題。
- 新增 `scripts/setup-android-build-env.ps1`，可一鍵建立 ASCII SDK 連結並設定環境變數（支援 `-Persist` 寫入使用者層級設定）。
- 排查 release APK 閱讀分頁白屏，透過 `adb logcat` 確認缺少 `ExponentImagePicker` 原生模組，已重新 `expo prebuild --clean` 並以 `GRADLE_USER_HOME=C:\temp\gradle-cache-20251028`、`-Djava.io.tmpdir=C:\temp` 重新建置，APK 內含 `expo-image-picker` 並可後續驗證。
- Prefab CLI 曾再次落到含非 ASCII 的使用者目錄導致 `prefab_command` 找不到 `-class-path`；重跑 `scripts/setup-android-build-env.ps1` 並設定 `JAVA_TOOL_OPTIONS=-Djava.io.tmpdir=C:\temp` 後，`./gradlew.bat assembleRelease` 改用 `C:\temp\agp-prefab-*` 暫存路徑即能順利完成。
- 2025-10-28 再次執行環境預防措施：建立 `C:\temp\android-prefab`、以 `setx` 固定 `ANDROID_PREFAB_HOME=C:\temp\android-prefab`，並跑 `scripts/setup-android-build-env.ps1 -Persist` 確保 `GRADLE_USER_HOME`、`TEMP/TMP`、Android SDK 路徑皆落在 ASCII 目錄，建置前如在新 shell 請重新套用設定。

## 本次會話紀錄（2025-10-29）
- 重新以 `expo prebuild --platform android` 搭配刪除 `android/app/build/outputs/apk/release` 重建 release APK，最新產物為 `android/app/build/outputs/apk/release/app-release.apk`（2025/10/29 11:45，約 83.7 MB）。
- `app/(tabs)/reading.tsx` 加入暫時的 `console.log`（DocumentPicker 回傳資產後會印出 uri / fileCopyUri / mimeType / size），方便確認是否拿到圖檔；後續排查完成請移除。
- 排查重點：在手機重新安裝 APK 後於閱讀頁按「從圖片匯入」，搭配 `adb logcat | Select-String "reading :: onPickImage"` 觀察資產資訊與錯誤堆疊。
- 若仍在畫面看到「辨識失敗」訊息，請確認 DocumentPicker 是否回傳資產（log 中不為 `null`）、`fileCopyUri` 是否存在，以及 `FileSystem.readAsStringAsync` 是否成功；如整段 log 未出現，請先確認 App 版本與權限設定。

## 本次會話紀錄（2025-10-30）
- 「從圖片匯入」改以 DocumentPicker + FileSystem 讀取圖檔後送至 OpenAI Vision，移除對 `expo-image-picker` 原生模組的依賴，避免 APK 遺漏模組時出現 `Image picker not available`。
- `onPickImage` 在取得資產與轉成 Base64 失敗時會顯示通用錯誤訊息，並保留成功/失敗提示；若需追蹤流程，可透過 `adb logcat | Select-String "reading :: onPickImage"` 檢視 asset 資訊。
- 若確實需要回退至 `expo-image-picker`，只要恢復舊版 `onPickImage` 並重新 prebuild/assemble 即可；目前 `expo-image-picker` 仍暫留於 `package.json`，待確認無回退需求後可移除。
- `npx tsc --noEmit` 仍會因既有的 `types/chinese-conv.d.ts` 編碼問題報錯（Invalid character）；和本次調整無關，待後續整理該型別檔再解決。
- 持續遵循建置前清理 release 目錄與執行 `scripts/setup-android-build-env.ps1` 的流程，避免沿用舊輸出或環境變數記錯。

## 未來工作重點：UI 視覺強化
- 建立統一的設計語言：定義品牌色、字體階層、卡片陰影與圓角等 Style Token，並整理至 `Resources/Styles.*` 供 Expo 與未來 MAUI 版本共用參考。
- 重構主要頁面（單字、文章、閱讀、設定）為卡片式版面與分區導覽，搭配標籤 Chips、圖示、進度提示與空狀態插圖，讓資訊層次更分明。
- 增加互動細節：導入骨架畫面、列表載入動畫、按鈕縮放與錯誤提示，提升整體商用級質感。
- 規劃暗色模式與品牌化開場畫面（Logo、主題背景），確保跨平台體驗一致。
## 2025-10-31 �汵����
- �s�W `app/(tabs)/practice.tsx` �m�ߤ����A���Ѧ�ȡB�r�šB�r��B���Z�P���v���Y�ɽվ�ܽd�A�ç�s `_layout.tsx`�B`components/ui/IconSymbol.tsx` �P `i18n/index.tsx` �������]�w�C
- `app/(tabs)/reading.tsx` �[�J `onStopReading` �����Ū�޿�A��Ū����C��� i18n ��ר÷s�W�u����v�A`i18n/index.tsx` �P�B�ɤW���^��r��C
- ���s���� `./gradlew.bat assembleRelease`�A�̷s APK ��m�G`android/app/build/outputs/apk/release/app-release.apk`�C
- ���ݳB�z�G`types/chinese-conv.d.ts` �s�X���~�ɭP `npx tsc --noEmit` ���ѡF��Ū�睊�w����������աA��ĳ�u���A���Ҥ@����/�ȱ���O�_���`�C
