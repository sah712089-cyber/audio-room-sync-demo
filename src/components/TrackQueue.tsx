import { CATALOG, type Track } from "@/lib/catalog";

interface Props {
  currentTrackId: string | null;
  isPlaying: boolean;
  onSelect: (track: Track) => void;
  tracks?: Track[];
}

export function TrackQueue({ currentTrackId, isPlaying, onSelect, tracks }: Props) {
  const list = tracks ?? CATALOG;
  return (
    <div className="space-y-1">
      {list.map((t, i) => {
        const active = t.id === currentTrackId;
        return (
          <button
            key={t.id}
            onClick={() => onSelect(t)}
            className={`group w-full flex items-center gap-2 sm:gap-3 rounded-xl px-2 sm:px-3 py-2 sm:py-2.5 text-left transition ${
              active
                ? "bg-secondary/80 text-foreground"
                : "hover:bg-secondary/40 text-foreground/85"
            }`}
          >
            <div className={`size-7 sm:size-9 rounded-lg flex items-center justify-center text-[10px] sm:text-xs font-mono shrink-0 overflow-hidden ${
              active ? "bg-mint text-primary-foreground glow-mint" : "bg-secondary/70 text-muted-foreground group-hover:text-foreground"
            }`}>
              {t.thumbnail ? (
                <img src={t.thumbnail} alt="" className="size-full object-cover" loading="lazy" />
              ) : active && isPlaying ? (
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
              <div className={`text-xs sm:text-sm truncate ${active ? "font-semibold" : "font-medium"}`} title={t.title}>{t.title}</div>
              <div className="text-[11px] sm:text-xs text-muted-foreground truncate">{t.channel}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
