// Wallet plumbing for the treasury flow. Reads go through per-chain read providers (independent of
// the wallet's current chain); the wallet is only touched to sign the swap / withdraw tx.
import {
    BrowserProvider,
    FetchRequest,
    JsonRpcApiProvider,
    JsonRpcProvider,
    JsonRpcSigner,
    Network,
    type JsonRpcError,
    type JsonRpcPayload,
    type JsonRpcResult,
} from "ethers";
import {ref} from "vue";
import {BSC_CHAIN_ID, BSC_RPCS, POLYGON_CHAIN_ID, POLYGON_RPCS} from "./config";

export function eth(): any {
    const e = (window as any).ethereum;
    if (!e) throw new Error("Không tìm thấy ví (cài MetaMask)");
    return e;
}

// ethers' FallbackProvider with quorum 1 surfaces the first error (a rate limit included) instead of
// moving on, so fail over by hand: a transport error or any JSON-RPC error tries the next RPC, and the
// last one that answered cleanly is tried first next time. A genuine revert still surfaces once every
// RPC has returned it.
class FailoverProvider extends JsonRpcApiProvider {
    readonly #rpcs: JsonRpcProvider[];
    #current = 0;

    constructor(urls: string[], chainId: number) {
        const network = Network.from(chainId);
        super(network, {staticNetwork: network});
        this.#rpcs = urls.map((url) => {
            const req = new FetchRequest(url);
            // FetchRequest retries a 429 with backoff for up to 12 attempts; fail over right away instead.
            req.setThrottleParams({maxAttempts: 1});
            return new JsonRpcProvider(req, network, {staticNetwork: network});
        });
    }

    async _send(payload: JsonRpcPayload | JsonRpcPayload[]): Promise<(JsonRpcResult | JsonRpcError)[]> {
        let last: (JsonRpcResult | JsonRpcError)[] | undefined;
        let lastError: unknown;
        for (let i = 0; i < this.#rpcs.length; i++) {
            const index = (this.#current + i) % this.#rpcs.length;
            try {
                const res = await this.#rpcs[index]._send(payload);
                if (!res.some((r) => "error" in r)) {
                    this.#current = index;
                    return res;
                }
                last = res;
            } catch (e) {
                lastError = e;
            }
        }
        if (last) return last;
        throw lastError;
    }
}

const readProviders: Record<number, FailoverProvider> = {};

export function readProvider(chainId: number): JsonRpcApiProvider {
    if (!readProviders[chainId]) {
        const rpcs = chainId === BSC_CHAIN_ID ? BSC_RPCS : POLYGON_RPCS;
        readProviders[chainId] = new FailoverProvider(rpcs, chainId);
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

// One account for the whole page. Tabs are mounted/unmounted by App.vue's v-if chain, so anything a
// tab holds itself dies with it — the connection has to live above them.
export const walletAccount = ref<string | null>(null);

// Without this, restoreConnection() would silently undo a disconnect on the next mount: MetaMask keeps
// the origin authorised, so eth_accounts still answers with the account the user just dropped.
const OPT_OUT_KEY = "treasury.wallet.optOut";

export async function connect(): Promise<string> {
    const e = eth();
    const accounts: string[] = await e.request({method: "eth_requestAccounts"});
    sessionStorage.removeItem(OPT_OUT_KEY);
    walletAccount.value = accounts[0] ?? null;
    return accounts[0];
}

// eth_accounts, not eth_requestAccounts — it answers from the existing authorisation without opening
// the wallet popup, which is what lets a reload restore the connection unprompted.
export async function restoreConnection(): Promise<void> {
    if (sessionStorage.getItem(OPT_OUT_KEY)) return;
    const e = (window as any).ethereum;
    if (!e) return;
    try {
        const accounts: string[] = await e.request({method: "eth_accounts"});
        walletAccount.value = accounts[0] ?? null;
    } catch {
        walletAccount.value = null;
    }
}

// Two levels: revoking makes the next connect go through the wallet's approval prompt again, but not
// every wallet implements it, so dropping the account locally is the fallback rather than the goal.
export async function disconnect(): Promise<void> {
    const e = (window as any).ethereum;
    if (e) {
        try {
            await e.request({method: "wallet_revokePermissions", params: [{eth_accounts: {}}]});
        } catch {
            // Wallet refused or has no such method — the opt-out flag below is what makes it stick.
        }
    }
    sessionStorage.setItem(OPT_OUT_KEY, "1");
    walletAccount.value = null;
}

// Switching or locking the account in the wallet must not leave a stale address signing real transfers.
(window as any).ethereum?.on?.("accountsChanged", (accounts: string[]) => {
    walletAccount.value = sessionStorage.getItem(OPT_OUT_KEY) ? null : (accounts[0] ?? null);
});

export async function walletSigner(chainId: number): Promise<JsonRpcSigner> {
    const e = eth();
    await e.request({method: "eth_requestAccounts"});
    await ensureChain(chainId);
    return new BrowserProvider(e).getSigner();
}
