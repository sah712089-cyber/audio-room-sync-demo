import { CATALOG, type Track } from "@/lib/catalog";

interface Props {
  currentTrackId: string | null;
  isPlaying: boolean;
  onSelect: (track: Track) => void;
}

export function TrackQueue({ currentTrackId, isPlaying, onSelect }: Props) {
  return (
    <div className="space-y-1">
      {CATALOG.map((t, i) => {
        const active = t.id === currentTrackId;
        return (
          <button
            key={t.id}
            onClick={() => onSelect(t)}
            className={`group w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
              active
                ? "bg-secondary/80 text-foreground"
                : "hover:bg-secondary/40 text-foreground/85"
            }`}
          >
            <div className={`size-9 rounded-lg flex items-center justify-center text-xs font-mono shrink-0 ${
              active ? "bg-mint text-primary-foreground glow-mint" : "bg-secondary/70 text-muted-foreground group-hover:text-foreground"
            }`}>
              {active && isPlaying ? (
                <div className="flex gap-[2px] items-end h-3">
                  <span className="w-[2px] bg-current eq-bar" style={{ animationDelay: "0s" }} />
                  <span className="w-[2px] bg-current eq-bar" style={{ animationDelay: "0.15s" }} />
                  <span className="w-[2px] bg-current eq-bar" style={{ animationDelay: "0.3s" }} />
                </div>
              ) : (
                String(i + 1).padStart(2, "0")
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className={`text-sm truncate ${active ? "font-semibold" : "font-medium"}`}>{t.title}</div>
              <div className="text-xs text-muted-foreground truncate">{t.artist}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
