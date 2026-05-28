import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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
    if (!key) throw new Error("YOUTUBE_API_KEY is not configured");

    const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
    searchUrl.searchParams.set("part", "snippet");
    searchUrl.searchParams.set("type", "video");
    searchUrl.searchParams.set("maxResults", "5");
    searchUrl.searchParams.set("q", data.query);
    searchUrl.searchParams.set("key", key);

    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) {
      const body = await searchRes.text();
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
    const endpoint = process.env.PLAYBACK_ENDPOINT_URL;
    if (!endpoint) throw new Error("PLAYBACK_ENDPOINT_URL is not configured");

    // 1. Notify external playback endpoint
    let endpointStatus: number | null = null;
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: data.url, roomId: data.roomId }),
      });
      endpointStatus = res.status;
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Playback endpoint returned ${res.status}: ${body.slice(0, 200)}`);
      }
    } catch (err) {
      console.error("Playback endpoint error", err);
      throw err instanceof Error ? err : new Error("Playback endpoint request failed");
    }

    // 2. Insert into shared queue (triggers Supabase Realtime fan-out)
    const { data: inserted, error } = await supabaseAdmin
      .from("queue_tracks")
      .insert({
        room_id: data.roomId,
        video_id: data.videoId,
        youtube_url: data.url,
        title: data.title,
        channel: data.channel ?? null,
        thumbnail_url: data.thumbnail ?? null,
        duration_seconds: data.durationSeconds ?? null,
        added_by: data.addedBy ?? null,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to add track to queue: ${error.message}`);

    return { track: inserted, endpointStatus };
  });
