# BombStats Analytics Engine (Senspark Edition)

The **BombStats Analytics Engine** is a high-performance analytics service designed for the BombCrypto (Senspark) ecosystem. It provides real-time insights into protocol health, NFT distributions, and staking activities.

## 🚀 Overview
- **Framework**: NestJS (TypeScript)
- **Database**: PostgreSQL (TypeORM)
- **Caching**: Redis
- **Infrastructure**: Dockerized (mapped to `/analytics-api` via Vite proxy)

## 🛠️ Architecture
The service follows the Standard NestJS modular architecture:
- `NftModule`: Handles all NFT metadata, rarity tracking, and global statistics.
- `ThModule`: Manages Treasure Hunt specific data and leaderboards.
- `DatabaseModule`: Centralized TypeORM configuration and migrations.

## 📡 API Endpoints (Prefix: `/api`)

### NFT & Analytics
- `GET /api/nfts/overview-stats`: Global protocol metrics (TVL, token prices, total assets).
- `GET /api/nfts/rankings`: Unified ranking endpoint for claims, staking, and asset counts.
- `GET /api/nfts/wallet/:address`: Live asset feed for a specific wallet address.
- `GET /api/nfts/feed`: Global live feed of recently processed assets.

### Treasure Hunt
- `GET /api/th/leaderboard`: Real-time race rankings for Treasure Mode.

## 🚦 Development Workflow

### Prerequisites
- Node.js 20+
- Docker & Docker Compose

### Setup & Installation
```bash
# Install dependencies
npm install

# Build the production bundle
npm run build
```

### Database Orchestration
The engine includes a specialized seeding tool for development and testing:
```bash
# Seed the database with mock protocol data
docker exec ap-analytics-engine node dist/seed.js
```

## 🐳 Docker Deployment
To deploy as part of the Senspark monorepo:
```bash
# Build and start the service
docker-compose up -d --build ap-analytics-engine
```

## 🧪 Testing
```bash
# End-to-end testing
npm run test:e2e

# Linting
npm run lint
```

---
*Maintained by the Senspark Engineering Team. Powered by Antigravity.*
