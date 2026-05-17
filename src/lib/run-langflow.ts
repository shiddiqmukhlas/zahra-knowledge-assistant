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
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "x-api-key": apiKey!,
    },
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
