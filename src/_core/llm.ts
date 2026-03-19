import OpenAI from "openai";
import { ENV } from "./env";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type Role = "system" | "user" | "assistant";

export type Message = {
  role: Role;
  content: string;
};

export type InvokeParams = {
  messages: Message[];
  responseFormat?: { type: "json" | "text" };
  useWebSearch?: boolean;
  maxTokens?: number;
};

export type InvokeResult = {
  content: string;
};

// ─── Modelos ──────────────────────────────────────────────────────────────────

// gpt-4o-search-preview: búsquedas web en tiempo real
const MODEL_SEARCH = "gpt-4o-search-preview";
// gpt-4o: generación sin búsqueda (más rápido y barato)
const MODEL_DEFAULT = "gpt-4o";

// ─── Cliente OpenAI ───────────────────────────────────────────────────────────

function getClient(): OpenAI {
  if (!ENV.openaiApiKey) {
    throw new Error("OPENAI_API_KEY no configurado");
  }
  return new OpenAI({ apiKey: ENV.openaiApiKey });
}

// ─── Función principal ────────────────────────────────────────────────────────

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  const client = getClient();
  const { messages, responseFormat, useWebSearch = true, maxTokens = 4096 } = params;

  const systemMsg = messages.find((m) => m.role === "system");
  const otherMessages = messages.filter((m) => m.role !== "system");

  let systemContent = systemMsg?.content ?? "";

  // Para JSON mode, reforzar en el system prompt
  if (responseFormat?.type === "json") {
    systemContent +=
      "\n\nIMPORTANTE: Responde ÚNICAMENTE con JSON válido. Sin texto adicional, sin bloques de código markdown, sin explicaciones. Solo el objeto JSON.";
  }

  const chatMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

  if (systemContent) {
    chatMessages.push({ role: "system", content: systemContent });
  }

  for (const m of otherMessages) {
    chatMessages.push({
      role: m.role as "user" | "assistant",
      content: m.content,
    });
  }

  if (useWebSearch) {
    // gpt-4o-search-preview tiene web search nativo
    // web_search_options no está en los tipos estándar aún, se usa cast
    const response = await (client.chat.completions.create as Function)({
      model: MODEL_SEARCH,
      max_tokens: maxTokens,
      messages: chatMessages,
      web_search_options: {},
    });

    return { content: (response.choices[0].message.content as string) ?? "" };
  } else {
    // gpt-4o para generación: soporte nativo de json_object
    const createParams: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = {
      model: MODEL_DEFAULT,
      max_tokens: maxTokens,
      messages: chatMessages,
    };

    if (responseFormat?.type === "json") {
      createParams.response_format = { type: "json_object" };
    }

    const response = await client.chat.completions.create(createParams);
    return { content: response.choices[0].message.content ?? "" };
  }
}

// ─── Helper para parsear JSON de la respuesta ─────────────────────────────────

export function parseJSON<T>(content: string): T {
  // Limpiar posibles bloques de código markdown
  const cleaned = content
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Intentar extraer el primer objeto JSON del texto
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]) as T;
    }
    throw new Error(`No se pudo parsear JSON: ${cleaned.slice(0, 200)}`);
  }
}
