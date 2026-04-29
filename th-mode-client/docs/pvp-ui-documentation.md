# PvP Leaderboard Web Client - Documentation

## 🎨 Overview
Documentation for the PvP Leaderboard frontend implementation using React, Ant Design, and Vite.

## 🧱 Components
- **PvpLeaderBoardPage**: Main container with tab-based navigation (Weekly, Monthly, Hall of Fame).
- **PvpLeaderBoardTable**: Reusable Ant Design table for displaying player rankings with tier badges.
- **PvpLeaderBoardFetcher**: Service layer for API interaction with network-aware filtering (BSC/Polygon).

## ✨ Features
- **Auto-Refresh**: Toggleable automatic data polling.
- **Network Selector**: Filter rankings by blockchain network.
- **Responsive Design**: Optimized for desktop and mobile views.

## 🧪 Verification (Phase 4)
- **Component Tests**: `src/components/pvp-leaderboard/__tests__/PvpLeaderBoard.test.tsx` using Vitest and React Testing Library.
- **Mocks**: Includes `matchMedia` mock for Ant Design compatibility.

---
*Last Updated: 2026-04-28 by AI (Antigravity)*
