import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MusicPlayer } from "@/components/MusicPlayer";
import { TrackQueue } from "@/components/TrackQueue";
import { JoinModal } from "@/components/JoinModal";
import { CATALOG, type Track } from "@/lib/catalog";
import { clearSession, getSession, setSession } from "@/lib/session";

export const Route = createFileRoute("/room/$roomId")({
  head: () => ({
    meta: [
      { title: "SyncBeat Room" },
      { name: "description", content: "Listening together in real time." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RoomPage,
});

interface RoomState {
  room_id: string;
  current_track_id: string | null;
  playback_position_seconds: number;
  is_playing: boolean;
  updated_at: string;
}

interface Participant {
  id: string;
  room_id: string;
  display_name: string;
  joined_at: string;
}

function RoomPage() {
  const { roomId } = Route.useParams();
  const navigate = useNavigate();

  const [session, setSessionState] = useState(() => getSession(roomId));
  const [state, setState] = useState<RoomState | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [roomMissing, setRoomMissing] = useState(false);
  const [copied, setCopied] = useState(false);

  // Initial load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: room } = await supabase.from("rooms").select("id").eq("id", roomId).maybeSingle();
      if (cancelled) return;
      if (!room) { setRoomMissing(true); return; }

      const { data: rs } = await supabase
        .from("room_state").select("*").eq("room_id", roomId).maybeSingle();
      if (cancelled) return;
      if (rs) {
        setState(rs as RoomState);
      } else {
        const first = CATALOG[0];
        const { data: created } = await supabase
          .from("room_state")
          .insert({
            room_id: roomId,
            current_track_id: first?.id ?? null,
            playback_position_seconds: 0,
            is_playing: false,
          })
          .select().single();
        if (created && !cancelled) setState(created as RoomState);
      }

      const { data: ps } = await supabase
        .from("participants").select("*").eq("room_id", roomId).order("joined_at");
      if (!cancelled && ps) setParticipants(ps as Participant[]);
    })();
    return () => { cancelled = true; };
  }, [roomId]);

  // Realtime subscriptions
  useEffect(() => {
    const ch = supabase
      .channel(`room:${roomId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "room_state", filter: `room_id=eq.${roomId}` },
        (payload) => {
          if (payload.new && (payload.new as RoomState).room_id) {
            setState(payload.new as RoomState);
          }
        })
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "participants", filter: `room_id=eq.${roomId}` },
        (payload) => setParticipants((p) => {
          const np = payload.new as Participant;
          return p.some((x) => x.id === np.id) ? p : [...p, np];
        }))
      .on("postgres_changes",
        { event: "DELETE", schema: "public", table: "participants", filter: `room_id=eq.${roomId}` },
        (payload) => setParticipants((p) => p.filter((x) => x.id !== (payload.old as Participant).id)))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [roomId]);

  // Join handler
  const onJoin = useCallback(async (displayName: string) => {
    const { data, error } = await supabase
      .from("participants")
      .insert({ room_id: roomId, display_name: displayName })
      .select().single();
    if (error || !data) { console.error(error); return; }
    const s = { displayName, participantId: data.id };
    setSession(roomId, s);
    setSessionState(s);
  }, [roomId]);

  // Cleanup on unmount / unload — remove participant
  useEffect(() => {
    if (!session) return;
    const id = session.participantId;
    const leave = () => {
      // best-effort; the network may not finish
      supabase.from("participants").delete().eq("id", id).then(() => {});
    };
    window.addEventListener("beforeunload", leave);
    return () => { window.removeEventListener("beforeunload", leave); };
  }, [session]);

  const updateState = useCallback(async (patch: Partial<RoomState>) => {
    const next = { ...patch, updated_at: new Date().toISOString() };
    // optimistic
    setState((prev) => prev ? { ...prev, ...next } as RoomState : prev);
    await supabase.from("room_state").update(next).eq("room_id", roomId);
  }, [roomId]);

  const onPlay = useCallback(() => {
    if (!state) return;
    updateState({ is_playing: true, playback_position_seconds: state.playback_position_seconds });
  }, [state, updateState]);

  const onPause = useCallback(() => {
    if (!state) return;
    // Freeze at current effective time
    const elapsed = state.is_playing
      ? (Date.now() - new Date(state.updated_at).getTime()) / 1000
      : 0;
    updateState({
      is_playing: false,
      playback_position_seconds: state.playback_position_seconds + Math.max(0, elapsed),
    });
  }, [state, updateState]);

  const onSeek = useCallback((sec: number) => {
    updateState({ playback_position_seconds: sec });
  }, [updateState]);

  const onSelectTrack = useCallback((track: Track) => {
    updateState({
      current_track_id: track.id,
      playback_position_seconds: 0,
      is_playing: true,
    });
  }, [updateState]);

  const leaveRoom = useCallback(async () => {
    if (session) {
      await supabase.from("participants").delete().eq("id", session.participantId);
      clearSession(roomId);
    }
    navigate({ to: "/" });
  }, [session, roomId, navigate]);

  const shareUrl = useMemo(
    () => (typeof window !== "undefined" ? window.location.href : ""),
    [],
  );

  async function copyShare() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* noop */ }
  }

  if (roomMissing) {
    return (
      <div className="min-h-screen gradient-hero flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <h1 className="text-4xl font-bold">Room not found</h1>
          <p className="mt-3 text-muted-foreground">The room may have ended. Spin up a new one.</p>
          <button onClick={() => navigate({ to: "/" })} className="mt-6 rounded-full bg-mint px-6 py-3 font-semibold text-primary-foreground glow-mint">
            Back to home
          </button>
        </div>
      </div>
    );
  }

  if (!session) {
    return <JoinModal roomId={roomId} onJoin={onJoin} />;
  }

  return (
    <div className="min-h-screen gradient-hero relative">
      <div className="absolute inset-0 bg-grid opacity-30 pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Top bar */}
        <header className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl gradient-mint flex items-center justify-center glow-mint">
              <div className="flex gap-[3px] items-end h-4">
                <span className="w-[3px] bg-primary-foreground eq-bar" style={{ animationDelay: "0s", animationPlayState: state?.is_playing ? "running" : "paused" }} />
                <span className="w-[3px] bg-primary-foreground eq-bar" style={{ animationDelay: "0.2s", animationPlayState: state?.is_playing ? "running" : "paused" }} />
                <span className="w-[3px] bg-primary-foreground eq-bar" style={{ animationDelay: "0.4s", animationPlayState: state?.is_playing ? "running" : "paused" }} />
              </div>
            </div>
            <div>
              <div className="font-display font-bold text-lg leading-none">SyncBeat</div>
              <div className="text-xs text-muted-foreground font-mono mt-0.5">Room {roomId.slice(0, 8)}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={copyShare}
              className="hidden sm:inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/40 backdrop-blur px-4 py-2 text-sm hover:bg-card/70 transition"
            >
              <LinkIcon />
              {copied ? "Link copied!" : "Share room"}
            </button>
            <button
              onClick={leaveRoom}
              className="rounded-full border border-destructive/40 bg-destructive/10 text-destructive px-4 py-2 text-sm hover:bg-destructive/20 transition"
            >
              Leave room
            </button>
          </div>
        </header>

        {/* Sidebar layout: queue left, player right */}
        <div className="grid lg:grid-cols-[340px_minmax(0,1fr)] gap-6">
          <aside className="rounded-3xl border border-border/60 bg-card/40 backdrop-blur p-5 h-fit lg:sticky lg:top-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Queue</h3>
              <span className="text-xs font-mono text-muted-foreground">{CATALOG.length}</span>
            </div>
            <TrackQueue
              currentTrackId={state?.current_track_id ?? null}
              isPlaying={state?.is_playing ?? false}
              onSelect={onSelectTrack}
            />

            <div className="mt-6 pt-5 border-t border-border/60">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Listening · {participants.length}
              </h3>
              <ul className="space-y-1.5">
                {participants.map((p) => (
                  <li key={p.id} className="flex items-center gap-2.5 text-sm">
                    <Avatar name={p.display_name} />
                    <span className={p.id === session.participantId ? "font-semibold text-foreground" : "text-foreground/85"}>
                      {p.display_name}
                      {p.id === session.participantId && <span className="ml-1.5 text-xs text-mint">you</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          <main>
            {state ? (
              <MusicPlayer
                trackId={state.current_track_id}
                isPlaying={state.is_playing}
                positionSeconds={state.playback_position_seconds}
                updatedAt={state.updated_at}
                onPlay={onPlay}
                onPause={onPause}
                onSeek={onSeek}
                onSelectTrack={onSelectTrack}
              />
            ) : (
              <div className="rounded-3xl border border-border/60 bg-card/40 backdrop-blur p-12 text-center text-muted-foreground">
                Tuning the room…
              </div>
            )}

            <p className="mt-6 text-xs text-muted-foreground/70 text-center">
              Anyone in the room can play, pause, seek, or change track — and everyone stays in sync within ½ a second.
            </p>
          </main>
        </div>
      </div>
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return (
    <span className="size-7 rounded-full bg-secondary/70 border border-border/60 flex items-center justify-center text-xs font-semibold text-foreground">
      {initials || "?"}
    </span>
  );
}

function LinkIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>;
}
