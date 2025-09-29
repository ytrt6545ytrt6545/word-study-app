export type AIResponse = { text: string };

export async function callAI(prompt: string): Promise<AIResponse> {
  const key = process.env.EXPO_PUBLIC_OPENAI_API_KEY;

  // In development, allow a mock response if no key is set
  if (!key) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      await new Promise((r) => setTimeout(r, 300));
      return { text: `示範回應：${prompt || '請輸入內容'}` };
    }
    throw new Error('尚未設定 OpenAI API Key，請設置環境變數 EXPO_PUBLIC_OPENAI_API_KEY 後再建置。');
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      messages: [
        { role: 'system', content: '你是英中翻譯助手，只輸出簡短中文翻譯，不要解釋。' },
        { role: 'user', content: prompt || '請輸入內容' },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI ${res.status}: ${err}`);
  }

  const json = await res.json();
  const text = json?.choices?.[0]?.message?.content ?? '';
  return { text };
}

// ---- Word completion for Explore screen ----
export type AIFillResult = {
  en?: string;
  zh?: string;
  exampleEn?: string;
  exampleZh?: string;
};

export async function aiCompleteWord(input: { en?: string; zh?: string }): Promise<AIFillResult> {
  const key = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  const en = (input.en || '').trim();
  const zh = (input.zh || '').trim();

  // In development, return a mock if no key; in production, throw
  if (!key) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      const hasEn = !!en;
      const word = hasEn ? en : 'example';
      return {
        en: hasEn ? en : 'example',
        zh: zh || (hasEn ? '請填入對應中文翻譯' : '這是示例中文'),
        exampleEn: `This is an example sentence using ${word}.`,
        exampleZh: `這是一個示例句子，使用 ${hasEn ? en : 'example'}。`,
      };
    }
    throw new Error('尚未設定 OpenAI API Key，請設置 EXPO_PUBLIC_OPENAI_API_KEY 後再建置。');
  }

  // System prompt: ensure zh is pure translation (no explanations)
  const system = [
    '你是一位英中詞彙助手，請輸出 JSON 物件：{ en, zh, exampleEn, exampleZh }',
    'en: 英文單字',
    'zh: 對應的中文翻譯（不要解釋）',
    'exampleEn: 一句包含該單字的英文例句',
    'exampleZh: 上述例句的中文翻譯（不要解釋）',
  ].join('\n');

  const user = JSON.stringify({ en, zh });

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI ${res.status}: ${err}`);
  }

  const json = await res.json();
  const content: string = json?.choices?.[0]?.message?.content ?? '';

  // Try direct JSON parse first
  const tryParse = (text: string): AIFillResult | null => {
    try {
      const obj = JSON.parse(text);
      if (obj && typeof obj === 'object') return obj as AIFillResult;
      return null;
    } catch {
      return null;
    }
  };

  let parsed = tryParse(content);

  // If the model wrapped JSON in code fences, attempt to extract
  if (!parsed) {
    const m = content.match(/\{[\s\S]*\}/);
    if (m) parsed = tryParse(m[0]);
  }

  if (!parsed) throw new Error('AI 回傳格式無法解析');

  // Normalize trimming and enforce zh as pure translation (no explanations)
  const sanitizeZh = (value?: string) => {
    if (!value) return value;
    let s = value.trim();
    // Remove common wrapping quotes/brackets
    s = s.replace(/^[\'"`\u300C\u300E\u300A]+/, '').replace(/[\'"`\u300D\u300F\u300B]+$/, '');
    // Remove parenthetical/explanatory tails
    s = s.replace(/\(.*?\)/g, '');
    // Keep only the first sentence/clause (stop at first punctuation)
    const m2 = s.match(/^[^。；;.!?？]+/);
    if (m2) s = m2[0];
    return s.trim();
  };

  return {
    en: parsed.en?.trim(),
    zh: sanitizeZh(parsed.zh),
    exampleEn: parsed.exampleEn?.trim(),
    exampleZh: parsed.exampleZh?.trim(),
  };
}

