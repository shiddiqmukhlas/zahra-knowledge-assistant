"use client";

import { getBeyondPresenceEmbedUrl } from "@/lib/beyond-presence";

export default function BeyondPresenceEmbed() {
  const src = getBeyondPresenceEmbedUrl();

  return (
    <div className="flex h-full min-h-[280px] flex-col">
      <div className="shrink-0 border-b border-white/8 px-4 py-2.5">
        <p className="text-xs font-medium text-slate-400">Beyond Presence</p>
        <p className="text-[11px] text-slate-600">Voice & avatar agent</p>
      </div>
      <div className="relative min-h-0 flex-1">
        <iframe
          src={src}
          title="Beyond Presence Agent"
          className="absolute inset-0 h-full w-full"
          allow="camera; microphone; fullscreen"
          allowFullScreen
          style={{ border: "none", maxWidth: "100%" }}
        />
      </div>
    </div>
  );
}
