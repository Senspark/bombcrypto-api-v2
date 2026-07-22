-- Consolidated schema for share-on-x (source of truth).
-- Apply this on a fresh database. For an existing database, apply the
-- incremental files in db/migrations/ instead. Every migration must also be
-- folded into this file so it always reflects the full current schema.

-- Append-only analytics log of every successful share. Not TTL-bounded
-- (unlike the Redis share record), so it is the durable store for stats:
-- per-wallet history, per-source breakdown, time-series, top leaderboards.
CREATE TABLE IF NOT EXISTS public.share_events (
    id          uuid        PRIMARY KEY,   -- share id (crypto.randomUUID)
    wallet      text        NOT NULL,      -- who shared: ap-login account id (0x address OR username), lowercased
    source      text        NOT NULL,      -- new_hero | summary | token_reward | collection
    title       text,
    description text,
    text        text,                      -- composed tweet text
    created_at  timestamptz NOT NULL       -- when the share was created
);

CREATE INDEX IF NOT EXISTS idx_share_events_wallet     ON public.share_events (wallet);
CREATE INDEX IF NOT EXISTS idx_share_events_created_at ON public.share_events (created_at);
CREATE INDEX IF NOT EXISTS idx_share_events_source     ON public.share_events (source);
