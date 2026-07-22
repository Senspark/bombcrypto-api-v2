# pay-rock-server

Single-tx "claim quartz" REST API. Replaces the legacy `POST /pay-rock` endpoint on `bombcrypto-analytics/server` with a preview → confirm flow.

Spec: `bombcrypto-analytics/PAY_ROCK_V2_SPEC.md` (multi-tx wallet discovery from the spec is deferred — see below).

---

## Flow

1. `POST /pay-rock/preview { tx, network }` — server validates the tx (dedup, hero data, rock amount via the internal blockchain API + shared Postgres) and **caches** the result in Redis under `PAY_ROCK:PREVIEW:<NETWORK>:<TX>` with a short TTL. Repeat clicks for the same tx hit the cache → 0 upstream calls.
2. `POST /pay-rock/confirm { tx, network, acceptedRock }` — server atomically consumes the cached preview (Redis `GETDEL`), re-checks DB dedup, calls `sp_modify_rock_from_user_wallet`, returns per-tx status plus `rockBefore` / `rockAfter` for the wallet.

Both `tx` and `network` (`BSC` | `POLYGON`) are required on both endpoints.

### Why no wallet-discovery mode

The spec's "wallet → list candidate burn txs" path relied on BscScan / PolygonScan list-by-address endpoints. Those APIs are no longer free: BscScan / PolygonScan API-key management was unified into Etherscan, and the Etherscan V2 free tier only covers Ethereum mainnet. The client UI instead opens the explorer's "advanced filter" page in a new tab with the user's wallet + burn contract pre-filled; the user copies each tx hash back into the claim form. Single-tx server flow stays $0/month and free of upstream rate-limit risk.

---

## API

| Method | Path                  | Notes                                           |
|--------|-----------------------|-------------------------------------------------|
| `GET`  | `/`                   | Health check                                    |
| `GET`  | `/health`             | Health check                                    |
| `POST` | `/pay-rock/preview`   | Validate one tx; cached for `PREVIEW_TTL_SECONDS` |
| `POST` | `/pay-rock/confirm`   | Authoritative write; atomic single-credit       |

No auth at the HTTP layer — front the server with whatever the broader infra uses.

---

## How double-credit is prevented

Four independent layers, in order of when they fire:

1. **Atomic `GETDEL`** on the Redis cache during confirm — two simultaneous confirms for the same `(network, tx)`: only one gets the body, the other sees 410 `PREVIEW_NOT_FOUND`.
2. **`acceptedRock` anti-tamper** — confirm rejects with 409 `ROCK_AMOUNT_MISMATCH` if the client-sent amount differs from the cached preview's total.
3. **Per-tx DB dedup re-check** — `user_create_rock.status === 'DONE'` is checked just before each credit; matching rows return `ALREADY_PAID` in the response.
4. **`user_create_rock_pk` UNIQUE (`tx`, `uid`)** — final DB-level guard. Duplicate INSERT inside `sp_modify_rock_from_user_wallet` raises.

The legacy retry-rename trick (`tx → tx_retry<epoch>`) is **not** ported — the four layers above make it unnecessary.

---

## Configuration

See `.env.example`. Required:

- `DATABASE_URL` — shared `bombcrypto2` Postgres
- `BLOCKCHAIN_API` — internal service exposing `GET /query_rock_burn_tx?tx=&network=` (the `prod-ap-blockchain` service)
- `REDIS_URL`

Optional:

- `PREVIEW_TTL_SECONDS` (default `300`) — how long a preview stays cached
- `IS_PROD` (default `false`) — when false, raw upstream bodies are logged

---

## Run

```bash
npm install
npm run dev              # type-check + run with vite-node
npm run dev:release      # tsc build + node dist/Server.js
```

---

## Notes

- BHero NFTs that are already burned cannot be read on-chain — hero details are resolved from `user_bomber.gen_id` in the shared Postgres DB (same as the legacy server). For `ALREADY_PAID` txs, hero IDs come from `user_create_rock.heroes` (jsonb) — no upstream call.
- The legacy server is kept operational; both write to `user_create_rock` so dedup is automatic across both flows.
- Redis is used purely as a short-TTL cache around the slow internal blockchain API + as the consume-once token store for confirm. There is no lock — the four-layer defense above handles concurrency without one.
