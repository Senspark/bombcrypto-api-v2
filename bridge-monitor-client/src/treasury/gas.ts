// Gas limit for the fee-swap calls, doubled off the estimate.
//
// ethers computes eth_estimateGas itself and hands the wallet a fixed gasLimit, so the wallet never
// applies its own safety buffer — the swap goes out with zero margin. A swap's real cost drifts
// between estimate and mining: a storage slot that was warm becomes cold (the contract's USDT
// balance after a withdraw is worth ~15k gas on its own), or the router picks a longer route. When
// the limit falls short the inner `router.call(...)` runs out, returns false, and the treasury's
// `require(ok, "Swap failed")` reverts with the router's real reason already discarded.
//
// Unused gas is refunded, so the buffer costs nothing on success.
export async function swapGasLimit(
    method: {estimateGas: (...args: never[]) => Promise<bigint>},
    args: unknown[],
): Promise<bigint> {
    const estimate = await (method.estimateGas as (...a: unknown[]) => Promise<bigint>)(...args);
    return estimate * 2n;
}
