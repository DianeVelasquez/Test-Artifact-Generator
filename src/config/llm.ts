import { WatsonxChatModel } from "beeai-framework/adapters/watsonx/backend/chat";
import { UserMessage } from "beeai-framework/backend/message";
import { config } from "dotenv";

config();

export type LLMProvider = "watsonx" | "openai" | "openai-compatible" | "anthropic" | "gemini";

export interface ChatLLMOptions {
  temperature?: number;
  maxTokens?: number;
}

export interface ChatLLM {
  provider: LLMProvider;
  model: string;
  complete(prompt: string, options?: ChatLLMOptions): Promise<string>;
}

export interface LLMConfig {
  provider: LLMProvider;
  apiKey?: string;
  model?: string;
  projectId?: string;
  baseUrl?: string;
}

type JsonObject = Record<string, unknown>;

async function parseJsonResponse<T>(response: Response, provider: string): Promise<T> {
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${provider} request failed (${response.status}): ${body}`);
  }

  return await response.json() as T;
}

class WatsonxLLMAdapter implements ChatLLM {
  provider: LLMProvider = "watsonx";
  model: string;
  private llm: WatsonxChatModel;

  constructor(config: Required<Pick<LLMConfig, "apiKey" | "model" | "projectId">> & Pick<LLMConfig, "baseUrl">) {
    this.model = config.model;
    this.llm = new WatsonxChatModel(config.model, {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      projectId: config.projectId,
    });
  }

  async complete(prompt: string, options?: ChatLLMOptions): Promise<string> {
    this.llm.config({
      parameters: {
        temperature: options?.temperature,
        maxTokens: options?.maxTokens,
      },
    });

    const response = await this.llm.create({
      messages: [new UserMessage(prompt)],
    });
    return response.getTextContent();
  }
}

class OpenAICompatibleLLMAdapter implements ChatLLM {
  provider: LLMProvider;
  model: string;
  private apiKey?: string;
  private baseUrl: string;

  constructor(config: Pick<LLMConfig, "apiKey" | "baseUrl"> & { model: string; provider?: LLMProvider }) {
    this.provider = config.provider || "openai-compatible";
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.baseUrl = (config.baseUrl || "https://api.openai.com/v1").replace(/\/$/, "");
  }

  async complete(prompt: string, options?: ChatLLMOptions): Promise<string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: "user", content: prompt }],
        temperature: options?.temperature,
        max_tokens: options?.maxTokens,
      }),
    });

    const data = await parseJsonResponse<{
      choices?: Array<{ message?: { content?: string } }>;
    }>(response, this.provider);
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error(`${this.provider} response did not include message content.`);
    }
    return content;
  }
}

class AnthropicLLMAdapter implements ChatLLM {
  provider: LLMProvider = "anthropic";
  model: string;
  private apiKey: string;
  private baseUrl: string;

  constructor(config: Required<Pick<LLMConfig, "apiKey" | "model">> & Pick<LLMConfig, "baseUrl">) {
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.baseUrl = (config.baseUrl || "https://api.anthropic.com/v1").replace(/\/$/, "");
  }

  async complete(prompt: string, options?: ChatLLMOptions): Promise<string> {
    const response = await fetch(`${this.baseUrl}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: options?.maxTokens ?? 4096,
        temperature: options?.temperature,
      }),
    });

    const data = await parseJsonResponse<{
      content?: Array<{ type?: string; text?: string }>;
    }>(response, this.provider);
    const content = data.content
      ?.filter((block) => block.type === "text" && block.text)
      .map((block) => block.text)
      .join("\n");

    if (!content) {
      throw new Error("Anthropic response did not include text content.");
    }
    return content;
  }
}

class GeminiLLMAdapter implements ChatLLM {
  provider: LLMProvider = "gemini";
  model: string;
  private apiKey: string;
  private baseUrl: string;

  constructor(config: Required<Pick<LLMConfig, "apiKey" | "model">> & Pick<LLMConfig, "baseUrl">) {
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.baseUrl = (config.baseUrl || "https://generativelanguage.googleapis.com/v1beta").replace(/\/$/, "");
  }

  async complete(prompt: string, options?: ChatLLMOptions): Promise<string> {
    const generationConfig: JsonObject = {};
    if (options?.temperature !== undefined) {
      generationConfig.temperature = options.temperature;
    }
    if (options?.maxTokens !== undefined) {
      generationConfig.maxOutputTokens = options.maxTokens;
    }

    const response = await fetch(`${this.baseUrl}/models/${this.model}:generateContent?key=${encodeURIComponent(this.apiKey)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig,
      }),
    });

    const data = await parseJsonResponse<{
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    }>(response, this.provider);
    const content = data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text)
      .filter(Boolean)
      .join("\n");

    if (!content) {
      throw new Error("Gemini response did not include text content.");
    }
    return content;
  }
}

function getProvider(customConfig?: Partial<LLMConfig>): LLMProvider {
  const provider = customConfig?.provider || process.env.LLM_PROVIDER || "watsonx";
  switch (provider) {
    case "watsonx":
    case "openai":
    case "openai-compatible":
    case "anthropic":
    case "gemini":
      return provider;
    case "gpt":
      return "openai";
    case "claude":
      return "anthropic";
    case "google":
      return "gemini";
    default:
      throw new Error(`Unsupported LLM_PROVIDER: ${provider}`);
  }
}

export function createLLM(customConfig?: Partial<LLMConfig>): ChatLLM {
  const provider = getProvider(customConfig);

  if (provider === "openai" || provider === "openai-compatible") {
    return new OpenAICompatibleLLMAdapter({
      apiKey: customConfig?.apiKey || process.env.LLM_API_KEY || process.env.OPENAI_API_KEY,
      baseUrl: customConfig?.baseUrl || process.env.LLM_BASE_URL || process.env.OPENAI_BASE_URL || process.env.OPENAI_API_ENDPOINT,
      model: customConfig?.model || process.env.LLM_MODEL || process.env.OPENAI_MODEL || process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini",
      provider,
    });
  }

  if (provider === "anthropic") {
    return createAnthropicLLM(customConfig);
  }

  if (provider === "gemini") {
    return createGeminiLLM(customConfig);
  }

  return createWatsonxLLM(customConfig);
}

function createAnthropicLLM(customConfig?: Partial<LLMConfig>): ChatLLM {
  const apiKey = customConfig?.apiKey || process.env.LLM_API_KEY || process.env.ANTHROPIC_API_KEY;
  const model = customConfig?.model || process.env.LLM_MODEL || process.env.ANTHROPIC_MODEL || process.env.ANTHROPIC_CHAT_MODEL || process.env.CLAUDE_MODEL || "claude-3-5-sonnet-latest";
  const baseUrl = customConfig?.baseUrl || process.env.LLM_BASE_URL || process.env.ANTHROPIC_BASE_URL || process.env.ANTHROPIC_API_BASE_URL;

  if (!apiKey) {
    throw new Error("LLM_API_KEY or ANTHROPIC_API_KEY is required for the Anthropic provider.");
  }

  return new AnthropicLLMAdapter({ apiKey, model, baseUrl });
}

function createGeminiLLM(customConfig?: Partial<LLMConfig>): ChatLLM {
  const apiKey = customConfig?.apiKey || process.env.LLM_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const model = customConfig?.model || process.env.LLM_MODEL || process.env.GEMINI_MODEL || "gemini-1.5-pro";
  const baseUrl = customConfig?.baseUrl || process.env.LLM_BASE_URL || process.env.GEMINI_BASE_URL;

  if (!apiKey) {
    throw new Error("LLM_API_KEY, GEMINI_API_KEY, or GOOGLE_API_KEY is required for the Gemini provider.");
  }

  return new GeminiLLMAdapter({ apiKey, model, baseUrl });
}

function createWatsonxLLM(customConfig?: Partial<LLMConfig>): ChatLLM {
  const apiKey = customConfig?.apiKey || process.env.LLM_API_KEY || process.env.WATSONX_API_KEY;
  const model = customConfig?.model || process.env.LLM_MODEL || process.env.WATSONX_CHAT_MODEL || "ibm/granite-3-3-8b-instruct";
  const projectId = customConfig?.projectId || process.env.WATSONX_PROJECT_ID;
  const baseUrl = customConfig?.baseUrl || process.env.LLM_BASE_URL || process.env.WATSONX_URL;

  if (!apiKey) {
    throw new Error(
      "LLM_API_KEY or WATSONX_API_KEY is required for the WatsonX provider."
    );
  }
  if (!projectId) {
    throw new Error(
      "WATSONX_PROJECT_ID is required for the WatsonX provider."
    );
  }

  return new WatsonxLLMAdapter({ apiKey, model, projectId, baseUrl });
}

export function getDefaultLLM(): ChatLLM {
  return createLLM();
}
