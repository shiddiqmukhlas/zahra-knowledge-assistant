import { corsHeaders } from "@/lib/api-cors";
import {
  buildChatCompletion,
  buildChatCompletionStream,
  getLastUserMessage,
  resolveSessionId,
  verifyLlmApiKey,
  type ChatCompletionRequest,
} from "@/lib/openai-langflow";
import { LangflowError, runLangflowChat } from "@/lib/run-langflow";

export async function handleChatCompletion(
  req: Request,
  body: ChatCompletionRequest,
): Promise<Response> {
  if (!verifyLlmApiKey(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
  }

  const message = getLastUserMessage(body.messages);
  if (!message) {
    return Response.json(
      { error: "No user message in messages array" },
      { status: 400, headers: corsHeaders },
    );
  }

  const sessionId = resolveSessionId(req, body);
  const model = body.model ?? "langflow";

  try {
    const { reply } = await runLangflowChat(message, sessionId);

    if (body.stream) {
      return new Response(buildChatCompletionStream(reply, model), {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    return Response.json(buildChatCompletion(reply, model), { headers: corsHeaders });
  } catch (err) {
    if (err instanceof LangflowError) {
      return Response.json({ error: err.message }, { status: err.status, headers: corsHeaders });
    }
    const msg = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500, headers: corsHeaders });
  }
}
