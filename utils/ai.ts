import Constants from "expo-constants";
import * as Updates from "expo-updates";
import { tify } from "chinese-conv";

// AI 工具模組：統一管理 OpenAI 金鑰、錯誤處理、文字補全與圖片 OCR 的呼叫。
// 透過集中化的入口，可避免畫面層重複撰寫 fetch 邏輯與錯誤訊息轉換。
// 特色：
// - 自動處理測試環境（__DEV__）下的 fallback，確保沒有金鑰時也能回傳範例資料。
// - 針對瀏覽器環境的限制提供明確錯誤訊息，方便使用者改用原生 App。

export type AIResponse = { text: string };

const FALLBACK_REPLY_PREFIX = "\u793a\u7bc4\u56de\u8986\uff1a";
const PROMPT_PLACEHOLDER = "\u8acb\u8f38\u5165\u5167\u5bb9";
const ERROR_NO_KEY =
  "\u5c1a\u672a\u8a2d\u5b9a\u0020\u004f\u0070\u0065\u006e\u0041\u0049\u0020\u0041\u0050\u0049\u0020\u004b\u0065\u0079\uff0c\u8acb\u8a2d\u7f6e\u74b0\u5883\u8b8a\u6578\u0020\u0045\u0058\u0050\u004f\u005f\u0050\u0055\u0042\u004c\u0049\u0043\u005f\u004f\u0050\u0045\u004e\u0041\u0049\u005f\u0041\u0050\u0049\u005f\u004b\u0045\u0059\u0020\u5f8c\u518d\u5efa\u7f6e\u3002";
const AI_BROWSER_BLOCKED_MESSAGE =
  "\u7121\u6cd5\u76f4\u63a5\u5728\u700f\u89bd\u5668\u547c\u53eb\u004f\u0070\u0065\u006e\u0041\u0049\u0020\uff08\u0043\u004f\u0052\u0053 \u9650\u5236\uff09\uff0c\u8acb\u6539\u7528\u624b\u6a5f App \u6216\u8a2d\u5b9a\u4ee3\u7406\u3002";
const AI_NETWORK_ERROR_MESSAGE =
  "\u004f\u0070\u0065\u006e\u0041\u0049 \u9023\u7dda\u5931\u6557\uff0c\u8acb\u6aa2\u67e5\u7db2\u8def\u5f8c\u518d\u8a66\u3002";
const SYSTEM_MESSAGE =
  "\u4f60\u662f\u82f1\u4e2d\u7ffb\u8b6f\u52a9\u624b\uff0c\u53ea\u8f38\u51fa\u7c21\u77ed\u4e2d\u6587\u7ffb\u8b6f\uff0c\u4e0d\u8981\u89e3\u91cb\u3002";
const DEV_FILL_ZH = "\u8acb\u586b\u5165\u5c0d\u61c9\u4e2d\u6587\u7ffb\u8b6f";
const DEV_SAMPLE_ZH = "\u9019\u662f\u4e00\u6bb5\u793a\u4f8b\u4e2d\u6587";
const DEV_SAMPLE_SENTENCE_PREFIX = "\u9019\u662f\u4e00\u500b\u793a\u4f8b\u53e5\u5b50\uff0c\u4f7f\u7528\u0020";
const AI_PARSE_ERROR = "\u0041\u0049\u0020\u56de\u50b3\u5167\u5bb9\u683c\u5f0f\u932f\u8aa4";
const OCR_SYSTEM_PROMPT =
  "\u4f60\u662f\u4e00\u4f4d\u5716\u50cf\u6587\u5b57\u8b80\u53d6\u52a9\u624b\uff0c\u50c5\u8f38\u51fa\u539f\u59cb\u6587\u5b57\uff0c\u4e0d\u7ffb\u8b6f\u3001\u4e0d\u6458\u8981\u3001\u4e0d\u984d\u5916\u89e3\u91cb\u3002\u4fdd\u7559\u5408\u7406\u7684\u63db\u884c\u8207\u7a7a\u683c\uff0c\u4f46\u907f\u514d\u984d\u5916\u7a7a\u884c\u3002";
const OCR_SAMPLE_TEXT = "\u5716\u7247\u4e2d\u7684\u793a\u4f8b\u6587\u5b57\u3002";
const MAX_OCR_BYTES = 4 * 1024 * 1024;
const OCR_IMAGE_TOO_LARGE =
  "\u5716\u7247\u6a94\u592a\u5927\uff0c\u8acb\u9078\u7528\u5927\u5c0f\u5c0f\u65bc 4MB \u7684\u5716\u7247\u6216\u964d\u4f4e\u89e3\u6790\u5ea6\u3002";
const OCR_IMAGE_MISSING = "\u627e\u4e0d\u5230\u5716\u7247\u8cc7\u6599\uff0c\u8acb\u91cd\u65b0\u9078\u64c7\u300c\u5f9e\u5716\u7247\u532f\u5165\u300d\u3002";
const BROWSER_RUNTIME = typeof window !== "undefined" && typeof document !== "undefined";

const isNetworkError = (error: unknown) => {
  if (!error) return false;
  const message = String((error as any)?.message ?? error);
  return /Failed to fetch/i.test(message) || /Network request failed/i.test(message) || /NetworkError/i.test(message);
};

const normalizeFetchError = (error: unknown): Error => {
  if (isNetworkError(error)) {
    if (BROWSER_RUNTIME) {
      return new Error(AI_BROWSER_BLOCKED_MESSAGE);
    }
    return new Error(AI_NETWORK_ERROR_MESSAGE);
  }
  return error instanceof Error ? error : new Error(String(error));
};

const extractOpenAIErrorMessage = (status: number, bodyText: string): string => {
  let detail: string | undefined;
  try {
    const parsed = JSON.parse(bodyText);
    if (parsed && typeof parsed === "object") {
      const err = (parsed as any).error;
      if (err && typeof err === "object") {
        if (typeof err.message === "string" && err.message) detail = err.message;
        else if (typeof err.code === "string") detail = err.code;
      } else if (typeof (parsed as any).message === "string") {
        detail = (parsed as any).message;
      }
    }
  } catch {
    if (!detail) detail = bodyText;
  }

  if (status === 429) {
    return detail
      ? `OpenAI API 限速，請稍後再試。${detail}`
      : "OpenAI API 限速，請稍後再試。";
  }
  if (status >= 500) {
    return detail
      ? `OpenAI 伺服器暫時無法回應 (${status})：${detail}`
      : `OpenAI 伺服器暫時無法回應 (${status})。`;
  }

  if (detail) return `OpenAI ${status}: ${detail}`;
  return `OpenAI ${status}: ${bodyText}`;
};

const PROMPT_SYSTEM_LINES = [
  "你是一位英中詞彙助手，請輸出 JSON 物件：{ en, zh, exampleEn, exampleZh, phonetic }",
  "en: 對應的英文單字",
  "zh: 對應的繁體中文翻譯（不包含註解，不得使用簡體）",
  "exampleEn: 一句使用該單字的英文例句",
  "exampleZh: 上述例句的繁體中文翻譯（不包含註解，不得使用簡體）",
  "phonetic: Provide the KK phonetic transcription (American pronunciation) and enclose it in slashes, e.g. /ɪnˈtriɡɪŋ/.",
];

export const getManifestExtra = (): Record<string, any> => {
  const expoExtra = (Constants.expoConfig as any)?.extra ?? {};
  const manifestExtra = (Constants.manifestExtra as any) ?? {};
  const updatesExtra = ((Updates.manifest as any)?.extra ?? {}) as Record<string, any>;
  return { ...expoExtra, ...manifestExtra, ...updatesExtra };
};

export const resolveOpenAIKey = (): string | undefined => {
  const direct = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  if (direct) return direct;
  const extra = getManifestExtra();
  return (
    extra.openaiApiKey ??
    extra.EXPO_PUBLIC_OPENAI_API_KEY ??
    extra.expoPublicOpenaiApiKey ??
    extra.openAIKey
  );
};

export async function callAI(prompt: string): Promise<AIResponse> {
  const key = resolveOpenAIKey();

  if (!key) {
    if (typeof __DEV__ !== "undefined" && __DEV__) {
      await new Promise((r) => setTimeout(r, 300));
      return { text: `${FALLBACK_REPLY_PREFIX}${prompt || PROMPT_PLACEHOLDER}` };
    }
    throw new Error(ERROR_NO_KEY);
  }

  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.2,
        messages: [
          { role: "system", content: SYSTEM_MESSAGE },
          { role: "user", content: prompt || PROMPT_PLACEHOLDER },
        ],
      }),
    });
  } catch (error) {
    throw normalizeFetchError(error);
  }

  if (!res.ok) {
    const err = await res.text();
    throw new Error(extractOpenAIErrorMessage(res.status, err));
  }

  const json = await res.json();
  const text = json?.choices?.[0]?.message?.content ?? "";
  return { text };
}

export type AIFillResult = {
  en?: string;
  zh?: string;
  exampleEn?: string;
  exampleZh?: string;
  phonetic?: string;
};

export type OCRResult = { text: string };

// 根據使用者輸入的英文或中文欄位，向 OpenAI 取得完整的詞彙資訊。
// 回傳結構會包含英文、中文翻譯、例句與 KK 音標，供探索頁或閱讀頁補齊字卡內容。
export async function aiCompleteWord(input: { en?: string; zh?: string }): Promise<AIFillResult> {
  const key = resolveOpenAIKey();
  const en = (input.en || "").trim();
  const zh = (input.zh || "").trim();

  if (!key) {
    if (typeof __DEV__ !== "undefined" && __DEV__) {
      const hasEn = !!en;
      const word = hasEn ? en : "example";
      return {
        en: hasEn ? en : "example",
        zh: zh || (hasEn ? DEV_FILL_ZH : DEV_SAMPLE_ZH),
        exampleEn: `This is an example sentence using ${word}.`,
        exampleZh: `${DEV_SAMPLE_SENTENCE_PREFIX}${hasEn ? en : "example"}\u3002`,
        phonetic: "/\u026a\u0261\u02c8z\u00e6mp\u0259l/",
      };
    }
    throw new Error(ERROR_NO_KEY);
  }

  const system = PROMPT_SYSTEM_LINES.join("\n");
  const user = JSON.stringify({ en, zh });

  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
  } catch (error) {
    throw normalizeFetchError(error);
  }

  if (!res.ok) {
    const err = await res.text();
    throw new Error(extractOpenAIErrorMessage(res.status, err));
  }

  const json = await res.json();
  const content: string = json?.choices?.[0]?.message?.content ?? "";

  const tryParse = (text: string): AIFillResult | null => {
    try {
      const obj = JSON.parse(text);
      if (obj && typeof obj === "object") return obj as AIFillResult;
      return null;
    } catch {
      return null;
    }
  };

  let parsed = tryParse(content);

  if (!parsed) {
    const m = content.match(/\{[\s\S]*\}/);
    if (m) parsed = tryParse(m[0]);
  }

  if (!parsed) throw new Error(AI_PARSE_ERROR);

const sanitizeZh = (value?: string) => {
  if (!value) return value;
  let s = value.trim();
  s = s.replace(/^[\'"`\u300C\u300E\u300A]+/, "").replace(/[\'"`\u300D\u300F\u300B]+$/, "");
  s = s.replace(/\(.*?\)/g, "");
  const m2 = s.match(/^[^\uFF0C,\u3002\.;!\?\uFF1F]+/);
  if (m2) s = m2[0];
  return s.trim();
};
const ensureTraditional = (value?: string | null) => {
  if (!value) return value ?? undefined;
  try {
    return tify(value).trim();
  } catch {
    return value.trim();
  }
};

  const normEn = (parsed as any).en ?? (parsed as any).word ?? (parsed as any).term;
  const normZh = (parsed as any).zh ?? (parsed as any).cn ?? (parsed as any).chinese;
  const normExEn = (parsed as any).exampleEn ?? (parsed as any).example_en ?? (parsed as any).example;
  const normExZh =
    (parsed as any).exampleZh ??
    (parsed as any).example_zh ??
    (parsed as any).exampleCn ??
    (parsed as any).example_cn;
  const normPhonetic =
    (parsed as any).phonetic ??
    (parsed as any).phonetics ??
    (parsed as any).kk ??
    (parsed as any).ipa;

  const zhValue = typeof normZh === "string" ? sanitizeZh(normZh) : undefined;
  const exampleZhValue = typeof normExZh === "string" ? (normExZh as string).trim() : undefined;

  return {
    en: typeof normEn === "string" ? normEn.trim() : undefined,
    zh: ensureTraditional(zhValue),
    exampleEn: typeof normExEn === "string" ? normExEn.trim() : undefined,
    exampleZh: ensureTraditional(exampleZhValue),
    phonetic: typeof normPhonetic === "string" ? normPhonetic.trim() : undefined,
  };
}

const estimateBase64Bytes = (base64: string): number => Math.floor((base64.length * 3) / 4);

// 將 base64 圖片送到 OpenAI Vision，並回傳純文字 OCR 結果。
// 會先檢查檔案大小與金鑰是否齊全，並針對瀏覽器/行動裝置分別回傳在地化錯誤訊息。
export async function recognizeImageText(input: {
  base64: string;
  mimeType?: string;
  prompt?: string;
  locale?: string;
}): Promise<OCRResult> {
  const payloadBase64 = (input.base64 || "").trim();
  if (!payloadBase64) {
    throw new Error(OCR_IMAGE_MISSING);
  }

  const approxBytes = estimateBase64Bytes(payloadBase64);
  if (approxBytes > MAX_OCR_BYTES) {
    throw new Error(OCR_IMAGE_TOO_LARGE);
  }

  const key = resolveOpenAIKey();
  if (!key) {
    if (typeof __DEV__ !== "undefined" && __DEV__) {
      await new Promise((r) => setTimeout(r, 200));
      return { text: OCR_SAMPLE_TEXT };
    }
    throw new Error(ERROR_NO_KEY);
  }

  const uiLocale = (input.locale || "").toLowerCase();
  const localeNote = uiLocale.startsWith("zh")
    ? "The app UI is Chinese, but keep every word in its original language."
    : "";
  const userPrompt =
    input.prompt ||
    `Transcribe every readable character exactly as it appears in the image. ${localeNote} Preserve natural paragraphs, keep mixed languages intact, and do not translate, summarize, or add commentary.`;
  const mime = input.mimeType || "image/jpeg";
  const dataUrl = `data:${mime};base64,${payloadBase64}`;

  const requestBody = {
    model: "gpt-4o-mini",
    temperature: 0,
    messages: [
      { role: "system", content: OCR_SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: userPrompt },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
  };

  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(requestBody),
    });
  } catch (error) {
    throw normalizeFetchError(error);
  }

  if (!res.ok) {
    const err = await res.text();
    throw new Error(extractOpenAIErrorMessage(res.status, err));
  }

  const json = await res.json();
  const text = json?.choices?.[0]?.message?.content ?? "";
  return { text: typeof text === "string" ? text.trim() : "" };
}
