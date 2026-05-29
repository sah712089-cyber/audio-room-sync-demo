import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const IMAGEKIT_PRIVATE_KEY = process.env.IMAGEKIT_PRIVATE_KEY ?? "";
const IMAGEKIT_UPLOAD_URL = "https://upload.imagekit.io/api/v1/files/upload";

async function uploadToImageKit(
  fileBase64: string,
  fileName: string,
): Promise<string> {
  const auth = Buffer.from(`${IMAGEKIT_PRIVATE_KEY}:`).toString("base64");
  const form = new FormData();
  form.append("file", fileBase64);
  form.append("fileName", fileName);
  form.append("folder", "/tracks");
  form.append("useUniqueFileName", "true");

  const res = await fetch(IMAGEKIT_UPLOAD_URL, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}` },
    body: form,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`ImageKit upload failed (${res.status}): ${body}`);
  }

  const json = (await res.json()) as { filePath: string };
  return json.filePath;
}

export const uploadTrack = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      roomId: z.string().uuid(),
      fileBase64: z.string().min(1),
      fileName: z.string().min(1),
      title: z.string().min(1).max(200),
      artist: z.string().max(200).default("Unknown"),
      uploadedBy: z.string().min(1).max(50),
    }),
  )
  .handler(async ({ data }) => {
    const path = await uploadToImageKit(data.fileBase64, data.fileName);

    const { data: track, error } = await (supabaseAdmin as any)
      .from("tracks")
      .insert({
        room_id: data.roomId,
        title: data.title,
        artist: data.artist || "Unknown",
        path,
        uploaded_by: data.uploadedBy,
      })
      .select()
      .single();

    if (error || !track) {
      throw new Error(`Failed to save track: ${error?.message ?? "unknown"}`);
    }

    return {
      id: track.id,
      title: track.title,
      artist: track.artist,
      path: track.path,
      duration: track.duration ?? undefined,
      uploadedBy: track.uploaded_by,
    };
  });
