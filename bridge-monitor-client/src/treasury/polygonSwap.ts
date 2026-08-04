// Polygon quote + calldata for the treasury flow. Direct 1-hop pools, typed calldata (no aggregator).
import {Contract, Interface, parseUnits} from "ethers";
import {ALGEBRA_QUOTER, ALGEBRA_SWAP_ROUTER, POLYGON_CHAIN_ID, QUICKSWAP_V2_ROUTER, type SwapRoute} from "./config";
import {readProvider} from "./wallet";
import {ERC20_ABI, type Quote} from "./types";

const V2_ROUTER_ABI = [
    "function getAmountsOut(uint256 amountIn, address[] path) view returns (uint256[] amounts)",
    "function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline) returns (uint256[] amounts)",
];

// Algebra v1.9 quoter: state-changing simulation, so call it via staticCall (not a plain view).
const ALGEBRA_QUOTER_ABI = [
    "function quoteExactInputSingle(address tokenIn, address tokenOut, uint256 amountIn, uint160 limitSqrtPrice) returns (uint256 amountOut, uint16 fee)",
];

// Algebra v1.9 struct: no deployer field, price bound named limitSqrtPrice (0 = no limit).
const ALGEBRA_ROUTER_ABI = [
    "function exactInputSingle(tuple(address tokenIn, address tokenOut, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 limitSqrtPrice) params) payable returns (uint256 amountOut)",
];

export async function quotePolygon(route: SwapRoute, humanAmount: string, slippageBps: number): Promise<Quote> {
    const p = readProvider(POLYGON_CHAIN_ID);
    const tokenIn = new Contract(route.tokenIn, ERC20_ABI, p);
    const tokenOut = new Contract(route.tokenOut, ERC20_ABI, p);
    const [decIn, decOut] = await Promise.all([tokenIn.decimals(), tokenOut.decimals()]);
    const decimalsIn = Number(decIn);
    const decimalsOut = Number(decOut);

    const amountIn = parseUnits(humanAmount, decimalsIn);
    if (amountIn <= 0n) throw new Error("Số lượng phải > 0");

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
    if (expectedOut <= 0n) throw new Error("Không có thanh khoản cho cặp này");

    const minOut = (expectedOut * BigInt(10000 - slippageBps)) / 10000n;
    return {amountIn, expectedOut, minOut, decimalsIn, decimalsOut, slippageBps};
}

// Encode the router call the DepositBridge will low-level-`call` from inside swapFeesToUSDT, with
// `recipient` = the bridge so the USDT lands in the contract.
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
            amountIn, minOut, [route.tokenIn, route.tokenOut], recipient, deadline,
        ]);
        return {router: QUICKSWAP_V2_ROUTER, calldata};
    }
    const iface = new Interface(ALGEBRA_ROUTER_ABI);
    const calldata = iface.encodeFunctionData("exactInputSingle", [{
        tokenIn: route.tokenIn,
        tokenOut: route.tokenOut,
        recipient,
        deadline,
        amountIn,
        amountOutMinimum: minOut,
        limitSqrtPrice: 0,
    }]);
    return {router: ALGEBRA_SWAP_ROUTER, calldata};
}
