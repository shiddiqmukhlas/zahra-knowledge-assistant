import { corsHeaders, optionsResponse } from "@/lib/api-cors";
import { handleChatCompletion } from "@/lib/handle-chat-completion";
import {
  isBeyondPresenceWebhook,
  isChatCompletionRequest,
  type ChatCompletionRequest,
} from "@/lib/openai-langflow";
import { handleBeyondPresenceWebhook } from "@/lib/webhook-handler";

export async function OPTIONS() {
  return optionsResponse();
}

/**
 * Beyond Presence webhook events (Settings → Webhooks):
 *   POST https://zahra-knowledge-assistant.vercel.app/webhook
 *
 * Also accepts OpenAI-style chat completion bodies on the same path
 * if you point External LLM base URL to .../webhook (non-standard).
 * Prefer /v1/chat/completions for External LLM.
 */
export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();

    if (isBeyondPresenceWebhook(body)) {
      const res = await handleBeyondPresenceWebhook(body);
      const data = await res.json();
      return Response.json(data, { status: res.status, headers: corsHeaders });
    }

    if (isChatCompletionRequest(body)) {
      return handleChatCompletion(request, body as ChatCompletionRequest);
    }

    return Response.json(
      { error: "Expected Beyond Presence event_type or OpenAI messages payload" },
      { status: 400, headers: corsHeaders },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500, headers: corsHeaders });
  }
}
