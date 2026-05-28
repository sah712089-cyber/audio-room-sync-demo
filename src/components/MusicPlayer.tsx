import { useEffect, useRef } from "react";
import { CATALOG, getTrack, trackUrl, type Track } from "@/lib/catalog";

interface Props {
  trackId: string | null;
  isPlaying: boolean;
  positionSeconds: number;
  updatedAt: string | null;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (sec: number) => void;
  onSelectTrack: (track: Track) => void;
}

const SYNC_TOLERANCE = 0.5; // seconds

export function MusicPlayer({
  trackId,
  isPlaying,
  positionSeconds,
  updatedAt,
  onPlay,
  onPause,
  onSeek,
  onSelectTrack,
}: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const track = getTrack(trackId);

  // Compute target time: if playing, account for elapsed since updated_at
  function targetTime(): number {
    if (!isPlaying || !updatedAt) return positionSeconds;
    const elapsed = (Date.now() - new Date(updatedAt).getTime()) / 1000;
    return positionSeconds + Math.max(0, elapsed);
  }

  // Sync playback when state changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !track) return;

    const newSrc = trackUrl(track);
    if (audio.src !== newSrc) {
      audio.src = newSrc;
      audio.load();
    }

    const t = targetTime();
    if (Math.abs(audio.currentTime - t) > SYNC_TOLERANCE) {
      try { audio.currentTime = t; } catch { /* may fail before metadata loaded */ }
    }

    if (isPlaying) {
      audio.play().catch(() => { /* autoplay blocked until user gesture */ });
    } else {
      audio.pause();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackId, isPlaying, positionSeconds, updatedAt]);

  // Drift correction every 2s while playing
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      const audio = audioRef.current;
      if (!audio) return;
      const t = targetTime();
      if (Math.abs(audio.currentTime - t) > SYNC_TOLERANCE) {
        try { audio.currentTime = t; } catch { /* noop */ }
      }
    }, 2000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, updatedAt, positionSeconds]);

  const currentIndex = track ? CATALOG.findIndex((t) => t.id === track.id) : -1;

  function next() {
    if (currentIndex < 0) return;
    const n = CATALOG[(currentIndex + 1) % CATALOG.length];
    onSelectTrack(n);
  }
  function prev() {
    if (currentIndex < 0) return;
    const p = CATALOG[(currentIndex - 1 + CATALOG.length) % CATALOG.length];
    onSelectTrack(p);
  }

  return (
    <div className="rounded-3xl border border-border/60 bg-card/60 backdrop-blur p-8 glow-mint">
      <audio ref={audioRef} preload="auto" onEnded={next} />

      <div className="flex flex-col items-center text-center">
        <div className="relative size-56 rounded-3xl gradient-mint glow-mint flex items-center justify-center mb-8 overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center gap-1.5">
            {Array.from({ length: 12 }).map((_, i) => (
              <span
                key={i}
                className="w-1.5 bg-primary-foreground/90 rounded-full eq-bar"
                style={{
                  height: `${20 + (i % 4) * 18}px`,
                  animationDelay: `${i * 0.08}s`,
                  animationPlayState: isPlaying ? "running" : "paused",
                }}
              />
            ))}
          </div>
        </div>

        <div className="min-h-[60px]">
          <h2 className="text-2xl font-bold text-foreground">
            {track?.title ?? "Pick a track"}
          </h2>
          <p className="text-muted-foreground mt-1">{track?.artist ?? "—"}</p>
        </div>

        <div className="mt-8 flex items-center gap-5">
          <button
            onClick={prev}
            className="size-12 rounded-full border border-border/60 bg-secondary/60 text-foreground flex items-center justify-center hover:bg-secondary transition"
            aria-label="Previous"
          >
            <SkipIcon dir="back" />
          </button>
          <button
            onClick={isPlaying ? onPause : onPlay}
            disabled={!track}
            className="size-16 rounded-full bg-mint text-primary-foreground flex items-center justify-center glow-mint hover:scale-105 active:scale-95 transition disabled:opacity-40"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? <PauseIcon /> : <PlayIcon />}
          </button>
          <button
            onClick={next}
            className="size-12 rounded-full border border-border/60 bg-secondary/60 text-foreground flex items-center justify-center hover:bg-secondary transition"
            aria-label="Next"
          >
            <SkipIcon dir="fwd" />
          </button>
        </div>

        <SeekBar
          isPlaying={isPlaying}
          positionSeconds={positionSeconds}
          updatedAt={updatedAt}
          audioRef={audioRef}
          onSeek={onSeek}
        />
      </div>
    </div>
  );
}

function SeekBar({
  isPlaying,
  positionSeconds,
  updatedAt,
  audioRef,
  onSeek,
}: {
  isPlaying: boolean;
  positionSeconds: number;
  updatedAt: string | null;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  onSeek: (sec: number) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const timeRef = useRef<HTMLSpanElement | null>(null);
  const durRef = useRef<HTMLSpanElement | null>(null);
  const fillRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let raf = 0;
    function tick() {
      const audio = audioRef.current;
      const dur = audio?.duration && isFinite(audio.duration) ? audio.duration : 0;
      let cur: number;
      if (isPlaying && updatedAt) {
        const elapsed = (Date.now() - new Date(updatedAt).getTime()) / 1000;
        cur = positionSeconds + Math.max(0, elapsed);
      } else {
        cur = positionSeconds;
      }
      if (dur > 0) cur = Math.min(cur, dur);
      if (fillRef.current && dur > 0) {
        fillRef.current.style.width = `${(cur / dur) * 100}%`;
      }
      if (timeRef.current) timeRef.current.textContent = fmt(cur);
      if (durRef.current) durRef.current.textContent = fmt(dur);
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, positionSeconds, updatedAt, audioRef]);

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    const bar = ref.current;
    const audio = audioRef.current;
    if (!bar || !audio?.duration) return;
    const rect = bar.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    onSeek(Math.max(0, Math.min(audio.duration, pct * audio.duration)));
  }

  return (
    <div className="w-full mt-8">
      <div
        ref={ref}
        onClick={handleClick}
        className="relative h-2 w-full rounded-full bg-secondary/60 cursor-pointer overflow-hidden"
      >
        <div ref={fillRef} className="absolute inset-y-0 left-0 gradient-mint" style={{ width: "0%" }} />
      </div>
      <div className="mt-2 flex justify-between text-xs font-mono text-muted-foreground">
        <span ref={timeRef}>0:00</span>
        <span ref={durRef}>0:00</span>
      </div>
    </div>
  );
}

function fmt(s: number) {
  if (!isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function PlayIcon() { return <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>; }
function PauseIcon() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>; }
function SkipIcon({ dir }: { dir: "fwd" | "back" }) {
  return dir === "fwd"
    ? <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6h2v12h-2z"/></svg>
    : <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18 6l-8.5 6L18 18V6zM6 6h2v12H6z"/></svg>;
}
