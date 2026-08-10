import {Contract, Interface, parseUnits} from "ethers";
import {ALGEBRA_QUOTER, ALGEBRA_SWAP_ROUTER, ERC20_ABI, QUICKSWAP_V2_ROUTER, SwapRoute} from "../../consts/Consts.js";
import {Quote} from "../../services/ISwapExecutor.js";
import ChainClients from "../ChainClients.js";

const V2_ROUTER_ABI = [
    "function getAmountsOut(uint256 amountIn, address[] path) view returns (uint256[] amounts)",
    "function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline) returns (uint256[] amounts)",
];

// Algebra v1.9 quoter is state-changing, so it is called via staticCall rather than as a view.
const ALGEBRA_QUOTER_ABI = [
    "function quoteExactInputSingle(address tokenIn, address tokenOut, uint256 amountIn, uint160 limitSqrtPrice) returns (uint256 amountOut, uint16 fee)",
];

// Algebra v1.9 struct: no deployer field, price bound named limitSqrtPrice (0 = no limit).
const ALGEBRA_ROUTER_ABI = [
    "function exactInputSingle(tuple(address tokenIn, address tokenOut, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 limitSqrtPrice) params) payable returns (uint256 amountOut)",
];

export async function quotePolygon(
    clients: ChainClients,
    route: SwapRoute,
    humanAmount: string,
    slippageBps: number,
): Promise<Quote> {
    const p = clients.provider(route.chainId);
    const [decIn, decOut] = await Promise.all([
        new Contract(route.tokenIn, ERC20_ABI, p).decimals(),
        new Contract(route.tokenOut, ERC20_ABI, p).decimals(),
    ]);
    const decimalsIn = Number(decIn);
    const decimalsOut = Number(decOut);

    const amountIn = parseUnits(humanAmount, decimalsIn);
    if (amountIn <= 0n) throw new Error("amount must be greater than zero");

    let expectedOut: bigint;
    if (route.kind === "v2") {
        const router = new Contract(QUICKSWAP_V2_ROUTER, V2_ROUTER_ABI, p);
        const amounts: bigint[] = await router.getAmountsOut(amountIn, [route.tokenIn, route.tokenOut]);
        expectedOut = amounts[amounts.length - 1];
    } else {
        const quoter = new Contract(ALGEBRA_QUOTER, ALGEBRA_QUOTER_ABI, p);
        const [out] = await quoter.quoteExactInputSingle.staticCall(route.tokenIn, route.tokenOut, amountIn, 0);
        expectedOut = out;
    }
    if (expectedOut <= 0n) throw new Error(`no liquidity for ${route.tokenInSymbol} -> ${route.tokenOutSymbol}`);

    const minOut = (expectedOut * BigInt(10000 - slippageBps)) / 10000n;
    return {
        amountIn,
        expectedOut,
        minOut,
        decimalsIn,
        decimalsOut,
        slippageBps,
        routeLabel: `${route.tokenInSymbol} -> ${route.tokenOutSymbol}`,
    };
}

// recipient is the treasury contract, so the USDT output lands there rather than with the manager wallet.
export function buildPolygonCalldata(
    route: SwapRoute,
    amountIn: bigint,
    minOut: bigint,
    recipient: string,
): {router: string; calldata: string} {
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
    if (route.kind === "v2") {
        const iface = new Interface(V2_ROUTER_ABI);
        const calldata = iface.encodeFunctionData("swapExactTokensForTokens", [
            amountIn,
            minOut,
            [route.tokenIn, route.tokenOut],
            recipient,
            deadline,
        ]);
        return {router: QUICKSWAP_V2_ROUTER, calldata};
    }
    const iface = new Interface(ALGEBRA_ROUTER_ABI);
    const calldata = iface.encodeFunctionData("exactInputSingle", [
        {
            tokenIn: route.tokenIn,
            tokenOut: route.tokenOut,
            recipient,
            deadline,
            amountIn,
            amountOutMinimum: minOut,
            limitSqrtPrice: 0,
        },
    ]);
    return {router: ALGEBRA_SWAP_ROUTER, calldata};
}
