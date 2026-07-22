import { HttpError } from "../errors";

// Contract-address registry, keyed by the CANONICAL network name (resolveNetwork
// returns bsctestnet | amoy). Testnet-only by design — the proxy refuses mainnet
// RPCs at runtime, so mainnet addresses are intentionally absent here.
//
// Sources (all cross-checked):
// - Bridge proxies + BCOIN/SEN from the impl-plan / signature config / bridge deploy.
// - Game contracts from the client's own testnet address tables
//   (bombcrypto-client-v2/.../BlockChain/Data/{Bsc,Polygon}Address.ts, `!production` getters).
//
// Contracts with NO testnet address (CoinExchange, USDT, HeroExtended, AirDrop,
// Birthday) are intentionally omitted — those features are no longer supported.
export type TokenSymbol = "BCOIN" | "SEN";

interface BridgeNetwork {
  bridge: string;
  tokens: Record<TokenSymbol, string>;
}

const BRIDGE_REGISTRY: Record<string, BridgeNetwork> = {
  bsctestnet: {
    bridge: "0xb34e148821082C7c73f094Be1E194b3474209bba",
    tokens: {
      BCOIN: "0x648a9cf8e95c73110d28e7e2329b2d0910bd36b8",
      SEN: "0x4B5828F31550aFe15C61D7a765D9597ad4282325",
    },
  },
  amoy: {
    bridge: "0x97D80e2914bcBd6F957eE804c7B6fe844A0A1cd7",
    tokens: {
      BCOIN: "0xcF693b54F86c49bbBa54Ff887488Bbf84C5D05BF",
      SEN: "0x93567522610828695F36178b180989996082404A",
    },
  },
};

function bridgeNetworkOf(network: string): BridgeNetwork {
  const n = BRIDGE_REGISTRY[network];
  if (!n) throw new HttpError(400, `No bridge registry for network '${network}'`);
  return n;
}

export function bridgeAddress(network: string): string {
  return bridgeNetworkOf(network).bridge;
}

export function tokenAddress(network: string, symbol: string): string {
  const s = (symbol ?? "").toUpperCase();
  const addr = bridgeNetworkOf(network).tokens[s as TokenSymbol];
  if (!addr) {
    throw new HttpError(400, `Unknown bridge token '${symbol}' on '${network}'. Allowed: BCOIN, SEN`);
  }
  return addr;
}

// ── Full game-contract registry (Milestone 2) ──────────────────────────────
// One entry per supported contract per testnet network. A missing/empty address
// throws at lookup time, so an unsupported command surfaces a clear 400 instead
// of hitting the zero address. Design contracts (Hero/House design) are resolved
// on-chain at runtime via `token.design()`, so they have no static address here.
export interface GameContracts {
  coinToken: string; // BCOIN
  senToken: string; // SEN (senspark) — shares the CoinToken ABI
  heroToken: string;
  heroSToken: string;
  heroStake: string;
  houseToken: string;
  deposit: string;
  claimManager: string;
}

const GAME_REGISTRY: Record<string, GameContracts> = {
  bsctestnet: {
    coinToken: "0x648a9cf8e95c73110d28e7e2329b2d0910bd36b8",
    senToken: "0x4B5828F31550aFe15C61D7a765D9597ad4282325",
    heroToken: "0xC1A4C06426B4Df799E455964A20FDe866E86fbd1",
    heroSToken: "0x2c5a4C5978b814105EDb7148F37Fe07157E03bAD",
    heroStake: "0xe3D882b5FC1654782D6579c876975324Ab4D3d07",
    houseToken: "0xB901EE87a6321ea73532C7fDF772dC9790b38c3C",
    deposit: "0x23094e46b74BF9352720a14CcbEf5C85496f65FC",
    claimManager: "0xc3835d85059f6454433213Ff7A16FA2be40d9a0A",
  },
  amoy: {
    coinToken: "0xcF693b54F86c49bbBa54Ff887488Bbf84C5D05BF",
    senToken: "0x93567522610828695F36178b180989996082404A",
    heroToken: "0xF9f21032bcCCe8997bB29Ab9FBE19502191B7596",
    heroSToken: "0x5F2a8Aa67E11626AD9Dc5671f8cD29762D4532d4",
    heroStake: "0x9b5d2671665d302d5011959236f5b395e753dccd",
    houseToken: "0x0fc7397017f1bebaf8ffe8220871af2b5b65509d",
    deposit: "0x48ce46d900105cf14ebf815c9980661c112b16b6",
    claimManager: "0x66e25f1de0a5b33e804be1a4e8c5e9376952b7c9",
  },
};

export function gameContracts(network: string): GameContracts {
  const g = GAME_REGISTRY[network];
  if (!g) throw new HttpError(400, `No game registry for network '${network}'`);
  return g;
}

// Resolve one game contract address, failing clearly when a network lacks it.
export function gameAddress(network: string, key: keyof GameContracts): string {
  const addr = gameContracts(network)[key];
  if (!addr) throw new HttpError(400, `No '${key}' address on '${network}' (unsupported on this testnet)`);
  return addr;
}

// ── RPC-token balance registry (GET_BALANCE) ───────────────────────────────
// Mirrors the client's BlockChainData.getRpc index map. A balance read targets
// the token's OWN chain, independent of the request network. USDT (index 3) is
// intentionally absent — no longer supported. Index 1 ("Bomb" in the client enum)
// is Polygon BCOIN, matching the client's table.
export interface RpcTokenDef {
  network: string;
  address: string;
  digit: number;
}

const RPC_TOKENS: Record<number, RpcTokenDef> = {
  0: { network: "bsctestnet", address: GAME_REGISTRY.bsctestnet.coinToken, digit: 18 },
  1: { network: "amoy", address: GAME_REGISTRY.amoy.coinToken, digit: 18 },
  2: { network: "bsctestnet", address: GAME_REGISTRY.bsctestnet.senToken, digit: 18 },
  4: { network: "amoy", address: GAME_REGISTRY.amoy.senToken, digit: 18 },
};

export function rpcTokenDef(category: number): RpcTokenDef {
  const def = RPC_TOKENS[category];
  if (!def) {
    throw new HttpError(400, `Unsupported balance category '${category}' (allowed: 0,1,2,4)`);
  }
  return def;
}
