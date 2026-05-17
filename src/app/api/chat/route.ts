import { NextRequest, NextResponse } from "next/server";
import { LangflowError, runLangflowChat } from "@/lib/run-langflow";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const sessionId =
      typeof body.sessionId === "string" && body.sessionId.trim()
        ? body.sessionId.trim()
        : crypto.randomUUID();

    const { reply, sessionId: nextSessionId } = await runLangflowChat(message, sessionId);

    return NextResponse.json({
      reply,
      sessionId: nextSessionId,
    });
  } catch (err) {
    if (err instanceof LangflowError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
