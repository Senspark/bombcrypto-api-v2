# PvP Leaderboard API - Documentation

## 📄 Overview
Technical documentation for the PvP Leaderboard API integration, supporting weekly/monthly rankings and wager statistics.

## 🛣️ API Routes
- `GET /pvp/leaderboard/weekly`: Weekly ELO-based ranking with network and mode filters.
- `GET /pvp/leaderboard/monthly`: Monthly ranking including `total_wagered` and `total_won` metrics.
- `GET /pvp/leaderboard/top-bettors`: Hall of Fame for the highest wagerers.

## 🔐 Security
- Accepts signed results from the game server.
- Validates the `PvpResultInfo` payload using SHA-256 signatures.

## 🧪 Verification (Phase 2)
- **Unit/Integration**: `tests/Leaderboard.test.ts` using Vitest and Supertest.
- **Coverage**: Endpoint responsiveness, query parameter validation, and JSON structure integrity.

---
*Last Updated: 2026-04-28 by AI (Antigravity)*
