CREATE TABLE public.queue_tracks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id uuid NOT NULL,
  youtube_url text NOT NULL,
  video_id text NOT NULL,
  title text NOT NULL,
  channel text,
  thumbnail_url text,
  duration_seconds integer,
  added_by text,
  position double precision NOT NULL DEFAULT extract(epoch from now()),
  added_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.queue_tracks TO anon, authenticated;
GRANT ALL ON public.queue_tracks TO service_role;

ALTER TABLE public.queue_tracks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "queue_tracks readable by all" ON public.queue_tracks FOR SELECT USING (true);
CREATE POLICY "queue_tracks insertable by all" ON public.queue_tracks FOR INSERT WITH CHECK (true);
CREATE POLICY "queue_tracks updatable by all" ON public.queue_tracks FOR UPDATE USING (true);
CREATE POLICY "queue_tracks deletable by all" ON public.queue_tracks FOR DELETE USING (true);

CREATE INDEX idx_queue_tracks_room ON public.queue_tracks(room_id, position);

ALTER PUBLICATION supabase_realtime ADD TABLE public.queue_tracks;