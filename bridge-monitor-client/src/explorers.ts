// Block-explorer endpoints per chainId (returned by /aggregate). Backfill uses the explorer's "Export Data"
// page, which lets you pick a DATE range and download the contract's Transactions as CSV (no block-range cap).
export interface ExplorerInfo {
    name: string;
    origin: string; // explorer origin, e.g. https://testnet.bscscan.com
}

export const EXPLORERS: Record<number, ExplorerInfo> = {
    97: {name: "BscScan Testnet", origin: "https://testnet.bscscan.com"},
    80002: {name: "Amoy PolygonScan", origin: "https://amoy.polygonscan.com"},
    56: {name: "BscScan", origin: "https://bscscan.com"},
    137: {name: "PolygonScan", origin: "https://polygonscan.com"},
};

// The Export Data page for a contract's transactions — pick a date range there and download the CSV.
export function exportUrl(chainId: number, address: string): string {
    const e = EXPLORERS[chainId];
    return e ? `${e.origin}/exportData?type=address&a=${address}` : "";
}

export function addressUrl(chainId: number, address: string): string {
    const e = EXPLORERS[chainId];
    return e ? `${e.origin}/address/${address}` : "";
}

export function txUrl(chainId: number, txHash: string): string {
    const e = EXPLORERS[chainId];
    return e ? `${e.origin}/tx/${txHash}` : "";
}

// Read-as-Proxy tab (bridge is a UUPS proxy) — where the operator calls view functions to verify a number.
export function readProxyUrl(chainId: number, address: string): string {
    const e = EXPLORERS[chainId];
    return e ? `${e.origin}/address/${address}#readProxyContract` : "";
}
