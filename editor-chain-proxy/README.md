# editor-chain-proxy

**Dev-only** "ethers-as-a-service" HTTP proxy so the Unity Editor (which has no
MetaMask) can read and write to the bridge contracts during development. It is
generic: give it a network, a contract address, a function signature and args,
and it does the on-chain read (`/call`) or transaction (`/send`) for you.

> ⚠️ **Never deploy this.** It takes a private key per request and sends
> arbitrary transactions. It is testnet-only and binds to `127.0.0.1`. Keep it
> out of every production `docker-compose` / `compose.yaml`. It is independent of
> the production `blockchain-center-api` (which is read-only).

## Guardrails

1. **Testnet only** — hardcoded chainId whitelist `97` (bsctestnet) + `80002`
   (amoy). Every request re-reads the RPC's *real* chainId and rejects anything
   else, so even a swapped-to-mainnet RPC url is refused.
2. **Localhost only** — binds `127.0.0.1`, never exposed.
3. **Throwaway key only** — pass a disposable testnet-funded private key per
   `/send` request (from the Editor debug panel / `EditorPrefs`). The proxy is
   stateless; the key is never stored, never logged, never committed. **Do not
   use the production operator key** (it also controls mainnet).

## Run

```sh
cd bombcrypto-api-v2/editor-chain-proxy
npm install
npm start          # vite-node, http://127.0.0.1:8555
```

`PORT` (default 8555) and optional `BSCTESTNET_RPC` / `AMOY_RPC` come from `.env`
(see `.env.example`).

## Endpoints

Networks: `bsctestnet`, `amoy` (aliases `polygontestnet`, `polygonAmoy`).

### `GET /health`
Lists allowed networks.

### `POST /call` — read (no key)
```json
{ "network": "bsctestnet", "address": "0x…", "method": "feePercent() view returns (uint256)", "args": [] }
```
→ `{ "success": true, "network": "bsctestnet", "chainId": 97, "result": "5" }`

Counters (uint256 travels as a **string**):
```json
{ "network": "bsctestnet", "address": "0x…", "method": "withdrawn(address,address) view returns (uint256)",
  "args": ["0xUser", "0xToken"] }
```

### `POST /send` — write (needs key)
```json
{ "network": "bsctestnet", "address": "0xToken", "method": "approve(address,uint256)",
  "args": ["0xBridge", "1000000000000000000000"], "privateKey": "0xTESTNET_THROWAWAY" }
```
→ `{ "success": true, "txHash": "0x…", "status": 1, "gasUsed": "…", "events": [ … ] }`

`value` (native coin, wei) is optional for payable calls.

## Full bridge flow from the Editor (testnet)

```
# 1. approve the bridge to pull BCOIN
POST /send  approve(address,uint256)            [bridge, amount]
# 2. deposit
POST /send  deposit(address,uint256)            [token, amount]
# 3. read the on-chain counter the backend will sync
POST /call  deposited(address,address)          [user, token]   -> wei string
# ... backend signs a withdraw (gross, before) ...
# 4. relay the signed withdraw
POST /send  withdraw(address,uint256,uint256,bytes) [token, gross, before, signature]
# 5. read withdrawn to confirm
POST /call  withdrawn(address,address)          [user, token]
```

**Wei stays a string** end-to-end — never a JS number (18-decimal precision).
