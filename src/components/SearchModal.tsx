import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { searchYouTube, addQueueTrack, type YouTubeResult } from "@/lib/youtube.functions";

interface Props {
  open: boolean;
  onClose: () => void;
  roomId: string;
  addedBy?: string;
}

function fmtDuration(s: number | null): string {
  if (s == null) return "";
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export function SearchModal({ open, onClose, roomId, addedBy }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<YouTubeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const search = useServerFn(searchYouTube);
  const add = useServerFn(addQueueTrack);

  useEffect(() => {
    if (open) {
      setQuery(""); setResults([]); setError(null); setSubmittingId(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q || searching) return;
    setSearching(true); setError(null); setResults([]);
    try {
      const { results } = await search({ data: { query: q } });
      setResults(results);
      if (results.length === 0) setError("No results found.");
    } catch (err) {
      console.error(err);
      setError("Search unavailable. Try again.");
    } finally {
      setSearching(false);
    }
  }

  async function onPick(r: YouTubeResult) {
    if (submittingId) return;
    setSubmittingId(r.videoId); setError(null);
    try {
      await add({
        data: {
          roomId,
          videoId: r.videoId,
          url: r.url,
          title: r.title,
          channel: r.channel,
          thumbnail: r.thumbnail || undefined,
          durationSeconds: r.durationSeconds,
          addedBy,
        },
      });
      setSubmittingId(null);
      setError("Song will be added in a minute");
      setTimeout(onClose, 2000);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Submission failed");
      setSubmittingId(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-background/80 backdrop-blur-sm p-4 pt-16 sm:pt-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-xl rounded-3xl border border-border/60 bg-card/90 backdrop-blur-xl shadow-2xl glow-mint"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-bold text-lg">Add music</h2>
            <button
              onClick={onClose}
              aria-label="Close"
              className="size-8 rounded-full hover:bg-secondary/70 flex items-center justify-center text-muted-foreground hover:text-foreground transition"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>

          <form onSubmit={onSubmit} className="flex gap-2">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              maxLength={200}
              placeholder="Search YouTube — artist, song, vibe…"
              className="flex-1 rounded-full bg-secondary/60 border border-border/60 px-4 py-2.5 text-sm placeholder:text-muted-foreground/70 focus:outline-none focus:border-mint focus:ring-1 focus:ring-mint transition"
            />
            <button
              type="submit"
              disabled={searching || !query.trim()}
              className="rounded-full bg-mint text-primary-foreground font-semibold px-5 py-2.5 text-sm glow-mint hover:scale-[1.02] active:scale-95 transition disabled:opacity-50 disabled:hover:scale-100"
            >
              {searching ? "…" : "Search"}
            </button>
          </form>

          {error && (
            <div className={`mt-3 text-sm rounded-xl px-3 py-2 ${
              error.startsWith("Song will be added")
                ? "text-mint bg-mint/10 border border-mint/30"
                : "text-destructive bg-destructive/10 border border-destructive/30"
            }`}>
              {error}
            </div>
          )}

          <ul className="mt-4 space-y-1.5 max-h-[55vh] overflow-y-auto -mr-2 pr-2">
            {searching && Array.from({ length: 3 }).map((_, i) => (
              <li key={i} className="flex gap-3 p-2 rounded-xl bg-secondary/30 animate-pulse">
                <div className="size-16 rounded-lg bg-secondary/60 shrink-0" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-3 rounded bg-secondary/60 w-3/4" />
                  <div className="h-3 rounded bg-secondary/60 w-1/2" />
                </div>
              </li>
            ))}

            {!searching && results.map((r) => {
              const isSubmitting = submittingId === r.videoId;
              return (
                <li key={r.videoId}>
                  <button
                    onClick={() => onPick(r)}
                    disabled={!!submittingId}
                    className="group w-full flex gap-3 p-2 rounded-xl text-left hover:bg-secondary/60 transition disabled:opacity-50"
                  >
                    <div className="relative size-16 rounded-lg overflow-hidden bg-secondary/60 shrink-0">
                      {r.thumbnail && (
                        <img src={r.thumbnail} alt="" className="size-full object-cover" loading="lazy" />
                      )}
                      {r.durationSeconds != null && (
                        <span className="absolute bottom-0.5 right-0.5 text-[10px] font-mono bg-background/80 text-foreground px-1 rounded">
                          {fmtDuration(r.durationSeconds)}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold truncate">{r.title}</div>
                      <div className="text-xs text-muted-foreground truncate">{r.channel}</div>
                      <div className="mt-1 text-[11px] text-mint opacity-0 group-hover:opacity-100 transition">
                        {isSubmitting ? "Adding…" : "Click to add to queue →"}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>

          {!searching && results.length === 0 && !error && (
            <p className="mt-6 text-center text-xs text-muted-foreground">
              Top 5 YouTube results will appear here.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
