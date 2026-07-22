-- 0001: create append-only analytics log of share events.

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
