// DeepSeek 客户端（OpenAI 兼容协议）+ JSON 输出稳健解析
// key 只在服务端使用：.env.local 里配 DEEPSEEK_API_KEY；未配置时上层路由走「演示模式」

import OpenAI from "openai";

export function hasApiKey(): boolean {
  return Boolean(process.env.DEEPSEEK_API_KEY);
}

let client: OpenAI | null = null;

export function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
      // 演示现场保命：SDK 默认 10 分钟超时 + 2 次重试会把页面挂死，这里 45 秒封顶、最多重试 1 次
      timeout: 45_000,
      maxRetries: 1,
    });
  }
  return client;
}

export async function chatJSON(
  system: string,
  user: string,
  { maxTokens = 2000, temperature = 0.5 }: { maxTokens?: number; temperature?: number } = {}
): Promise<unknown> {
  const res = await getClient().chat.completions.create({
    model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: { type: "json_object" },
    max_tokens: maxTokens,
    temperature,
  });
  const text = res.choices[0]?.message?.content ?? "";
  return parseJSONLoose(text);
}

// 模型偶发在 JSON 外包裹 ```json 围栏或杂讯，这里稳健提取
export function parseJSONLoose(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("模型返回的不是合法 JSON：" + text.slice(0, 200));
  }
}
