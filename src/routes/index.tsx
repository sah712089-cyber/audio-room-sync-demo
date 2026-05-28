import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CATALOG } from "@/lib/catalog";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SyncBeat — Listen Together, In Sync" },
      { name: "description", content: "Create a real-time music room, share the link, and listen in perfect sync with friends anywhere." },
      { property: "og:title", content: "SyncBeat — Listen Together, In Sync" },
      { property: "og:description", content: "Create a real-time music room, share the link, and listen in perfect sync." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createRoom() {
    setCreating(true);
    setError(null);
    try {
      const { data: room, error: roomErr } = await supabase
        .from("rooms")
        .insert({})
        .select()
        .single();
      if (roomErr || !room) throw roomErr ?? new Error("Could not create room");

      const first = CATALOG[0];
      await supabase.from("room_state").insert({
        room_id: room.id,
        current_track_id: first?.id ?? null,
        playback_position_seconds: 0,
        is_playing: false,
      });

      navigate({ to: "/room/$roomId", params: { roomId: room.id } });
    } catch (e) {
      console.error(e);
      setError("Could not create a room. Try again.");
      setCreating(false);
    }
  }

  return (
    <div className="min-h-screen gradient-hero relative overflow-hidden">
      <div className="absolute inset-0 bg-grid opacity-40 pointer-events-none" />

      <header className="relative z-10 max-w-6xl mx-auto px-6 pt-8 flex items-center justify-between">
        <Brand />
        <nav className="hidden sm:flex items-center gap-6 text-sm text-muted-foreground">
          <span>Real-time</span>
          <span>No signup</span>
        </nav>
      </header>

      <main className="relative z-10 max-w-6xl mx-auto px-6 pt-20 pb-24">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/40 backdrop-blur px-3 py-1 text-xs text-muted-foreground">
            <span className="inline-block size-2 rounded-full bg-mint shadow-[0_0_12px_var(--mint)]" />
            Listening rooms are live
          </div>
          <h1 className="mt-6 text-6xl sm:text-7xl font-bold leading-[0.95] text-foreground">
            Press play <span className="text-mint">together.</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-xl">
            SyncBeat keeps every listener in the same room on the exact same beat. Spin up a room, share the link, and the queue is shared, the timeline is shared, the moment is shared.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <button
              onClick={createRoom}
              disabled={creating}
              className="group relative inline-flex items-center gap-3 rounded-full bg-mint px-7 py-4 text-base font-semibold text-primary-foreground glow-mint transition hover:scale-[1.02] active:scale-100 disabled:opacity-60"
            >
              <PlayIcon />
              {creating ? "Creating room…" : "Create a Room"}
            </button>
            <p className="text-sm text-muted-foreground">
              Free. No account. Closes when everyone leaves.
            </p>
          </div>
          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        </div>

        <div className="mt-24 grid sm:grid-cols-3 gap-5">
          {[
            { k: "01", t: "Create", d: "One click spins up a private room with a shareable link." },
            { k: "02", t: "Invite", d: "Anyone enters a display name and steps into the room." },
            { k: "03", t: "Sync", d: "Play, pause and seek — every listener stays under 500ms." },
          ].map((s) => (
            <div key={s.k} className="rounded-2xl border border-border/60 bg-card/40 backdrop-blur p-6">
              <div className="text-xs font-mono text-mint">{s.k}</div>
              <h3 className="mt-2 text-xl font-semibold">{s.t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.d}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="relative z-10 max-w-6xl mx-auto px-6 pb-10 text-xs text-muted-foreground/70">
        SyncBeat · streaming via ImageKit CDN 
      </footer>
    </div>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative size-9 rounded-xl gradient-mint flex items-center justify-center glow-mint">
        <div className="flex gap-[3px] items-end h-4">
          <span className="w-[3px] bg-primary-foreground eq-bar" style={{ animationDelay: "0s" }} />
          <span className="w-[3px] bg-primary-foreground eq-bar" style={{ animationDelay: "0.2s" }} />
          <span className="w-[3px] bg-primary-foreground eq-bar" style={{ animationDelay: "0.4s" }} />
        </div>
      </div>
      <span className="font-display font-bold text-lg tracking-tight">SyncBeat</span>
    </div>
  );
}

function PlayIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
  );
}
