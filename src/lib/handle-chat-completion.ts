import { corsHeaders } from "@/lib/api-cors";
import {
  buildChatCompletion,
  getLastUserMessage,
  resolveSessionId,
  verifyLlmApiKey,
  type ChatCompletionRequest,
} from "@/lib/openai-langflow";
import { LangflowError, runLangflowChat, streamLangflowChat } from "@/lib/run-langflow";

const streamHeaders = {
  ...corsHeaders,
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
};

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

  if (body.stream) {
    return new Response(streamLangflowChat(message, sessionId, model), {
      headers: streamHeaders,
    });
  }

  try {
    const { reply } = await runLangflowChat(message, sessionId);
    return Response.json(buildChatCompletion(reply, model), { headers: corsHeaders });
  } catch (err) {
    if (err instanceof LangflowError) {
      return Response.json({ error: err.message }, { status: err.status, headers: corsHeaders });
    }
    const msg = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500, headers: corsHeaders });
  }
}
