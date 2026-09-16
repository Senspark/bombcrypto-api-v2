import {Contract, formatEther, parseEther, parseUnits} from "ethers";
import {BSC_CHAIN_ID, ERC20_ABI, routerOf, SwapRoute, TREASURY_ABI, TreasuryInstance} from "../consts/Consts.js";
import {SwapError} from "../consts/ServerError.js";
import IEnvConfig from "../services/IEnvConfig.js";
import ILogger from "../services/ILogger.js";
import ISwapExecutor, {Quote, SwapResult, TreasuryReading} from "../services/ISwapExecutor.js";
import ChainClients from "./ChainClients.js";
import {buildSmartRouterCalldata, quoteBsc} from "./swap/BscSwap.js";
import {buildPolygonCalldata, quotePolygon} from "./swap/PolygonSwap.js";

export default class SwapExecutor implements ISwapExecutor {
    private log: ILogger;

    constructor(logger: ILogger, private clients: ChainClients, private env: IEnvConfig) {
        this.log = logger.clone("[Swap]");
    }

    async read(instance: TreasuryInstance, route: SwapRoute): Promise<TreasuryReading> {
        const p = this.clients.provider(instance.chainId);
        const contract = new Contract(instance.address, TREASURY_ABI, p);
        const tokenIn = new Contract(route.tokenIn, ERC20_ABI, p);
        const usdt = new Contract(route.tokenOut, ERC20_ABI, p);

        const [fees, decIn, usdtBal, decUsdt, configuredUsdt, routerAllowed] = await Promise.all([
            tokenIn.balanceOf(instance.address),
            tokenIn.decimals(),
            usdt.balanceOf(instance.address),
            usdt.decimals(),
            contract.usdtToken(),
            contract.swapRouterAllowed(routerOf(route)),
        ]);

        return {
            fees,
            decimalsIn: Number(decIn),
            usdt: usdtBal,
            decimalsUsdt: Number(decUsdt),
            usdtConfigured: configuredUsdt.toLowerCase() === route.tokenOut.toLowerCase(),
            routerAllowed,
        };
    }

    async execute(
        instance: TreasuryInstance,
        route: SwapRoute,
        amountHuman: string,
        slippageBps: number,
    ): Promise<SwapResult> {
        // Everything up to the send costs nothing, so the caller may retry it freely. Past the send
        // a broadcast can no longer be ruled out — a rejection there might still have reached a node,
        // and retrying would swap twice — so the flag flips before the call, not after it resolves.
        let submitted = false;
        try {
            await this.preflight(instance, route, amountHuman);

            const q = await this.quote(route, amountHuman, slippageBps);
            const {router, calldata} =
                route.chainId === BSC_CHAIN_ID
                    ? buildSmartRouterCalldata(q.trade, instance.address, slippageBps)
                    : buildPolygonCalldata(route, q.amountIn, q.minOut, instance.address);

            const wallet = this.clients.wallet(instance.chainId);
            const contract = new Contract(instance.address, TREASURY_ABI, wallet);

            // ethers hands the node a fixed gasLimit from its own estimate, leaving no margin for the cost
            // drifting between estimate and mining (a cold storage slot, or the router picking a longer
            // route). Short by a few percent and the inner router call runs out, returns false, and the
            // contract's require(ok) reverts — which stops the whole schedule. Unused gas is refunded.
            const args = [route.tokenIn, q.amountIn, router, calldata, q.minOut];
            const gasLimit = (await contract.swapToUSDT.estimateGas(...args)) * 2n;

            this.log.info(
                `${instance.id}/${route.id} sending swapToUSDT amountIn=${q.amountIn} minOut=${q.minOut} router=${router} gasLimit=${gasLimit}`,
            );
            submitted = true;
            const tx = await contract.swapToUSDT(...args, {gasLimit});
            this.log.info(`${instance.id}/${route.id} tx ${tx.hash} sent, waiting for receipt`);
            const receipt = await tx.wait();
            if (!receipt || receipt.status !== 1) {
                throw new Error(`${instance.id}/${route.id} tx ${tx.hash} reverted`);
            }
            this.log.info(`${instance.id}/${route.id} tx ${tx.hash} confirmed in block ${receipt.blockNumber}`);

            return {
                txHash: tx.hash,
                amountIn: q.amountIn,
                expectedOut: q.expectedOut,
                minOut: q.minOut,
                decimalsIn: q.decimalsIn,
                decimalsOut: q.decimalsOut,
            };
        } catch (e) {
            const reason = e instanceof Error ? e.message : String(e);
            this.log.error(`${instance.id}/${route.id} failed ${submitted ? "after" : "before"} sending: ${reason}`);
            throw new SwapError(reason, submitted);
        }
    }

    quote(route: SwapRoute, amountHuman: string, slippageBps: number): Promise<Quote> {
        return route.chainId === BSC_CHAIN_ID
            ? quoteBsc(this.clients, route, amountHuman, slippageBps)
            : quotePolygon(this.clients, route, amountHuman, slippageBps);
    }

    // Everything that can be known before spending gas is checked here, so a misconfigured contract
    // or an empty treasury fails without a reverted transaction.
    private async preflight(instance: TreasuryInstance, route: SwapRoute, amountHuman: string): Promise<void> {
        const [reading, native] = await Promise.all([
            this.read(instance, route),
            this.clients.nativeBalance(instance.chainId),
        ]);

        if (!reading.usdtConfigured) {
            throw new Error(`${instance.id}: usdtToken is not set to ${route.tokenOut}`);
        }
        if (!reading.routerAllowed) {
            throw new Error(`${instance.id}: router ${routerOf(route)} is not whitelisted`);
        }

        const wanted = parseUnits(amountHuman, reading.decimalsIn);
        if (wanted > reading.fees) {
            throw new Error(
                `${instance.id}/${route.id}: contract holds ${reading.fees} ${route.tokenInSymbol} raw units, wanted ${wanted}`,
            );
        }

        const floor = parseEther(this.env.minNativeBalance);
        if (native < floor) {
            throw new Error(
                `manager wallet ${this.clients.managerAddress} has ${formatEther(native)} native on chain ${instance.chainId}, below the ${this.env.minNativeBalance} floor`,
            );
        }
    }
}
