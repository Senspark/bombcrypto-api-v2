# 🪐 SYSTEM ATLAS - BombCrypto API v2

This document serves as the Single Source of Truth (SSOT) for the infrastructure, services, and data flows of the BombCrypto API v2 ecosystem.

## 🛠️ Orchestrated Services

| Service | Container Name | Port (Host) | Description |
| :--- | :--- | :--- | :--- |
| **TH Mode Server** | `ap-th-server` | `8106` | Main backend for Treasure Hunt mode. Processes data from Redis or Mock sources. |
| **RPC API** | `ap-rpc-api` | `8105` | RPC communication interface for game interactions. |
| **Blockchain Center** | `ap-blockchain-center` | `8107` | Central monitoring and blockchain integration hub. |
| **TH Mode Client** | `th-mode-client` | `5173`* | React/Vite dashboard for real-time data visualization. |

*\* Default Vite port, accessible locally via browser.*

---

## 🛣️ API Endpoints (TH Mode Server)

Base URL: `http://localhost:8106`

| Method | Route | Description | Security / Notes |
| :--- | :--- | :--- | :--- |
| `GET` | `/` | Basic server health check. | Public |
| `GET` | `/health` | Detailed health check. | Public |
| `GET` | `/th/` | TH module health check. | Public |
| `GET` | `/th/leaderboard` | Export Leaderboard data (Treasure Hunt). | Requires valid Referer & Rate Limit (5 req/5s) |

---

## ⚙️ Critical Environment Variables

### `th-mode-server` (`.env`)

| Variable | Importance | Local Environment Impact |
| :--- | :--- | :--- |
| `USE_MOCK_DATA` | **CRITICAL** | If `true`, the system ignores Redis and uses `FakeMessengerService` to generate random data. Essential for development without full infra. |
| `REDIS_CONNECTION_STRING` | High | Defines where the server fetches real game events when Mock mode is disabled. |
| `PORT` | Medium | Internal container port (mapped to `8106` on host). |
| `TZ` | Low | Sets the timezone (`Asia/Bangkok` by default). |

---

## 🔄 Data Flow (Deep Scan)

### Simulation Mode (Mock)
1. `FakeMessengerService` generates random payloads of TH events.
2. `LeaderBoardHandler` processes and stores the current state in memory.
3. `th-mode-client` requests data via `/th/leaderboard`.
4. Server validates CORS (wide open for dev) and delivers JSON payload.

### Production Mode (Real)
1. Redis Stream receives raw game events.
2. `MessengerService` consumes the stream and decodes messages.
3. `LeaderBoardHandler` updates the dynamic ranking.
4. `th-mode-client` displays processed real-time events.

---

> [!TIP]
> **Maintenance:** To add new services, update `compose.yaml` and reflect changes in this atlas.
