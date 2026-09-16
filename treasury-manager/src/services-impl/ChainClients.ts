import {JsonRpcProvider, Wallet} from "ethers";
import {createPublicClient, http, type PublicClient} from "viem";
import {bsc} from "viem/chains";
import IEnvConfig from "../services/IEnvConfig.js";
import {BSC_CHAIN_ID} from "../consts/Consts.js";

/**
 * Per-chain provider, signer and (BSC only) viem client. Unlike the deposit-* signers this service
 * submits transactions, so it needs real providers rather than the blockchain-center gateway. The
 * PancakeSwap SmartRouter also drives its own multicall batching and only accepts a viem client.
 */
export default class ChainClients {
    readonly managerAddress: string;

    private providers = new Map<number, JsonRpcProvider>();
    private wallets = new Map<number, Wallet>();
    private viemClient: PublicClient | null = null;

    constructor(private env: IEnvConfig) {
        if (!env.managerPrivateKey) throw new Error("MANAGER_PRIVATE_KEY is required");
        const pk = env.managerPrivateKey.startsWith("0x") ? env.managerPrivateKey : `0x${env.managerPrivateKey}`;
        this.managerAddress = new Wallet(pk).address;
    }

    provider(chainId: number): JsonRpcProvider {
        let p = this.providers.get(chainId);
        if (!p) {
            const url = this.env.rpcByChainId[chainId];
            if (!url) throw new Error(`No RPC configured for chain ${chainId}`);
            p = new JsonRpcProvider(url, chainId, {staticNetwork: true});
            this.providers.set(chainId, p);
        }
        return p;
    }

    wallet(chainId: number): Wallet {
        let w = this.wallets.get(chainId);
        if (!w) {
            const pk = this.env.managerPrivateKey.startsWith("0x")
                ? this.env.managerPrivateKey
                : `0x${this.env.managerPrivateKey}`;
            w = new Wallet(pk, this.provider(chainId));
            this.wallets.set(chainId, w);
        }
        return w;
    }

    bscPublicClient(): PublicClient {
        if (!this.viemClient) {
            this.viemClient = createPublicClient({
                chain: bsc,
                transport: http(this.env.rpcByChainId[BSC_CHAIN_ID]),
                batch: {multicall: {batchSize: 1024 * 200, wait: 16}},
            }) as PublicClient;
        }
        return this.viemClient;
    }

    nativeBalance(chainId: number): Promise<bigint> {
        return this.provider(chainId).getBalance(this.managerAddress);
    }
}
