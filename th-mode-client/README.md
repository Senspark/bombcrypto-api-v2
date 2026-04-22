# Bombcrypto – Treasure Mode Race Leaderboard

A React-based single-page application that displays a **real-time leaderboard** for the Bombcrypto *Treasure Hunt (TH) Mode* race. It polls a backend analytics API every 5 seconds and renders hero standings grouped by rarity across both BSC and Polygon networks.

---

## Features

- **Live auto-refresh** – fetches leaderboard data every 5 s with a visual countdown; can be paused by the user.
- **Rarity-grouped tables** – data is split into 10 rarity tiers (Common → Super Mystic), each toggleable via individual switches.
- **Network filter** – filter heroes by blockchain network (BSC / Polygon).
- **Hero details** – displays rank, username, hero ID (with network & type tooltip), BCOIN stake, SEN stake, ticket count, and score.
- **Top-3 highlight** – first three ranks are visually distinguished.
- **Animated UI** – entrance animations via Framer Motion; styled with Ant Design components.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18, TypeScript |
| UI Library | Ant Design 5 |
| Animations | Framer Motion |
| Routing | React Router DOM v6 |
| HTTP Client | Axios |
| Build Tool | Create React App + CRACO |
| Containerisation | Docker (multi-stage, served with `serve`) |

---

## Project Structure

```
src/
├── components/
│   ├── leaderboard/       # LeaderBoardPage, PoolTable, AutoRefreshToggle, Fetcher & data types
│   └── navigations/       # React Router layout
├── consts/                # API URL constants
├── contexts/              # LocalStorage React context
└── utils/                 # Env config, network helpers, misc utilities, rarity/hero constants
```

---

## Getting Started

### Prerequisites

- Node.js ≥ 18
- npm ≥ 9

### Environment Variables

Create a `.env` file (or `.env.test` / `.env.prod`) in the project root:

```env
REACT_APP_API_HOST=your-api-host
REACT_APP_API_PORT=your-api-port   # only used over HTTP
```

The app calls `<protocol>//<host>:<port>/th/leaderboard` to fetch leaderboard data.

### Install & Run

```bash
npm install
npm start        # development server
```

### Build

```bash
npm run build          # standard build
npm run build:test     # build using .env.test
npm run build:prod     # build using .env.prod
```

---

## API Contract

The app expects the backend endpoint `GET /th/leaderboard` to return:

```json
{
  "success": true,
  "message": {
    "raceId": 42,
    "groupedData": [
      [ /* IHeroInfo[] for Common */ ],
      [ /* IHeroInfo[] for Rare   */ ],
      "..."
    ]
  }
}
```

`groupedData` is a fixed-length array of 10 groups ordered by `HeroRarity` (Common=0 … SuperMystic=9).

---

## License

