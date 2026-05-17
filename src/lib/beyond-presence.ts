export const BEYOND_PRESENCE_EMBED_DEFAULT =
  "https://bey.chat/9e6a257d-3ac3-4ec2-85d1-acbd94531cfa";

export function getBeyondPresenceEmbedUrl(): string {
  return (
    process.env.NEXT_PUBLIC_BEYOND_PRESENCE_EMBED_URL ??
    BEYOND_PRESENCE_EMBED_DEFAULT
  );
}
