// Treasury Dev config. One proxy per chain, holding the dev share of every distribution — the
// swap that used to happen inside the source contract now happens here, on a human's click.
// Addresses are filled in after deploy-treasury-dev.js prints them; an empty string means the chain
// has no TreasuryDev yet and the tab says so instead of offering controls.
import {BSC_CHAIN_ID, CHAINS, POLYGON_CHAIN_ID, ROUTES, type SwapRoute} from "../treasury/config";

export {BSC_CHAIN_ID, CHAINS, POLYGON_CHAIN_ID, ROUTES};
export type {SwapRoute};

export interface DevTreasuryInstance {
    id: string;
    chainId: number;
    address: string;
}

export const DEV_TREASURIES: DevTreasuryInstance[] = [
    {id: "dev-bsc", chainId: BSC_CHAIN_ID, address: "0x2AB21479731423A78919a95c16ef75a5343cb84f"},
    {id: "dev-polygon", chainId: POLYGON_CHAIN_ID, address: "0x52329A36aE3D0D7f733c7fCBDA0293F4adf29acf"},
];

// The fee tokens that can arrive here are exactly the ones the sources distribute.
export function routesFor(instance: DevTreasuryInstance): SwapRoute[] {
    return ROUTES.filter((r) => r.chainId === instance.chainId);
}
