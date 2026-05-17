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

function openAiSseChunk(
  encoder: TextEncoder,
  controller: ReadableStreamDefaultController<Uint8Array>,
  id: string,
  created: number,
  model: string,
  delta: Record<string, string>,
  finishReason: string | null,
) {
  controller.enqueue(
    encoder.encode(
      `data: ${JSON.stringify({
        id,
        object: "chat.completion.chunk",
        created,
        model,
        choices: [{ index: 0, delta, finish_reason: finishReason }],
      })}\n\n`,
    ),
  );
}

/**
 * Beyond Presence requires SSE. Langflow stream=true breaks this user's RAG flow,
 * so we respond immediately then run Langflow with stream=false.
 */
export function streamLangflowChat(
  message: string,
  sessionId: string,
  model: string,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const id = `chatcmpl-${crypto.randomUUID()}`;
  const created = Math.floor(Date.now() / 1000);

  return new ReadableStream({
    async start(controller) {
      const sendDelta = (delta: Record<string, string>, finish: string | null = null) => {
        openAiSseChunk(encoder, controller, id, created, model, delta, finish);
      };

      const closeWithError = (text: string) => {
        sendDelta({ role: "assistant" });
        sendDelta({ content: text });
        sendDelta({}, "stop");
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      };

      if (!message.trim()) {
        closeWithError("Pesan kosong.");
        return;
      }

      if (!isLangflowConfigured()) {
        closeWithError("Langflow belum dikonfigurasi di server.");
        return;
      }

      sendDelta({ role: "assistant" });
      sendDelta({
        content: "Sebentar ya, saya cek dokumen perusahaan dulu... ",
      });

      try {
        const { reply } = await runLangflowChat(message, sessionId);
        const chunks = reply.match(/\S+\s*|\s+/g) ?? [reply];
        for (const chunk of chunks) {
          sendDelta({ content: chunk });
        }
        sendDelta({}, "stop");
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (err) {
        const msg =
          err instanceof LangflowError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Gagal menghubungi Langflow.";
        closeWithError(`Maaf, terjadi kesalahan: ${msg.slice(0, 200)}`);
      }
    },
  });
}
