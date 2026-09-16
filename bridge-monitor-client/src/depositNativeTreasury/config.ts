// Deposit Native treasury config: which contract instances exist. Unlike Market/Stake/BHeroS this
// holds native currency (BNB / POL), not an ERC20 fee — no routes/quotes/USDT here at all.
import {BSC_CHAIN_ID, CHAINS, POLYGON_CHAIN_ID} from "../treasury/config";
import type {NativeNetwork} from "./api";

export {BSC_CHAIN_ID, CHAINS, POLYGON_CHAIN_ID};

export interface DepositNativeInstance {
    id: string;
    /** Key the game server and the reporting API use for this chain. */
    network: NativeNetwork;
    chainId: number;
    address: string;
    nativeSymbol: string;
}

// Proxy addresses — live mainnet vaults holding real user deposit balances (see
// scripts/2026-08-10-upgrade-deposit-native-mainnet.js and docs/deposit-native-token/README.md).
export const DEPOSIT_NATIVES: DepositNativeInstance[] = [
    {id: "deposit-native-bsc", network: "BSC", chainId: BSC_CHAIN_ID, address: "0xd3dDD6A5559fF902E58eA1508d1F6171bB5a1eec", nativeSymbol: "BNB"},
    {id: "deposit-native-polygon", network: "POLYGON", chainId: POLYGON_CHAIN_ID, address: "0xEe58fF994552c3314303459AE2D3e4Abde092e5B", nativeSymbol: "POL"},
];
