import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { IMAGEKIT_ENDPOINT, type Track } from "@/lib/catalog";

export interface YouTubeResult {
  videoId: string;
  url: string;
  title: string;
  channel: string;
  thumbnail: string;
  durationSeconds: number | null;
}

function parseISO8601Duration(iso: string): number | null {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!m) return null;
  const [, h, mi, s] = m;
  return (Number(h ?? 0) * 3600) + (Number(mi ?? 0) * 60) + Number(s ?? 0);
}

export const searchYouTube = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ query: z.string().trim().min(1).max(200) }).parse(input),
  )
  .handler(async ({ data }) => {
    const key = process.env.YOUTUBE_API_KEY;
    console.log("[youtube.search] env check:", {
      keyExists: !!key,
      keyPrefix: key?.slice(0, 8),
      nodeEnv: process.env.NODE_ENV,
      tssBase: process.env.TSS_SERVER_FN_BASE,
    });
    if (!key) throw new Error("YOUTUBE_API_KEY is not configured");

    const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
    searchUrl.searchParams.set("part", "snippet");
    searchUrl.searchParams.set("type", "video");
    searchUrl.searchParams.set("maxResults", "5");
    searchUrl.searchParams.set("q", data.query);
    searchUrl.searchParams.set("key", key);

    const searchRes = await fetch(searchUrl);
    console.log("[youtube.search] fetch response:", { status: searchRes.status, ok: searchRes.ok });
    if (!searchRes.ok) {
      const body = await searchRes.text();
      console.error("[youtube.search] API error:", { status: searchRes.status, body: body.slice(0, 500) });
      throw new Error(`YouTube search failed: ${searchRes.status} ${body}`);
    }
    const searchJson = await searchRes.json() as {
      items: Array<{
        id: { videoId: string };
        snippet: { title: string; channelTitle: string; thumbnails: { medium?: { url: string }; default?: { url: string } } };
      }>;
    };

    const ids = searchJson.items.map((i) => i.id.videoId).filter(Boolean);
    if (ids.length === 0) return { results: [] as YouTubeResult[] };

    // Fetch durations
    const detailsUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
    detailsUrl.searchParams.set("part", "contentDetails");
    detailsUrl.searchParams.set("id", ids.join(","));
    detailsUrl.searchParams.set("key", key);
    const detailsRes = await fetch(detailsUrl);
    const durations = new Map<string, number | null>();
    if (detailsRes.ok) {
      const dj = await detailsRes.json() as {
        items: Array<{ id: string; contentDetails: { duration: string } }>;
      };
      for (const it of dj.items) durations.set(it.id, parseISO8601Duration(it.contentDetails.duration));
    }

    const results: YouTubeResult[] = searchJson.items.map((it) => ({
      videoId: it.id.videoId,
      url: `https://www.youtube.com/watch?v=${it.id.videoId}`,
      title: it.snippet.title,
      channel: it.snippet.channelTitle,
      thumbnail: it.snippet.thumbnails.medium?.url ?? it.snippet.thumbnails.default?.url ?? "",
      durationSeconds: durations.get(it.id.videoId) ?? null,
    }));

    return { results };
  });

/** Quick diagnostic — does the SSR / env-var pipeline work on Vercel? */
export const diagnosticFn = createServerFn({ method: "POST" }).handler(async () => {
  return {
    ok: true,
    youtubeKeyExists: !!process.env.YOUTUBE_API_KEY,
    youtubeKeyPrefix: process.env.YOUTUBE_API_KEY ? process.env.YOUTUBE_API_KEY.slice(0, 8) : null,
    nodeEnv: process.env.NODE_ENV ?? null,
    tssServerFnBase: process.env.TSS_SERVER_FN_BASE ?? null,
    playbackEndpointExists: !!process.env.PLAYBACK_ENDPOINT_URL,
  };
});

export const addQueueTrack = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({
      roomId: z.string().uuid(),
      videoId: z.string().min(1).max(32),
      url: z.string().url().max(500),
      title: z.string().trim().min(1).max(300),
      channel: z.string().trim().max(200).optional(),
      thumbnail: z.string().url().max(500).optional(),
      durationSeconds: z.number().int().min(0).max(86400).nullable().optional(),
      addedBy: z.string().trim().max(80).optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    // Fire-and-forget external playback endpoint
    const endpoint = process.env.PLAYBACK_ENDPOINT_URL;
    if (endpoint) {
      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: data.url, roomId: data.roomId }),
      }).catch(() => {});
    }

    return { ok: true };
  });

export interface ImageKitFile {
  name: string;
  filePath: string;
  url: string;
  fileType: string;
  size: number;
  customCoordinates?: string | null;
  [key: string]: unknown;
}

export const listImageKitTracks = createServerFn({ method: "POST" }).handler(async () => {
  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
  if (!privateKey) throw new Error("IMAGEKIT_PRIVATE_KEY is not configured");

  const auth = btoa(`${privateKey}:`);
  const res = await fetch("https://api.imagekit.io/v1/files?path=tracks&fileType=all&sortOrder=ASC", {
    headers: { Authorization: `Basic ${auth}` },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`ImageKit list files failed: ${res.status} ${body}`);
  }

  const files = (await res.json()) as ImageKitFile[];
  const tracks: Track[] = files
    .filter((f) => f.fileType === "non-image" || f.name.endsWith(".mp3"))
    .map((f) => {
      const name = f.name.replace(/\.mp3$/i, "").replace(/[_-]+/g, " ").trim();
      const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const parts = name.includes(" - ") ? name.split(/ - /).map((s) => s.trim()) : [name.replace(/\s+/g, " ").trim(), ""];
      return {
        id: id || `track-${Date.now()}`,
        title: (parts[0]?.trim() || name).replace(/^["']|["']$/g, "").trim(),
        artist: parts[1]?.trim() || "Unknown",
        path: `/tracks/${encodeURIComponent(f.name)}`,
        duration: undefined,
      };
    });

  return { tracks, endpoint: IMAGEKIT_ENDPOINT };
});
