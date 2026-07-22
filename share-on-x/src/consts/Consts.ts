// Matches lowercase UUID v4 from crypto.randomUUID(). Rejects any :id we didn't issue.
export const UUID_V4_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// Human-facing home. Always the production game, regardless of which origin hosts
// this share service (test1/prod) — share pages/images live on the hosting origin,
// but people who click through should land on the real game.
export const HOME_URL = 'https://bombcrypto.io';

export const SHARE_SOURCES = ['new_hero', 'summary', 'token_reward', 'collection'] as const;
export type ShareSource = typeof SHARE_SOURCES[number];

export const MAX_HEROES = 200;

// A 2 MB JPEG is ~2.7 MB of base64.
export const JSON_BODY_LIMIT = '5mb';
