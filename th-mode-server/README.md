# th-mode-server

A lightweight real-time leaderboard analytics server for **BombCrypto TH Mode**. It consumes live race events from a Redis Stream, maintains in-memory per-rarity leaderboards, and exposes a REST API for moderator clients to sync ranking data.

---

## Features

- Real-time leaderboard updates via **Redis Streams** (or built-in mock data for UI development)
- 10 independent rarity pools: `Common` · `Rare` · `SuperRare` · `Epic` · `Legend` · `SuperLegend` · `Mega` · `SuperMega` · `Mystic` · `SuperMystic`
- Per-pool descending score sort with automatic race reset on new race ID
- Referrer-based access control + per-IP rate limiting (5 req / 5 s) on the sync endpoint
- Multi-stage **Docker** build for minimal production images
- Written in **TypeScript** (ESNext), tested with **Vitest**

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js ≥ 20.11 |
| Language | TypeScript 5 |
| Framework | Express 4 |
| Messaging | Redis 4 (Streams / `xRead`) |
| Config | dotenv + envalid |
| Testing | Vitest |
| Container | Docker (Alpine) |

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/` | Health check |
| `GET` | `/health` | Health check |
| `GET` | `/th/leaderboard` | Export current leaderboard (restricted) |

> `/th/leaderboard` requires a valid `Referer` header matching `CLIENT_TH_MODE_PATH` and is rate-limited per IP.

---

## Getting Started

### Prerequisites

- Node.js ≥ 20.11
- A running Redis instance (not required when `USE_MOCK_DATA=true`)

### Install & Run

```bash
npm install
npm start          # type-check + run with vite-node (development)
```

---

## Configuration
Create a `.env` file at the project root:

```env
REDIS_CONNECTION_STRING=redis://localhost:6379
PORT=8106
IS_PROD=false
REFRESH_INTERVAL=5000
USE_MOCK_DATA=false
CLIENT_TH_MODE_PATH=https://your-client-domain.com
```

| Variable | Default | Description |
|---|---|---|
| `REDIS_CONNECTION_STRING` | _(none)_ | Redis connection URL. Required when `USE_MOCK_DATA=false` |
| `PORT` | `8106` | Port the server listens on |
| `IS_PROD` | `false` | Enables production mode |
| `REFRESH_INTERVAL` | `5000` | Interval (ms) between mock data ticks |
| `USE_MOCK_DATA` | `false` | Emit synthetic race events instead of reading Redis. Useful for UI development without a live Redis instance |
| `CLIENT_TH_MODE_PATH` | _(none)_ | Allowed Referer for the `/th/leaderboard` endpoint |

### Mock data mode

Set `USE_MOCK_DATA=true` to run without Redis. The server will generate random hero race entries across all 10 rarity pools every `REFRESH_INTERVAL` ms, so the leaderboard fills up automatically for display testing.

---

## Project Structure

```
src/
├── Server.ts                  # Entry point
├── Routes.ts                  # Route registration & middleware
├── Dependencies.ts            # DI container
├── Services.ts                # Service interfaces
├── consts/                    # Enums, types, Express extensions
├── routers/                   # Request handlers
├── services/                  # Service interfaces
├── services-impl/             # Concrete implementations
│   ├── LeaderBoardController.ts
│   ├── MessengerService.ts    # Redis Stream consumer
│   ├── FakeMessengerService.ts # Mock data emitter (USE_MOCK_DATA=true)
│   ├── Redis.ts
│   └── loggers/
└── utils/                     # Score calculation, sorted map
```

---

## Testing

```bash
npm test
```

---

## License

This project is licensed under the terms of the [GNU Affero General Public License v3.0](LICENSE).

