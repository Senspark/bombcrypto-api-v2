# bridge-monitor-client

Localhost-only Vue 3 admin page for the cross-chain `DepositBridge` monitor. It reads the `/monitor` REST
exposed by `ap-deposit-bridge` (bombcrypto-server-v2) — a read-only dashboard plus a manual gap-backfill form.

## Run

```
npm install
npm run dev          # http://localhost:8200
```

`/monitor/*` requests proxy to the signer service (default `http://localhost:8108`; override with
`VITE_MONITOR_TARGET`). No auth — intended for localhost only.

## Tabs

- **Aggregate** — live on-chain per chain×token: liquidity, deposited/withdrawn, fees, funded, same-chain
  solvency, and the cross-chain invariant `withdrawn(chain) <= deposited(opposite)`.
- **Anomalies** — rows the indexer recorded (alert-only; an operator flips the on-chain switch by hand).
- **Gaps / Backfill** — block ranges the sweep never covered. Each gap links to the explorer `getLogs` export;
  save the JSON and upload it to backfill the report DB and close the gap.
- **Wallets** — per-wallet `deposited`/`withdrawn` state, filterable by chain/token or a single-wallet lookup.
- **Lifecycle** — signed withdraw authorizations and how they resolved (`signed`/`executed`/`expired`).
- **Health** — indexer cursor lag vs the confirmed chain head.
- **Bridge Treasury** — swap DepositBridge's collected fees to USDT and withdraw, per chain.
- **Market Treasury** — same swap-to-USDT flow for BHeroMarket/BHouseMarket's marketplace tax
  (BCOIN/SENSPARK, BSC + Polygon); withdraw sweeps the full USDT balance (`withdrawV2`), no
  recipient/amount to pick.
- **Stake Treasury** — same swap-to-USDT flow for BCoinStake/SenStake. Unlike Market, this
  contract's balance isn't purely fee (it also holds staker principal); the UI shows `totalStake`
  next to the balance and warns when balance is already below it, but the contract itself has no
  guard — swapping past that point is an explicit operator call (staking is being sunset).
