import {
  extractLangflowText,
  getLangflowConfig,
  isLangflowConfigured,
  type LangflowRunResponse,
} from "@/lib/langflow";

export class LangflowError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

function langflowHeaders(baseUrl: string, apiKey: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "x-api-key": apiKey,
  };
  if (baseUrl.includes("ngrok")) {
    headers["ngrok-skip-browser-warning"] = "true";
  }
  return headers;
}

export async function runLangflowChat(
  message: string,
  sessionId: string,
): Promise<{ reply: string; sessionId: string }> {
  if (!message.trim()) {
    throw new LangflowError("Message is required", 400);
  }

  if (!isLangflowConfigured()) {
    throw new LangflowError(
      "Langflow belum dikonfigurasi. Set LANGFLOW_URL, LANGFLOW_FLOW_ID, dan LANGFLOW_API_KEY.",
      503,
    );
  }

  const { baseUrl, flowId, apiKey } = getLangflowConfig();
  const url = `${baseUrl!.replace(/\/$/, "")}/api/v1/run/${flowId}?stream=false`;

  const langflowRes = await fetch(url, {
    method: "POST",
    headers: langflowHeaders(baseUrl!, apiKey!),
    body: JSON.stringify({
      input_value: message,
      input_type: "chat",
      output_type: "chat",
      session_id: sessionId,
    }),
  });

  const raw = await langflowRes.text();

  if (!langflowRes.ok) {
    throw new LangflowError(
      `Langflow error (${langflowRes.status}): ${raw.slice(0, 500)}`,
      langflowRes.status,
    );
  }

  let data: LangflowRunResponse;
  try {
    data = JSON.parse(raw) as LangflowRunResponse;
  } catch {
    throw new LangflowError("Invalid response from Langflow", 502);
  }

  const reply = extractLangflowText(data);
  if (!reply) {
    throw new LangflowError("Could not parse Langflow response", 502);
  }

  return {
    reply,
    sessionId: data.session_id ?? sessionId,
  };
}

type LangflowStreamEvent = {
  event?: string;
  data?: {
    chunk?: string;
    result?: { session_id?: string; message?: string };
  };
};

/** Stream Langflow tokens as OpenAI SSE (for Beyond Presence). */
export function streamLangflowChat(
  message: string,
  sessionId: string,
  model: string,
): ReadableStream<Uint8Array> {
  if (!message.trim()) {
    return errorStream("Message is required");
  }

  if (!isLangflowConfigured()) {
    return errorStream("Langflow not configured");
  }

  const { baseUrl, flowId, apiKey } = getLangflowConfig();
  const url = `${baseUrl!.replace(/\/$/, "")}/api/v1/run/${flowId}?stream=true`;
  const encoder = new TextEncoder();
  const id = `chatcmpl-${crypto.randomUUID()}`;
  const created = Math.floor(Date.now() / 1000);

  return new ReadableStream({
    async start(controller) {
      const send = (payload: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      const sendError = (text: string) => {
        send({
          id,
          object: "chat.completion.chunk",
          created,
          model,
          choices: [{ index: 0, delta: { content: text }, finish_reason: null }],
        });
        send({
          id,
          object: "chat.completion.chunk",
          created,
          model,
          choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
        });
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      };

      try {
        const langflowRes = await fetch(url, {
          method: "POST",
          headers: langflowHeaders(baseUrl!, apiKey!),
          body: JSON.stringify({
            input_value: message,
            input_type: "chat",
            output_type: "chat",
            session_id: sessionId,
          }),
        });

        if (!langflowRes.ok) {
          const raw = await langflowRes.text();
          sendError(`Langflow error: ${raw.slice(0, 200)}`);
          return;
        }

        if (!langflowRes.body) {
          sendError("Langflow returned empty stream");
          return;
        }

        send({
          id,
          object: "chat.completion.chunk",
          created,
          model,
          choices: [{ index: 0, delta: { role: "assistant" }, finish_reason: null }],
        });

        const reader = langflowRes.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let sentContent = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed === "data: [DONE]") continue;

            let jsonStr = trimmed;
            if (trimmed.startsWith("data:")) {
              jsonStr = trimmed.slice(5).trim();
            }

            try {
              const evt = JSON.parse(jsonStr) as LangflowStreamEvent;
              if (evt.event === "token" && evt.data?.chunk) {
                sentContent = true;
                send({
                  id,
                  object: "chat.completion.chunk",
                  created,
                  model,
                  choices: [
                    { index: 0, delta: { content: evt.data.chunk }, finish_reason: null },
                  ],
                });
              }
            } catch {
              // ignore non-json lines
            }
          }
        }

        if (!sentContent) {
          const { reply } = await runLangflowChat(message, sessionId);
          const chunks = reply.match(/\S+\s*|\s+/g) ?? [reply];
          for (const chunk of chunks) {
            send({
              id,
              object: "chat.completion.chunk",
              created,
              model,
              choices: [{ index: 0, delta: { content: chunk }, finish_reason: null }],
            });
          }
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
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Stream failed";
        sendError(msg);
      }
    },
  });
}

function errorStream(message: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ error: message })}\n\n\ndata: [DONE]\n\n`,
        ),
      );
      controller.close();
    },
  });
}
