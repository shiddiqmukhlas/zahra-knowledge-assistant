import { corsHeaders, optionsResponse } from "@/lib/api-cors";
import { handleChatCompletion } from "@/lib/handle-chat-completion";
import { isChatCompletionRequest, type ChatCompletionRequest } from "@/lib/openai-langflow";

export async function OPTIONS() {
  return optionsResponse();
}

/**
 * OpenAI-compatible endpoint for Beyond Presence External LLM.
 * Register base URL: https://zahra-knowledge-assistant.vercel.app/v1
 * (Beyond Presence calls POST /v1/chat/completions automatically)
 */
export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();

    if (!isChatCompletionRequest(body)) {
      return Response.json(
        { error: "Invalid OpenAI chat completion request" },
        { status: 400, headers: corsHeaders },
      );
    }

    return handleChatCompletion(request, body as ChatCompletionRequest);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500, headers: corsHeaders });
  }
}
