type OpenAIMessage = {
  role: string;
  content?: string | null;
};

export type ChatCompletionRequest = {
  messages?: OpenAIMessage[];
  model?: string;
  stream?: boolean;
  user?: string;
};

export function getLastUserMessage(messages: OpenAIMessage[] | undefined): string {
  if (!messages?.length) return "";
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === "user" && typeof msg.content === "string") {
      return msg.content.trim();
    }
  }
  return "";
}

export function resolveSessionId(req: Request, body: ChatCompletionRequest): string {
  const headerSession = req.headers.get("x-session-id");
  if (headerSession?.trim()) return headerSession.trim();
  if (typeof body.user === "string" && body.user.trim()) return body.user.trim();
  return crypto.randomUUID();
}

export function verifyLlmApiKey(req: Request): boolean {
  const expected = process.env.BEY_LLM_API_KEY ?? process.env.CUSTOM_LLM_API_KEY;
  if (!expected) return true;

  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return false;
  const token = auth.slice(7);
  if (token === "none" && expected === "none") return true;
  return token === expected;
}

export function buildChatCompletion(
  content: string,
  model = "langflow",
): Record<string, unknown> {
  const id = `chatcmpl-${crypto.randomUUID()}`;
  return {
    id,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message: { role: "assistant", content },
        finish_reason: "stop",
      },
    ],
  };
}

/** OpenAI-compatible SSE stream (Beyond Presence requires streaming support). */
export function buildChatCompletionStream(
  content: string,
  model = "langflow",
): ReadableStream<Uint8Array> {
  const id = `chatcmpl-${crypto.randomUUID()}`;
  const created = Math.floor(Date.now() / 1000);
  const encoder = new TextEncoder();

  const chunks = content.match(/\S+\s*|\s+/g) ?? [content];

  return new ReadableStream({
    start(controller) {
      const send = (payload: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      send({
        id,
        object: "chat.completion.chunk",
        created,
        model,
        choices: [{ index: 0, delta: { role: "assistant" }, finish_reason: null }],
      });

      for (const chunk of chunks) {
        send({
          id,
          object: "chat.completion.chunk",
          created,
          model,
          choices: [{ index: 0, delta: { content: chunk }, finish_reason: null }],
        });
      }

      send({
        id,
        object: "chat.completion.chunk",
        created,
        model,
        choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
      });

      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
}

export function isChatCompletionRequest(body: unknown): body is ChatCompletionRequest {
  return (
    typeof body === "object" &&
    body !== null &&
    "messages" in body &&
    Array.isArray((body as ChatCompletionRequest).messages)
  );
}

export function isBeyondPresenceWebhook(body: unknown): boolean {
  return (
    typeof body === "object" &&
    body !== null &&
    "event_type" in body &&
    typeof (body as { event_type: unknown }).event_type === "string"
  );
}
