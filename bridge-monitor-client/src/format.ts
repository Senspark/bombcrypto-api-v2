// Render a wei string as a token amount. Pure integer/string math — never routes a uint256 through Number.
export function formatWei(wei: string, decimals = 18, maxFrac = 4): string {
    let s = wei ?? "0";
    let neg = false;
    if (s.startsWith("-")) {
        neg = true;
        s = s.slice(1);
    }
    if (!/^\d+$/.test(s)) return wei; // not a plain integer — show as-is
    const padded = s.padStart(decimals + 1, "0");
    const intPart = padded.slice(0, padded.length - decimals).replace(/^0+(?=\d)/, "");
    const frac = padded.slice(padded.length - decimals).slice(0, maxFrac).replace(/0+$/, "");
    const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return (neg ? "-" : "") + (frac ? `${grouped}.${frac}` : grouped);
}

export function shortAddr(a: string | null): string {
    if (!a) return "-";
    return a.length > 12 ? `${a.slice(0, 6)}...${a.slice(-4)}` : a;
}

export function fmtTime(iso: string | null): string {
    if (!iso) return "-";
    const d = new Date(iso);
    return isNaN(d.getTime()) ? iso : d.toLocaleString();
}

export function fmtUnix(sec: number): string {
    if (!sec) return "-";
    return new Date(sec * 1000).toLocaleString();
}

// Snapshot note for cached on-chain data, e.g. "Dữ liệu lúc 14:03:21 (cache)".
export function snapshotNote(fetchedAt: number, cached: boolean): string {
    if (!fetchedAt) return "";
    const t = new Date(fetchedAt).toLocaleTimeString();
    return `Dữ liệu lúc ${t}${cached ? " (cache)" : ""}`;
}
