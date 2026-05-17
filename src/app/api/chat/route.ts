import { NextRequest, NextResponse } from "next/server";
import {
  extractLangflowText,
  getLangflowConfig,
  isLangflowConfigured,
  type LangflowRunResponse,
} from "@/lib/langflow";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const sessionId =
      typeof body.sessionId === "string" && body.sessionId.trim()
        ? body.sessionId.trim()
        : crypto.randomUUID();

    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    if (!isLangflowConfigured()) {
      return NextResponse.json(
        {
          error:
            "Langflow belum dikonfigurasi. Set LANGFLOW_URL, LANGFLOW_FLOW_ID, dan LANGFLOW_API_KEY di .env.local",
        },
        { status: 503 },
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
      return NextResponse.json(
        { error: `Langflow error (${langflowRes.status}): ${raw.slice(0, 500)}` },
        { status: langflowRes.status },
      );
    }

    let data: LangflowRunResponse;
    try {
      data = JSON.parse(raw) as LangflowRunResponse;
    } catch {
      return NextResponse.json(
        { error: "Invalid response from Langflow" },
        { status: 502 },
      );
    }

    const reply = extractLangflowText(data);
    if (!reply) {
      return NextResponse.json(
        { error: "Could not parse Langflow response", raw: data },
        { status: 502 },
      );
    }

    return NextResponse.json({
      reply,
      sessionId: data.session_id ?? sessionId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
