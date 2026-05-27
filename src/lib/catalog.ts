// SyncBeat audio catalog — generated from ImageKit /tracks folder.
export const IMAGEKIT_ENDPOINT = "https://ik.imagekit.io/t0cdxxekm";

export interface Track {
  id: string;
  title: string;
  artist: string;
  path: string; // path relative to the ImageKit endpoint
  duration?: number; // seconds (optional)
  cover?: string; // optional cover image path
}

export const CATALOG: Track[] = [
  {
    id: "raja-shivaji-anthem",
    title: "Raja Shivaji Anthem Chhatrapati",
    artist: "Ajay Gogavale",
    path: "/tracks/Raja%20Shivaji%20Anthem%20Chhatrapati%20-%20DjBaap.mp3",
    duration: 365,
  },
];

export function trackUrl(track: Track): string {
  return `${IMAGEKIT_ENDPOINT}${track.path}`;
}

export function getTrack(id: string | null | undefined): Track | undefined {
  if (!id) return undefined;
  return CATALOG.find((t) => t.id === id);
}
