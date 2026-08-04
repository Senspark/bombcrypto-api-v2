// Wallet plumbing for the treasury flow. Reads go through per-chain JsonRpcProviders (independent of
// the wallet's current chain); the wallet is only touched to sign the swap / withdraw tx.
import {BrowserProvider, JsonRpcProvider, JsonRpcSigner} from "ethers";
import {BSC_CHAIN_ID, BSC_RPC, POLYGON_CHAIN_ID, POLYGON_RPC} from "./config";

export function eth(): any {
    const e = (window as any).ethereum;
    if (!e) throw new Error("Không tìm thấy ví (cài MetaMask)");
    return e;
}

const readProviders: Record<number, JsonRpcProvider> = {};

export function readProvider(chainId: number): JsonRpcProvider {
    if (!readProviders[chainId]) {
        const rpc = chainId === BSC_CHAIN_ID ? BSC_RPC : POLYGON_RPC;
        readProviders[chainId] = new JsonRpcProvider(rpc, chainId, {staticNetwork: true});
    }
    return readProviders[chainId];
}

// Point the wallet at the target chain — swapping on the wrong chain would touch the wrong tokens.
export async function ensureChain(chainId: number): Promise<void> {
    const e = eth();
    const hex = "0x" + chainId.toString(16);
    const current: string = await e.request({method: "eth_chainId"});
    if (current?.toLowerCase() === hex.toLowerCase()) return;
    try {
        await e.request({method: "wallet_switchEthereumChain", params: [{chainId: hex}]});
    } catch {
        const name = chainId === BSC_CHAIN_ID ? "BSC" : chainId === POLYGON_CHAIN_ID ? "Polygon" : String(chainId);
        throw new Error(`Hãy chuyển ví sang ${name} (chainId ${chainId}) rồi thử lại`);
    }
}

export async function connect(): Promise<string> {
    const e = eth();
    const accounts: string[] = await e.request({method: "eth_requestAccounts"});
    return accounts[0];
}

export async function walletSigner(chainId: number): Promise<JsonRpcSigner> {
    const e = eth();
    await e.request({method: "eth_requestAccounts"});
    await ensureChain(chainId);
    return new BrowserProvider(e).getSigner();
}
