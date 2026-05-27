// SyncBeat audio catalog — replace with your real ImageKit-hosted tracks.
// All paths are appended to IMAGEKIT_ENDPOINT to form the final stream URL.
export const IMAGEKIT_ENDPOINT = "https://ik.imagekit.io/t0cdxxekm";

export interface Track {
  id: string;
  title: string;
  artist: string;
  path: string; // path relative to the ImageKit endpoint
  duration?: number; // seconds (optional)
  cover?: string; // optional cover image path
}

// Seed catalog — swap the `path` fields to point at your own uploads.
// Until you upload your own files, these demo URLs use public sample MP3s.
export const CATALOG: Track[] = [
  {
    id: "midnight-pulse",
    title: "Midnight Pulse",
    artist: "Aurora Drift",
    path: "/tracks/midnight-pulse.mp3",
  },
  {
    id: "neon-skyline",
    title: "Neon Skyline",
    artist: "Vector Bloom",
    path: "/tracks/neon-skyline.mp3",
  },
  {
    id: "afterhours",
    title: "Afterhours",
    artist: "Halcyon",
    path: "/tracks/afterhours.mp3",
  },
  {
    id: "low-orbit",
    title: "Low Orbit",
    artist: "Parallel",
    path: "/tracks/low-orbit.mp3",
  },
  {
    id: "tides",
    title: "Tides",
    artist: "Soft Static",
    path: "/tracks/tides.mp3",
  },
  {
    id: "glass-room",
    title: "Glass Room",
    artist: "Mira Cole",
    path: "/tracks/glass-room.mp3",
  },
];

export function trackUrl(track: Track): string {
  return `${IMAGEKIT_ENDPOINT}${track.path}`;
}

export function getTrack(id: string | null | undefined): Track | undefined {
  if (!id) return undefined;
  return CATALOG.find((t) => t.id === id);
}
