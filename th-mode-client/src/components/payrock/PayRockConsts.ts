import type {Network} from './PayRockData';

export const BURN_CONTRACTS: Record<Network, string> = {
    BSC: '0x9fb9b7349279266c85c0C9dd264D71d2a4B79AB4',
    POLYGON: '0x27313635E6B7AA3CC8436E24BE2317D4A0e56BeB',
};

const SCAN_HOST: Record<Network, string> = {
    BSC: 'https://bscscan.com',
    POLYGON: 'https://polygonscan.com',
};

// `createRock` selector on BHeroS — the function called when a user burns a hero for quartz.
const CREATE_ROCK_METHOD = '0x2e61a0fe~Create Rock';

export function buildAdvancedFilterUrl(network: Network, wallet: string): string {
    const params = new URLSearchParams({
        fadd: wallet,
        tadd: BURN_CONTRACTS[network],
        mtd: CREATE_ROCK_METHOD,
        txntype: '0',
        qt: '1',
    });
    return `${SCAN_HOST[network]}/advanced-filter?${params.toString()}`;
}
