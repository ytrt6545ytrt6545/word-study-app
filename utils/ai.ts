import Constants from "expo-constants";
import * as Updates from "expo-updates";

// Centralized helpers for resolving OpenAI keys, handling fallbacks, and making API calls.

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

const PROMPT_SYSTEM_LINES = [
  "\u4f60\u662f\u4e00\u4f4d\u82f1\u4e2d\u8a5e\u5f59\u52a9\u624b\uff0c\u8acb\u8f38\u51fa\u0020\u004a\u0053\u004f\u004e\u0020\u7269\u4ef6\uff1a\u007b\u0020\u0065\u006e\u002c\u0020\u007a\u0068\u002c\u0020\u0065\u0078\u0061\u006d\u0070\u006c\u0065\u0045\u006e\u002c\u0020\u0065\u0078\u0061\u006d\u0070\u006c\u0065\u005a\u0068\u002c\u0020\u0070\u0068\u006f\u006e\u0065\u0074\u0069\u0063\u0020\u007d",
  "\u0065\u006e\u003a\u0020\u5c0d\u61c9\u7684\u82f1\u6587\u55ae\u5b57",
  "\u007a\u0068\u003a\u0020\u5c0d\u61c9\u7684\u4e2d\u6587\u7ffb\u8b6f\uff08\u4e0d\u5305\u542b\u8a3b\u89e3\uff09",
  "\u0065\u0078\u0061\u006d\u0070\u006c\u0065\u0045\u006e\u003a\u0020\u4e00\u53e5\u4f7f\u7528\u8a72\u55ae\u5b57\u7684\u82f1\u6587\u4f8b\u53e5",
  "\u0065\u0078\u0061\u006d\u0070\u006c\u0065\u005a\u0068\u003a\u0020\u4e0a\u8ff0\u4f8b\u53e5\u7684\u4e2d\u6587\u7ffb\u8b6f\uff08\u4e0d\u5305\u542b\u8a3b\u89e3\uff09",
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
    throw new Error(`OpenAI ${res.status}: ${err}`);
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
    throw new Error(`OpenAI ${res.status}: ${err}`);
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

  return {
    en: typeof normEn === "string" ? normEn.trim() : undefined,
    zh: typeof normZh === "string" ? sanitizeZh(normZh) : undefined,
    exampleEn: typeof normExEn === "string" ? normExEn.trim() : undefined,
    exampleZh: typeof normExZh === "string" ? (normExZh as string).trim() : undefined,
    phonetic: typeof normPhonetic === "string" ? normPhonetic.trim() : undefined,
  };
}
