type BeyMessageEvent = {
  event_type: "message";
  call_id: string;
  message: {
    sender: "user" | "agent" | string;
    message: string;
    sent_at: string;
  };
  call_data?: {
    userName?: string;
    agentId?: string;
  };
};

type BeyCallEndedEvent = {
  event_type: "call_ended";
  call_id: string;
};

export async function handleBeyondPresenceWebhook(body: unknown): Promise<Response> {
  if (typeof body !== "object" || body === null || !("event_type" in body)) {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  const eventType = (body as { event_type: string }).event_type;

  switch (eventType) {
    case "test":
      return Response.json({ ok: true });

    case "message": {
      const event = body as BeyMessageEvent;
      console.info("[bey-webhook] message", {
        callId: event.call_id,
        sender: event.message?.sender,
        text: event.message?.message?.slice(0, 120),
        agentId: event.call_data?.agentId,
      });
      return Response.json({ ok: true });
    }

    case "call_ended": {
      const event = body as BeyCallEndedEvent;
      console.info("[bey-webhook] call_ended", { callId: event.call_id });
      return Response.json({ ok: true });
    }

    default:
      return Response.json({ error: `Unknown event_type: ${eventType}` }, { status: 400 });
  }
}
