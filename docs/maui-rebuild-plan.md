# Halo Word 重新開發計畫（.NET MAUI + Visual Studio 2022）

本文件協助接手的 AI / 開發者使用 **Visual Studio 2022**、**.NET MAUI**、**C# / XAML** 重建 Halo Word 的核心功能。內容涵蓋架構選型、專案結構、功能模組設計、資料存取策略與開發流程。請按章節順序執行，以保留原專案的使用體驗。

---

## 1. 目標與範圍

### 1.1 主要目標
- 建立跨平台（Android / Windows / iOS 可選）之原生 App。
- 功能需與現有 Expo/React Native 版本一致：
  - 單字新增 / 編輯 / 刪除 / 標籤管理。
  - 單字測驗與複習（含 EXAM / REVIEW 標籤）。
  - 閱讀文章展示、從圖片匯入 OCR、標注生字並加入收藏。
  - 呼叫 OpenAI 取得翻譯、例句、音標。
  - 語音朗讀設定（語速、音高、語者、停頓）。
  - 匯入 / 匯出備份（JSON + Google Drive appDataFolder 可留待擴充）。
- 維持現有資料結構、欄位與備份檔格式，確保資料可互通。

### 1.2 非目標（可列入後續 Backlog）
- Expo Web 專用功能（瀏覽器特定 API）。
- React Native 專屬樣式／元件。
- GitHub Actions / JS 環境的 CI 腳本（改以 .NET / GitHub Actions 或 Azure DevOps 規劃）。

---

## 2. 開發環境

- Visual Studio 2022（17.8 以上，含 .NET MAUI workload）。
- .NET 8（或當前 LTS 版本）。
- Android SDK / 模擬器與必要的 Windows Subsystem（若在 Windows 開發）。
- 選配：iOS 環境需 macOS + Xcode（遠端建置或本機 Mac）。
- OpenAI API 金鑰存於 Secret Manager 或 `appsettings.Development.json`。

---

## 3. 專案結構規劃

```
HaloWord.Maui/
├── HaloWord.Maui.sln
├── src/
│   ├── HaloWord.App/               # .NET MAUI 主專案（XAML 頁面 + ViewModel）
│   ├── HaloWord.Core/              # 商業邏輯、資料模型、服務介面
│   ├── HaloWord.Infrastructure/    # 平台實作（資料存取、OpenAI、OCR、TTS）
│   └── HaloWord.Tests/             # 單元測試（NUnit / xUnit）
├── resources/                      # 字型、圖示、音效
└── docs/
    └── (本文件與後續補充文件)
```

### 3.1 專案說明
- **HaloWord.App**
  - XAML 頁面 (`Views/`)、ViewModel (`ViewModels/`)、資源字典 (`Resources/`)、路由設定。
  - 採 MVVM（建議使用 CommunityToolkit.Mvvm）。
- **HaloWord.Core**
  - 資料模型（Words, Tags, Articles, Settings 等）。
  - 服務介面（`IWordRepository`, `IArticleService`, `IAiService`, `ITtsService`, `IBackupService`）。
  - 共用工具：SRS 計算、標籤正規化、OCR 結果正規化。
- **HaloWord.Infrastructure**
  - SQLite / Preferences 實作（替代 AsyncStorage）。
  - OpenAI HTTP Client（可用 `System.Net.Http` + `IOptions` 管理 Key）。
  - 平台 API：Media Picker、File Picker、Text-to-Speech。
  - 備份：序列化 `BackupPayload` 為 JSON；Google Drive 可待後續。
- **HaloWord.Tests**
  - 驗證資料模型、SRS 邏輯、匯入匯出流程、AI 回傳解析。

---

## 4. 功能對照設計

| 現有功能 | MAUI 對應頁面 / 元件 | 需注意事項 |
| --- | --- | --- |
| 單字列表 `app/(tabs)/words.tsx` | `Views/WordsPage.xaml` + `WordsViewModel` | 使用 `CollectionView` + `ObservableCollection`。 |
| 單字新增 `app/add` | `Views/AddWordPage.xaml` | 表單使用 `Entry`, `Editor`, `Picker`。提交後呼叫 `IWordRepository`. |
| 標籤維護 `app/(tabs)/tags` | `Views/TagsPage.xaml` | 標籤樹可用 `CollectionView` + 自訂巢狀模板或第三方 TreeView。 |
| AI 探索 `app/(tabs)/explore.tsx` | `Views/AiExplorePage.xaml` | 呼叫 `IAiService.AskAsync`; 顯示 Loading / 結果。 |
| 閱讀頁 `app/(tabs)/reading.tsx` | `Views/ReadingPage.xaml` | 支援貼上 / 載入文章、OCR 圖片，使用 `IAiService.RecognizeImageAsync`。 |
| 收藏庫 `app/(tabs)/articles.tsx` | `Views/ArticleLibraryPage.xaml` | 篩選、刪除、跳轉閱讀。 |
| 測驗 `app/exam/word.tsx` | `Views/WordExamPage.xaml` | 題庫透過 `EXAM_TAG` 篩選；提供朗讀與答案比較。 |
| 設定頁 `app/(tabs)/settings.tsx` | `Views/SettingsPage.xaml` | 驗證 `ITtsService`、`IBackupService`、語系切換（`Resources/AppResources.resx`）。 |
| 備份 `utils/backup.ts` | `IBackupService` + `BackupService` | 匯出/匯入 JSON；Google Drive 待擴充。 |

---

## 5. 資料模型與儲存

### 5.1 Core 模型
建立下列 C# record / class（對應現有 TypeScript 型別）：

- `Word`
  ```csharp
  public record Word(
      string Id,
      string Value,
      string? Note,
      IReadOnlyList<string> Tags,
      SrsState Srs,
      DateTime CreatedAt,
      DateTime UpdatedAt);
  ```
- `Article`, `ArticleHighlight`, `ArticleTagOrder`
- `BackupPayload`
- `SpeechSettings`（語速、語者、音高、停頓）
- `AppPreferences`（字體大小、語系等）

### 5.2 儲存策略
- **SQLite（推薦）**
  - 使用 `SQLite-net-pcl` 或 EF Core SQLite。
  - Table：Words、Tags、Articles、ArticleTags、Highlights、Settings。
  - 好處：易於查詢與同步；後續可支援雲同步。
- **跨平台 Preferences / FileSystem**
  - 若想快速實作，可使用 `FileSystem.AppDataDirectory` + JSON 存檔。
  - 需自行管理併發與資料遺失風險。

### 5.3 Repository 介面範例
```csharp
public interface IWordRepository
{
    Task<IReadOnlyList<Word>> GetAllAsync();
    Task<Word?> GetByIdAsync(string id);
    Task SaveAsync(Word word);
    Task DeleteAsync(string id);
    Task<IReadOnlyList<Word>> GetByTagAsync(string tag);
    Task ToggleTagAsync(string wordId, string tag);
}
```

---

## 6. 服務層實作建議

### 6.1 AI 服務 (`IAiService`)
- 方法：
  - `Task<AiWordResult> CompleteWordAsync(string? english, string? chinese)`
  - `Task<OcrResult> RecognizeImageAsync(Stream image, string mimeType)`
- 使用 `HttpClient` 直接呼叫 OpenAI Chat Completions / Images API。
- 統一錯誤訊息與 fallback：可複用原專案邏輯（如網路錯誤、Key 缺失等）。

### 6.2 語音服務 (`ITtsService`)
- .NET MAUI 內建 `TextToSpeech.Default`.
- 儲存語速/音高 → `SpeechSettings`.
- 提供 `Task SpeakAsync(string text, SpeechOptions options)`。

### 6.3 備份服務 (`IBackupService`)
- `Task<BackupPayload> BuildAsync()`
- `Task ApplyAsync(BackupPayload payload)`
- `Task SaveToFileAsync(string path)`
- `Task<BackupPayload> LoadFromFileAsync(string path)`
- Google Drive：可後續使用 `Google.Apis.Drive.v3`，搭配 OAuth。

### 6.4 標籤與 SRS
- 將 `utils/storage.ts` 中的標籤解析 (`normalizeTagPath`, `buildTagTree`) 與 SRS 計算 (`defaultSrs`, `updateSrs`) 移植到 `HaloWord.Core`.
- 提供 `ITagService` 以生成樹狀資料、排序與搜尋。

---

## 7. UI / UX 規劃

- 採用 `TabbedPage` 或 `Shell` 控制底部選單：
  - `WordsPage`, `ArticlesPage`, `ReadingPage`, `ExplorePage`, `SettingsPage`.
- 各頁面使用 MVVM：
  - `ObservableCollection<T>` 作為資料來源。
  - `RelayCommand`（CommunityToolkit.Mvvm）處理事件。
  - `DataTemplate` 定義卡片樣式、標籤 Chips。
- 主題與顏色：
  - 依現有 UI 風格建立 `Resources/Styles.xaml`。
  - 使用 `AppThemeBinding` 支援深色 / 淺色。
- 設計語言與行銷呈現：
  - 建立 Style Dictionary（色票、字體、陰影、圓角、漸層），讓卡片、標籤、按鈕保持一致。
  - 主要畫面導入 Hero 區塊（品牌 Logo + 背景圖或漸層），搭配 KPI（今日新增、連續學習天數）與 CTA 按鈕。
  - 空狀態顯示插圖與指引文案，錯誤、成功提示使用 Toast / Snackbar 統一樣式。
- 動畫與互動：
  - 利用 `CommunityToolkit.Maui` 的動畫 API 實作按鈕縮放、頁面轉場、骨架載入。
  - 列表滾動時加入滑入/淡入效果，提升質感。
- 模組化樣板：
  - 建立共用的 `WordCard`, `ArticleCard`, `TagChip`, `ActionToolbar` 控制項，避免畫面視覺不一致。
  - Splash / Onboarding 頁面展示核心功能與價值主張，營造商用 App 氛圍。
- 圖片 OCR：
  - Android：`FilePicker.Default.PickAsync`.
  - Windows：`FilePicker` 同步運作。

---

## 8. 開發步驟建議

1. **初始化 Solution**
   - `dotnet new maui -n HaloWord.App`
   - 建立 Class Library：`HaloWord.Core`, `HaloWord.Infrastructure`, `HaloWord.Tests`.
   - 設定依賴：App → Core + Infrastructure；Tests → Core。

2. **實作資料模型與服務介面**
   - 將 TypeScript 型別轉為 C#。
   - 定義 Repository / Service 介面與 DTO。

3. **完成基礎儲存層**
   - 選擇 SQLite 或檔案系統；先支援單字 CRUD。
   - 設計資料遷移工具（若從原始 JSON 匯入）。

4. **建置 UI 頁面**
   - Words → Tags → Explore → Reading → Articles → Exam → Settings.
   - 逐步串接對應 Service。

5. **導入 AI 與 TTS**
   - 建立 OpenAI 設定 (`IConfiguration` + `Options` pattern)。
   - 先支援文字補全；再加入 OCR。
   - TTS 先支援基本朗讀，後續補強語者與停頓調整。

6. **備份匯入匯出**
   - 序列化 `BackupPayload` 為 JSON。
   - 測試匯入舊版本備份是否能成功轉換。

7. **測試與品質**
   - 撰寫單元測試：SRS、標籤解析、備份匯入。
   - 規劃 UI 測試（可用 .NET MAUI UITest / Playwright for MAUI）。

8. **平台驗證**
   - Android 模擬器 / 實機。
   - Windows 桌面（WinUI）。
   - 若需 iOS，設定 Hot Restart 或 Mac 連線。

9. **部署策略**
   - Android：`dotnet publish -f net8.0-android`.
   - Windows：打包 MSIX。
   - 完成後撰寫使用者手冊與發佈流程。

---

## 9. 與舊版資料互通

- 使用原 `utils/backup.ts` 定義的 `BACKUP_KEYS` 與 JSON 格式。
- 重建備份匯入流程：
  1. 讀取 JSON → 解析 `payload`.
  2. 將 `@halo_words`, `@halo_articles` 等資料轉換成新模型。
  3. 儲存至 SQLite / 檔案系統。
- 若需向舊版導出，可維持相同鍵值與格式。

---

## 10. 未來擴充建議

- 導入 Dependency Injection（Microsoft.Extensions.DependencyInjection）與設定管理。
- 增加多平台語音設定（透過平台專用 API 選取語者）。
- 建立雲同步（Azure App Service / Firebase）替代單機備份。
- 實作離線資料快取與版控（LiteDB / Realm）。
- 引入分析與錯誤報告（App Center / Sentry）。

---

## 11. 參考實作資源

- [.NET MAUI 官方文件](https://learn.microsoft.com/dotnet/maui/)
- [CommunityToolkit.Mvvm](https://learn.microsoft.com/dotnet/communitytoolkit/mvvm/)
- [SQLite-net for MAUI](https://github.com/praeclarum/sqlite-net)
- [OpenAI .NET SDK](https://github.com/betalgo/openai)（亦可自行封裝 HTTP）
- [Google Drive API .NET](https://developers.google.com/drive/api/quickstart/dotnet)
- [TextToSpeech API](https://learn.microsoft.com/dotnet/maui/platform-integration/communication/text-to-speech)

---

## 12. 交付檢查清單

在完成重製之前，請確認以下項目：

1. ✅ 所有核心頁面皆已移植並可操作。
2. ✅ 單字 / 文章資料可新增、編輯、刪除，並正確儲存在新的資料層。
3. ✅ AI 文字補全與 OCR 功能可用，並能處理網路錯誤。
4. ✅ 語音朗讀設定可調整且應用於閱讀與測驗頁。
5. ✅ 匯入舊版備份檔 `.json` 時資料可成功轉換。
6. ✅ `README` / `docs/` 已更新，說明新的建置與部署流程。
7. ✅ 撰寫至少一套自動化測試（單元或 UI）。

---

完成上述規劃後，即可依照章節分工實作。若有額外需求（例如 UI 重設或後端同步），建議在 `docs/` 目錄中新增對應規格，以維持知識的一致性。祝開發順利！ 🚀
